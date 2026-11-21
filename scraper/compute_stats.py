#!/usr/bin/env python3
"""Monthly market index: call compute_market_stats() for a month (and the
quarter, at quarter starts). Python twin of scripts/compute-market-stats.ts
so the work-server cron needs no Node install.

Why the index stopped in April 2026: the function only reads price_history
rows with run_type='full', and none were written after the 3 Apr backfill
(the scraper's inserts were rejected and logged as "non-fatal"; the monthly
job "succeeded" while producing nothing). This script therefore refuses a
non-service-role key and fails when the period has no snapshots or the call
produces no rows.

    python scraper/compute_stats.py                  # dry-run, previous month
    python scraper/compute_stats.py --month 2026-12 --apply
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import date, datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from store import key_role  # noqa: E402


def month_range(label: str):
    y, m = map(int, label.split("-"))
    start = date(y, m, 1)
    end = date(y + (m == 12), 1 if m == 12 else m + 1, 1)
    return start, end


def quarter_range(label: str):
    y, q = label.split("-Q")
    y, q = int(y), int(q)
    start = date(y, 3 * (q - 1) + 1, 1)
    end = date(y + (q == 4), 1 if q == 4 else 3 * q + 1, 1)
    return start, end


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--month")
    ap.add_argument("--quarter")
    ap.add_argument("--apply", action="store_true")
    args = ap.parse_args()

    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not url or not key:
        sys.exit("SUPABASE_URL and SUPABASE_KEY required")
    if key_role(key) != "service_role":
        sys.exit(f"SUPABASE_KEY role is '{key_role(key)}': price_history is readable only with the service-role key")
    from supabase import create_client
    sb = create_client(url, key)

    today = datetime.now(timezone.utc).date()
    jobs = []
    if args.month:
        jobs.append(("monthly", args.month, *month_range(args.month)))
    if args.quarter:
        jobs.append(("quarterly", args.quarter, *quarter_range(args.quarter)))
    if not jobs:
        prev = date(today.year - (today.month == 1), 12 if today.month == 1 else today.month - 1, 1)
        label = f"{prev.year}-{prev.month:02d}"
        jobs.append(("monthly", label, *month_range(label)))
        if today.month in (1, 4, 7, 10):
            q = (prev.month - 1) // 3 + 1
            ql = f"{prev.year}-Q{q}"
            jobs.append(("quarterly", ql, *quarter_range(ql)))

    ok = True
    for ptype, label, start, end in jobs:
        snaps = (sb.table("price_history").select("id", count="exact").eq("run_type", "full")
                 .gte("recorded_at", start.isoformat()).lt("recorded_at", end.isoformat()).limit(1).execute()).count
        info = {"period": label, "type": ptype, "start": str(start), "end": str(end), "full_snapshots": snaps}
        if not snaps:
            info["result"] = "no price snapshots in this period: nothing to compute"
            ok = False
        elif not args.apply:
            info["result"] = "dry-run: would call compute_market_stats()"
        else:
            sb.rpc("compute_market_stats", {"p_period_start": str(start), "p_period_end": str(end),
                                            "p_period_type": ptype, "p_period_label": label}).execute()
            n = (sb.table("market_stats").select("id", count="exact").eq("period_type", ptype)
                 .eq("period_start", str(start)).limit(1).execute()).count
            info["market_stats_rows"] = n
            if not n:
                ok = False
                info["result"] = "compute_market_stats() produced no rows"
        print(json.dumps(info))
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
