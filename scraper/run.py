#!/usr/bin/env python3
"""
Property.com.ve listing scraper ("link-out" aggregator).

For each source:
  1. discover every live listing URL (Rent-A-House: its sitemap; RE/MAX: its
     national search pages), politely and within robots.txt;
  2. fetch only new listings, plus a small rolling batch of the oldest-checked
     existing ones (prices change), one page at a time at the source's delay;
  3. store facts, one thumbnail and our own template summary (no copied
     description, no agent contacts);
  4. bump last_seen_at for listings still listed; mark inactive those missing
     from two consecutive runs or answering 404/410 (reversible, no deletes);
  5. log the run (scrape_runs table, or a local JSON-lines file).
Then: a weekly price snapshot for the market index, and duplicate marking
(once migration 022 is applied).

Examples:
  python scraper/run.py --dry-run --max-fetch 3 --print-records     # tiny live test, no writes
  python scraper/run.py --source all                                 # daily run
  python scraper/run.py --source rentahouse --refresh 600            # bigger refresh
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import re
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import dedup  # noqa: E402
import source_remax  # noqa: E402
import source_rentahouse  # noqa: E402
from facts import summary_en, summary_es, title_en, title_es  # noqa: E402
from polite_http import PoliteFetcher  # noqa: E402
from store import Store, now_iso  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("scraper")
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

SOURCES = {
    "rentahouse": source_rentahouse,
    "remax": source_remax,
}
DEFAULTS = {
    #               max new, refresh, time budget (min)
    "rentahouse": dict(max_new=500, refresh=100, budget=120),
    "remax": dict(max_new=150, refresh=40, budget=75),
}
# Absence-based expiry is skipped when discovery looks broken
MIN_FOUND_RATIO = 0.7
MIN_FOUND_FLOOR = {"rentahouse": 2000, "remax": 2000}


def sort_key_newest(url: str):
    nums = [int(x) for x in re.findall(r"\d+", url.rsplit("/", 1)[-1])]
    return nums[-2:] if nums else [0]


def scrape_one(name: str, mod, store: Store, fetcher: PoliteFetcher, args) -> dict:
    d = DEFAULTS[name]
    max_new = args.max_new if args.max_new is not None else d["max_new"]
    refresh = args.refresh if args.refresh is not None else d["refresh"]
    budget_s = 60 * (args.time_budget if args.time_budget is not None else d["budget"])
    started = datetime.now(timezone.utc)
    rec = {"source": name, "started_at": started.isoformat(), "status": "failed", "found": 0, "new": 0,
           "updated": 0, "seen": 0, "expired": 0, "reactivated": 0, "errors": 0, "fetched": 0, "notes": {}}
    err_before = len(store.errors)

    # 1. discovery
    try:
        if name == "remax":
            known = None
            if not args.remax_full:
                known = {source_remax.listing_id(u) for u in store.load_index(name)}
            disc = mod.discover(fetcher, max_pages=args.remax_max_pages, known_ids=known)
        else:
            disc = mod.discover(fetcher)
            disc["complete"] = True
    except Exception as e:
        logger.error(f"[{name}] discovery failed: {e}")
        rec["notes"]["error"] = str(e)
        rec["finished_at"] = now_iso()
        store.log_run(rec)
        return rec
    discovered = disc["urls"]
    disc_set = set(discovered)
    rec["found"] = len(discovered)
    rec["notes"]["reported_total"] = disc.get("total")
    rec["notes"]["complete"] = bool(disc.get("complete", True)) and not args.remax_max_pages and args.max_fetch is None
    logger.info(f"[{name}] discovered {len(discovered)} listing URLs (source reports {disc.get('total')})")

    # 2. what we already have
    index = store.load_index(name)
    if name == "remax":
        # RE/MAX slugs follow the ad title and can change; the trailing id is stable
        by_id = {source_remax.listing_id(u): u for u in index}
        discovered = [by_id.get(source_remax.listing_id(u), u) for u in discovered]
        disc_set = set(discovered)
    storable =[u for u in discovered if mod.classify_url(u)]
    new_urls = sorted((u for u in storable if u not in index), key=sort_key_newest, reverse=True)
    seen_existing = [u for u in discovered if u in index]
    refresh_urls = sorted((u for u in storable if u in index),
                          key=lambda u: index[u].get("scraped_at") or "")[:refresh]
    rec["notes"].update({"storable": len(storable), "new_candidates": len(new_urls),
                         "in_db": len(index), "seen_in_db": len(seen_existing)})
    logger.info(f"[{name}] storable {len(storable)}, new {len(new_urls)}, already in DB {len(seen_existing)}, "
                f"refreshing {len(refresh_urls)}")

    # 3. fetch new + refresh
    queue = [(u, False) for u in new_urls[:max_new]] + [(u, True) for u in refresh_urls]
    if args.max_fetch is not None:
        queue = queue[:args.max_fetch]
    new_rows, upd_rows, gone_ids, refreshed = [], [], [], set()
    skipped = fetch_err = 0
    t0 = time.monotonic()
    for i, (url, is_existing) in enumerate(queue):
        if time.monotonic() - t0 > budget_s:
            logger.info(f"[{name}] time budget reached after {i} fetches")
            rec["notes"]["budget_stop"] = i
            break
        r = fetcher.get(url)
        rec["fetched"] += 1
        if r.gone or (name == "remax" and r.ok and source_remax.is_not_found(r.text)):
            if url in index:
                gone_ids.append(index[url]["id"])
            continue
        if not r.ok:
            fetch_err += 1
            store.errors.append(f"fetch {url}: {r.status} {r.error}")
            continue
        try:
            f = mod.parse(url, r.text)
        except Exception as e:
            store.errors.append(f"parse {url}: {type(e).__name__}: {e}")
            continue
        if not f:
            skipped += 1
            continue
        if args.print_records:
            out = f.as_dict()
            out.update({"title_es": title_es(f), "title_en": title_en(f),
                        "summary_es": summary_es(f), "summary_en": summary_en(f)})
            print(json.dumps(out, ensure_ascii=False, indent=1))
        existing = index.get(f.source_url)
        if existing:
            row = store.build_row(f, existing, None)
            row["_id"] = existing["id"]
            upd_rows.append(row)
            refreshed.add(f.source_url)
        else:
            thumb = store.upload_thumbnail(fetcher, f)
            new_rows.append(store.build_row(f, None, thumb))
        if len(new_rows) >= 25:
            rec["new"] += store.write_rows(new_rows, "new")
            new_rows = []
        if len(upd_rows) >= 25:
            rec["updated"] += store.write_rows(upd_rows, "update")
            upd_rows = []
    rec["new"] += store.write_rows(new_rows, "new")
    rec["updated"] += store.write_rows(upd_rows, "update")
    rec["notes"].update({"skipped_not_storable": skipped, "fetch_errors": fetch_err})

    # 4a. still listed: bump last_seen_at; bring back expired rows that returned
    to_touch = [u for u in seen_existing if u not in refreshed]
    store.touch_seen(to_touch)
    rec["seen"] = len(seen_existing)
    back_sale, back_rent = [], []
    unhide = []
    for u in seen_existing:
        row = index[u]
        if u in refreshed:
            continue
        if row.get("deactivated_at"):
            (back_rent if row.get("transaction_type") == "rent" else back_sale).append(row["id"])
        elif store.rentals_active and row.get("transaction_type") == "rent" and not row.get("active"):
            unhide.append(row["id"])
    store.set_active(back_sale, True)
    if store.rentals_active:
        store.set_active(back_rent, True)
    else:
        store.unexpire_hidden(back_rent)
    store.unhide_rentals(unhide)
    rec["reactivated"] = len(back_sale) + len(back_rent)

    # 4b. gone: 404/410 now
    store.set_active(gone_ids, False, "source_404")
    rec["expired"] += len(gone_ids)

    # 4c. gone: missing from discovery on this run and the previous one
    prev = store.previous_run(name)
    rec["notes"]["previous_run"] = prev["started_at"].isoformat() if prev else None
    guard_ok = disc.get("complete", True) and len(discovered) >= MIN_FOUND_FLOOR.get(name, 0)
    if prev and prev.get("found"):
        guard_ok = guard_ok and len(discovered) >= MIN_FOUND_RATIO * prev["found"]
    if args.max_fetch is not None or args.remax_max_pages:
        guard_ok = False   # test runs never expire by absence
    missing_ids = []
    if not args.no_expire and guard_ok and prev:
        cutoff = prev["started_at"]
        gone_set = set(gone_ids)
        for u, row in index.items():
            if u in disc_set or row["id"] in gone_set or row.get("deactivated_at"):
                continue
            live = row.get("active") or row.get("transaction_type") == "rent"
            last = row.get("last_seen_at")
            if live and last and datetime.fromisoformat(last) < cutoff:
                missing_ids.append(row["id"])
        store.set_active(missing_ids, False, "missing_from_source")
        rec["expired"] += len(missing_ids)
    elif not prev:
        rec["notes"]["absence_expiry"] = "skipped: no previous successful run on record (first run)"
    elif not guard_ok:
        rec["notes"]["absence_expiry"] = "skipped: discovery incomplete or below the sanity floor"
    rec["notes"]["expired_missing"] = len(missing_ids)
    rec["notes"]["expired_404"] = len(gone_ids)

    rec["errors"] = len(store.errors) - err_before
    rec["notes"]["error_samples"] = store.errors[err_before:err_before + 10]
    attempted = max(1, rec["fetched"])
    rec["status"] = "ok" if fetch_err <= 0.2 * attempted else "degraded"
    rec["finished_at"] = now_iso()
    store.log_run(rec)
    logger.info(f"[{name}] {json.dumps({k: v for k, v in rec.items() if k != 'notes'})}")
    return rec


def run_dedup(store: Store) -> dict:
    cols = dedup.DEDUP_COLUMNS + (",duplicate_of" if store.has_cols.get("duplicate_of") else "")
    rows, off = [], 0
    while True:
        res = (store.client.table("listings").select(cols).eq("active", True).gt("price", 0)
               .order("id").range(off, off + 999).execute())
        data = res.data or []
        rows += data
        if len(data) < 1000:
            break
        off += 1000
    groups = dedup.find_groups(rows)
    summary = dedup.summarise(groups)
    if store.has_cols.get("duplicate_of"):
        in_groups = {r["id"] for g in groups for r in g[1:]}
        stale = [r["id"] for r in rows if r.get("duplicate_of") and r["id"] not in in_groups]
        if stale and not store.dry_run:
            for i in range(0, len(stale), 100):
                store.client.table("listings").update({"duplicate_of": None}).in_("id", stale[i:i + 100]).execute()
        summary["cleared"] = len(stale)
        summary["marked"] = dedup.mark(store, groups)
    else:
        summary["marked"] = "skipped: listings.duplicate_of missing (apply migration 022)"
    return summary


def parse_args():
    p = argparse.ArgumentParser(description="Property.com.ve link-out scraper")
    p.add_argument("--source", choices=["rentahouse", "remax", "all"], default="all")
    p.add_argument("--dry-run", action="store_true", help="fetch and parse, write nothing (DB or storage)")
    p.add_argument("--max-new", type=int, default=None, help="new listings to fetch per source")
    p.add_argument("--refresh", type=int, default=None, help="existing listings to re-check per source")
    p.add_argument("--max-fetch", type=int, default=None, help="hard cap on detail fetches per source (tests)")
    p.add_argument("--time-budget", type=int, default=None, help="minutes of detail fetching per source")
    p.add_argument("--remax-max-pages", type=int, default=None, help="limit RE/MAX search pages (tests)")
    p.add_argument("--remax-full", action="store_true",
                   help="walk every RE/MAX search page (weekly; enables absence expiry for RE/MAX). "
                        "Default: new listings only (stops after 3 pages with nothing new)")
    p.add_argument("--rentals-active", action="store_true",
                   default=os.environ.get("PROPERTY_RENTALS_ACTIVE") == "1",
                   help="store rentals as active (default: stored hidden until the site filters by transaction_type)")
    p.add_argument("--no-expire", action="store_true", help="never mark rows inactive for absence")
    p.add_argument("--price-snapshot", choices=["auto", "force", "skip"], default="auto",
                   help="weekly price_history snapshot (auto = if none in the last 7 days)")
    p.add_argument("--no-dedup", action="store_true")
    p.add_argument("--print-records", action="store_true", help="print parsed records as JSON")
    p.add_argument("--run-log-dir", default=os.environ.get("PROPERTY_SCRAPER_RUN_LOG",
                                                           str(Path(__file__).parent / ".runs")))
    return p.parse_args()


def main():
    args = parse_args()
    logger.info("=" * 60)
    logger.info(f"Property.com.ve scraper  source={args.source} dry_run={args.dry_run} "
                f"rentals_active={args.rentals_active}")
    store = Store(dry_run=args.dry_run, rentals_active=args.rentals_active, run_log_dir=args.run_log_dir)
    fetcher = PoliteFetcher(min_delay={
        "rentahouse.com.ve": source_rentahouse.MIN_DELAY,
        "www.remax.com.ve": source_remax.MIN_DELAY,
        "cdn.remax.com.ve": 0.5,
        "cdn.resize.sparkplatform.com": 0.5,
        "cdn.photos.sparkplatform.com": 0.5,
    })
    names = list(SOURCES) if args.source == "all" else [args.source]
    results = [scrape_one(n, SOURCES[n], store, fetcher, args) for n in names]

    extra = {}
    if args.price_snapshot != "skip" and args.max_fetch is None:
        try:
            extra["price_snapshots"] = store.weekly_price_snapshot(force=args.price_snapshot == "force")
        except Exception as e:
            store.errors.append(f"price snapshot: {e}")
    if not args.no_dedup and args.max_fetch is None:
        try:
            extra["dedup"] = run_dedup(store)
        except Exception as e:
            store.errors.append(f"dedup: {e}")

    logger.info("=" * 60)
    for r in results:
        logger.info(f"RESULT {r['source']}: status={r['status']} found={r['found']} new={r['new']} "
                    f"updated={r['updated']} expired={r['expired']} reactivated={r['reactivated']} "
                    f"errors={r['errors']} fetched={r['fetched']}")
    if extra:
        logger.info(f"EXTRA {json.dumps(extra, default=str)}")
    if store.dry_run:
        logger.info(f"DRY RUN, would have written: {json.dumps(store.would)}")
    logger.info(f"HTTP requests: {fetcher.requests}; errors total: {len(store.errors)}")
    for e in store.errors[:15]:
        logger.warning(f"  {e}")

    if any(r["status"] == "failed" for r in results):
        sys.exit(2)
    if any(r["status"] == "degraded" for r in results):
        sys.exit(3)


if __name__ == "__main__":
    main()
