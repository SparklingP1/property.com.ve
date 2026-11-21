#!/usr/bin/env python3
"""One-off: mark inactive the rows whose listing has left its source.

Every row is still `active` (nothing was ever deactivated). This walks each
source's full index once (Rent-A-House sitemap; RE/MAX national search),
then marks inactive every active row whose URL is not in it and that we
have not seen since before the walk. A sample of candidates is checked by
HTTP (404/410 confirms) before anything is written.

Reversible: sets active=false and deactivated_at=now (plus
expired_reason='backlog_missing' once migration 022 exists). Nothing is
deleted; to undo:  update listings set active=true, deactivated_at=null
where deactivated_at = '<timestamp of the run>';

Dry-run by default. --apply writes.
    python scraper/maintenance/expire_backlog.py [--source all] [--sample 10] [--apply]
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import random
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import source_remax  # noqa: E402
import source_rentahouse  # noqa: E402
from polite_http import PoliteFetcher  # noqa: E402
from store import Store  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("expire_backlog")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["rentahouse", "remax", "all"], default="all")
    ap.add_argument("--sample", type=int, default=10, help="candidates to confirm by HTTP per source")
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--save-discovery", default=None, help="write the discovered URL lists to this JSON file")
    args = ap.parse_args()

    store = Store(dry_run=not args.apply)
    fetcher = PoliteFetcher(min_delay={"rentahouse.com.ve": source_rentahouse.MIN_DELAY,
                                       "www.remax.com.ve": source_remax.MIN_DELAY})
    walk_started = datetime.now(timezone.utc)
    report, saved = {}, {}
    for name, mod in (("rentahouse", source_rentahouse), ("remax", source_remax)):
        if args.source not in (name, "all"):
            continue
        disc = mod.discover(fetcher)
        if not disc.get("complete", True):
            log.error(f"{name}: discovery incomplete, skipping")
            continue
        urls = disc["urls"]
        saved[name] = urls
        index = store.load_index(name)
        if name == "remax":
            disc_ids = {source_remax.listing_id(u) for u in urls}
            present = lambda u: source_remax.listing_id(u) in disc_ids  # noqa: E731
        else:
            s = set(urls)
            present = lambda u: u in s  # noqa: E731
        active = {u: r for u, r in index.items() if r.get("active")}
        missing = {u: r for u, r in active.items()
                   if not present(u) and datetime.fromisoformat(r["last_seen_at"]) < walk_started}
        still = len(active) - len(missing)
        by_type = Counter((r.get("property_type"), r.get("transaction_type")) for r in missing.values())
        by_month = Counter((r.get("last_seen_at") or "")[:7] for r in missing.values())

        # Confirm on a random sample
        sample = random.Random(42).sample(sorted(missing), min(args.sample, len(missing)))
        status = Counter()
        for u in sample:
            r = fetcher.get(u)
            if r.gone:
                status["404/410"] += 1
            elif name == "remax" and r.ok and source_remax.is_not_found(r.text):
                status["not-found page"] += 1
            elif r.ok:
                status["200 (still online)"] += 1
            else:
                status[str(r.status or r.error)] += 1
        report[name] = {
            "source_listed": len(urls),
            "rows_in_db": len(index),
            "active_rows": len(active),
            "to_expire": len(missing),
            "stay_active": still,
            "to_expire_by_type": {f"{k[0]}/{k[1]}": v for k, v in by_type.most_common()},
            "to_expire_by_last_seen_month": dict(sorted(by_month.items())),
            "http_check_sample": dict(status),
        }
        log.info(f"{name}: {json.dumps(report[name], ensure_ascii=False)}")
        store.set_active([r["id"] for r in missing.values()], False, "backlog_missing")

    if args.save_discovery:
        Path(args.save_discovery).write_text(json.dumps(saved))
    print(json.dumps({"dry_run": not args.apply, "report": report, "would": store.would,
                      "errors": store.errors[:10]}, indent=1, ensure_ascii=False))


if __name__ == "__main__":
    main()
