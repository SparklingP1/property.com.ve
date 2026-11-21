#!/usr/bin/env python3
"""Duplicate groups among active listings (dry-run by default).

Fingerprint: town, neighbourhood, type, sale/rent, area rounded to 1 m²,
bedrooms; prices within 3%. Newest row (latest created_at) is canonical.

--live-urls FILE  restrict to rows still listed at their source (the JSON
                  that expire_backlog.py --save-discovery writes), i.e. the
                  picture after the one-off expiry.
--apply           write listings.duplicate_of (needs migration 022).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import dedup  # noqa: E402
import source_remax  # noqa: E402
from store import Store  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--live-urls", default=None)
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--examples", type=int, default=5)
    args = ap.parse_args()
    store = Store(dry_run=not args.apply)

    rows, off = [], 0
    while True:
        res = (store.client.table("listings").select(dedup.DEDUP_COLUMNS).eq("active", True).gt("price", 0)
               .order("id").range(off, off + 999).execute())
        rows += res.data or []
        if len(res.data or []) < 1000:
            break
        off += 1000
    scope = "all active rows"
    if args.live_urls:
        live = json.loads(Path(args.live_urls).read_text())
        # a source missing from the file is kept unfiltered
        rah = set(live["rentahouse"]) if "rentahouse" in live else None
        rmx = {source_remax.listing_id(u) for u in live["remax"]} if "remax" in live else None
        rows = [r for r in rows if (r["source"] == "rentahouse" and (rah is None or r["source_url"] in rah))
                or (r["source"] == "remax" and (rmx is None or source_remax.listing_id(r["source_url"]) in rmx))]
        scope = f"active rows still listed at their source (filtered: {sorted(live)})"

    groups = dedup.find_groups(rows)
    out = {"scope": scope, "rows_considered": len(rows), **dedup.summarise(groups)}
    out["examples"] = [[{k: r.get(k) for k in ("source", "created_at", "price", "area_sqm", "bedrooms",
                                                "city", "neighborhood", "source_url")} for r in g]
                       for g in sorted(groups, key=len, reverse=True)[:args.examples]]
    if args.apply:
        out["marked"] = dedup.mark(store, groups)
    print(json.dumps(out, indent=1, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
