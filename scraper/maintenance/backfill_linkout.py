#!/usr/bin/env python3
"""Bring existing rows under the link-out rules.

(a) fill our template summary (description_short, _es, _en) for every row;
(b) clear personal contact data: agent_phone, agent_email, agent_whatsapp,
    agent_name.
Optional (c) --clear-descriptions: also clear the copied source description
    (description_full, _es, _en). Off by default: the listing pages read it.

Photos are NOT touched here (see photo_storage_report.py).

Dry-run by default: prints counts. --apply writes (summaries in batches of
500 via upsert on id; contacts with one UPDATE per column).
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from facts import facts_from_row, summary_en, summary_es  # noqa: E402
from store import Store, chunks  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)
log = logging.getLogger("backfill")

CONTACT_COLS = ("agent_phone", "agent_email", "agent_whatsapp", "agent_name")
SELECT = ("id,source,source_url,title,price,currency,area_sqm,total_area_sqm,land_area_sqm,bedrooms,bathrooms,"
          "parking_spaces,property_type,transaction_type,state,city,neighborhood,"
          "description_short,description_short_es,description_short_en")


def count(store, col_filter):
    res = store.client.table("listings").select("id", count="exact").limit(1)
    res = col_filter(res).execute()
    return res.count


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--clear-descriptions", action="store_true")
    ap.add_argument("--samples", type=int, default=5)
    args = ap.parse_args()
    store = Store(dry_run=not args.apply)

    rows, off = [], 0
    while True:
        res = store.client.table("listings").select(SELECT).order("id").range(off, off + 999).execute()
        rows += res.data or []
        if len(res.data or []) < 1000:
            break
        off += 1000
    log.info(f"rows: {len(rows)}")

    changes, samples, kinds = [], [], Counter()
    for r in rows:
        f = facts_from_row(r)
        es, en = summary_es(f), summary_en(f)
        if (r.get("description_short"), r.get("description_short_es"), r.get("description_short_en")) != (es, es, en):
            changes.append({"id": r["id"], "source": r["source"], "source_url": r["source_url"], "title": r["title"],
                            "description_short": es, "description_short_es": es, "description_short_en": en})
            kinds[f"{r.get('property_type')}/{r.get('transaction_type')}"] += 1
            if len(samples) < args.samples:
                samples.append({"before": (r.get("description_short") or "")[:160], "after_es": es, "after_en": en})

    contacts = {c: count(store, lambda q, c=c: q.not_.is_(c, "null")) for c in CONTACT_COLS}
    contacts["rows_with_any_contact"] = count(
        store, lambda q: q.or_(",".join(f"{c}.not.is.null" for c in CONTACT_COLS)))
    descs = count(store, lambda q: q.not_.is_("description_full", "null"))

    report = {
        "dry_run": not args.apply,
        "rows_total": len(rows),
        "summaries_to_fill": len(changes),
        "summaries_by_type": dict(kinds.most_common()),
        "summary_samples": samples,
        "contact_values_to_clear": contacts,
        "rows_with_copied_description_full": descs,
        "clear_descriptions": args.clear_descriptions,
    }
    print(json.dumps(report, indent=1, ensure_ascii=False))

    if not args.apply:
        return
    for batch in chunks(changes, 500):
        store.client.table("listings").upsert(batch, on_conflict="id").execute()
    cols = list(CONTACT_COLS)
    if args.clear_descriptions:
        cols += ["description_full", "description_full_es", "description_full_en"]
    for c in cols:
        # by id, 500 at a time, to stay clear of statement timeouts on Micro
        while True:
            ids = [r["id"] for r in store.client.table("listings").select("id")
                   .not_.is_(c, "null").limit(500).execute().data or []]
            if not ids:
                break
            store.client.table("listings").update({c: None}).in_("id", ids).execute()
    log.info("applied")


if __name__ == "__main__":
    main()
