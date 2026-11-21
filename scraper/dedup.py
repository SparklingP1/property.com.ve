"""Duplicate detection across and within sources.

Same property = same fingerprint (town, neighbourhood, type, sale/rent,
area rounded to 1 m², bedrooms) and prices within 3% of each other. The
newest row (latest created_at, i.e. first seen most recently) is canonical;
the others point at it through listings.duplicate_of (migration 022).
Nothing is deleted.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime
from typing import Iterable

from facts import facts_from_row, fingerprint

PRICE_TOLERANCE = 0.03
DEDUP_COLUMNS = ("id,source,source_url,created_at,price,currency,area_sqm,total_area_sqm,land_area_sqm,"
                 "bedrooms,bathrooms,property_type,transaction_type,city,neighborhood,state,active")


RELIST_GAP_DAYS = 7


def _ts(r):
    try:
        return datetime.fromisoformat(r.get("created_at"))
    except (TypeError, ValueError):
        return None


def _may_be_same(r: dict, cluster: list) -> bool:
    """Across sources: yes. Within one source: only if first seen more than a
    week apart from every member (a relisting, e.g. Rent-A-House re-coding
    rah-26-… as rah-27-…). Same-source ads first seen together are usually
    separate units in one development (RE/MAX lists them one by one)."""
    t = _ts(r)
    for m in cluster:
        if m["source"] != r["source"]:
            continue
        tm = _ts(m)
        if t is None or tm is None or abs((t - tm).days) < RELIST_GAP_DAYS:
            return False
    return True


def find_groups(rows: Iterable[dict]) -> list:
    """Return a list of groups; each group is a list of rows, canonical first."""
    by_fp = defaultdict(list)
    for r in rows:
        f = facts_from_row(r)
        fp = fingerprint(f)
        if fp:
            by_fp[(fp, (r.get("currency") or "USD"))].append(r)
    groups = []
    for _, members in by_fp.items():
        if len(members) < 2:
            continue
        members.sort(key=lambda r: (r.get("created_at") or "", r["id"]), reverse=True)
        clusters = []   # [canonical_row, [rows...]]
        for r in members:
            p = float(r["price"])
            for c in clusters:
                cp = float(c[0]["price"])
                if abs(p - cp) <= PRICE_TOLERANCE * cp and _may_be_same(r, c[1]):
                    c[1].append(r)
                    break
            else:
                clusters.append([r, [r]])
        groups += [c[1] for c in clusters if len(c[1]) > 1]
    return groups


def summarise(groups: list) -> dict:
    rows_marked = sum(len(g) - 1 for g in groups)
    cross = sum(1 for g in groups if len({r["source"] for r in g}) > 1)
    sizes = defaultdict(int)
    for g in groups:
        sizes[len(g)] += 1
    return {
        "groups": len(groups),
        "rows_in_groups": sum(len(g) for g in groups),
        "duplicates_to_mark": rows_marked,
        "cross_source_groups": cross,
        "group_sizes": dict(sorted(sizes.items())),
    }


def mark(store, groups: list) -> int:
    """Write duplicate_of for non-canonical rows (and clear it on canonicals)."""
    if not store.has_cols.get("duplicate_of"):
        return 0
    n = 0
    for g in groups:
        canon = g[0]["id"]
        dup_ids = [r["id"] for r in g[1:]]
        if store.dry_run:
            store._count("duplicates_marked", len(dup_ids))
            n += len(dup_ids)
            continue
        try:
            store.client.table("listings").update({"duplicate_of": canon}).in_("id", dup_ids).execute()
            store.client.table("listings").update({"duplicate_of": None}).eq("id", canon).execute()
            n += len(dup_ids)
        except Exception as e:
            store.errors.append(f"dedup mark: {e}")
    return n
