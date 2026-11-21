"""Supabase storage for the link-out scraper.

Every write goes through this class so that `dry_run=True` really writes
nothing (no rows, no images): it only counts what it would have done.
"""

from __future__ import annotations

import base64
import json
import logging
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable, Optional

from facts import (
    ListingFacts, extract_region, fingerprint, price_ok_for_index, property_id_for,
    summary_en, summary_es, title_en, title_es, url_slug_en, url_slug_es,
)

logger = logging.getLogger(__name__)

BUCKET = "property-images"
INDEX_COLUMNS = ("id,source_url,active,deactivated_at,last_seen_at,scraped_at,created_at,"
                 "thumbnail_url,price,currency,transaction_type,property_type")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def key_role(key: str) -> str:
    """'service_role' | 'anon' | 'unknown' — read from the key itself, never printed."""
    if not key:
        return "missing"
    if key.startswith("sb_secret_"):
        return "service_role"
    if key.startswith("sb_publishable_"):
        return "anon"
    try:
        payload = key.split(".")[1]
        payload += "=" * (-len(payload) % 4)
        return json.loads(base64.urlsafe_b64decode(payload)).get("role", "unknown")
    except Exception:
        return "unknown"


def chunks(seq, n):
    seq = list(seq)
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


class Store:
    def __init__(self, dry_run: bool = True, rentals_active: bool = False, run_log_dir: Optional[str] = None):
        from supabase import create_client
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise SystemExit("SUPABASE_URL and SUPABASE_KEY are required")
        self.role = key_role(key)
        if not dry_run and self.role != "service_role":
            # The April-October 2026 failure: writes to price_history (and the
            # stale-listing update) were rejected by row-level security and
            # logged as "non-fatal". Refuse to run a live write with such a key.
            raise SystemExit(f"SUPABASE_KEY role is '{self.role}', not 'service_role'. "
                             "Live runs need the service-role key (RLS blocks price_history and expiry).")
        self.client = create_client(url, key)
        self.dry_run = dry_run
        self.rentals_active = rentals_active
        self.run_log_dir = Path(run_log_dir) if run_log_dir else None
        self.would = {}          # dry-run counters
        self.errors = []
        self.has_cols = self._probe_columns()
        self.has_scrape_runs = self._probe_table("scrape_runs")
        logger.info(f"Store: dry_run={dry_run} key_role={self.role} "
                    f"optional_columns={sorted(k for k, v in self.has_cols.items() if v)} "
                    f"scrape_runs_table={self.has_scrape_runs}")

    # ------------------------------------------------------------------ probes
    def _probe_columns(self) -> dict:
        out = {}
        for col in ("duplicate_of", "fingerprint", "expired_reason"):
            try:
                self.client.table("listings").select(col).limit(1).execute()
                out[col] = True
            except Exception:
                out[col] = False
        return out

    def _probe_table(self, name: str) -> bool:
        try:
            self.client.table(name).select("id").limit(1).execute()
            return True
        except Exception:
            return False

    def _count(self, what: str, n: int = 1):
        self.would[what] = self.would.get(what, 0) + n

    # ------------------------------------------------------------------ reads
    def load_index(self, source: str) -> dict:
        """source_url -> row (light columns) for every row of a source."""
        rows, off, page = [], 0, 1000
        while True:
            res = (self.client.table("listings").select(INDEX_COLUMNS)
                   .eq("source", source).order("id").range(off, off + page - 1).execute())
            data = res.data or []
            rows += data
            if len(data) < page:
                break
            off += page
        return {r["source_url"]: r for r in rows}

    def previous_run(self, source: str) -> Optional[dict]:
        """{'started_at': datetime, 'found': int} of the last successful live
        run for a source whose discovery was complete (scrape_runs table, else
        the local JSON run log). Partial runs (RE/MAX new-only) don't count:
        absence must be seen on two complete walks."""
        best = None
        if self.has_scrape_runs:
            try:
                res = (self.client.table("scrape_runs").select("started_at,found")
                       .eq("source", source).eq("status", "ok").eq("notes->>complete", "true")
                       .order("started_at", desc=True).limit(1).execute())
                if res.data:
                    best = {"started_at": datetime.fromisoformat(res.data[0]["started_at"]),
                            "found": res.data[0].get("found") or 0}
            except Exception as e:
                logger.warning(f"scrape_runs read failed: {e}")
        if self.run_log_dir and self.run_log_dir.exists():
            for p in sorted(self.run_log_dir.glob("runs-*.jsonl")):
                for line in p.read_text().splitlines():
                    try:
                        rec = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if (rec.get("source") == source and rec.get("status") == "ok" and not rec.get("dry_run")
                            and (rec.get("notes") or {}).get("complete")):
                        t = datetime.fromisoformat(rec["started_at"])
                        if best is None or t > best["started_at"]:
                            best = {"started_at": t, "found": rec.get("found") or 0}
        return best

    def unexpire_hidden(self, ids: list):
        """A rental that came back while rentals are hidden: clear the expiry
        but keep it hidden (active=false, deactivated_at null)."""
        if not ids:
            return
        if self.dry_run:
            self._count("rentals_unexpired_hidden", len(ids))
            return
        patch = {"active": False, "deactivated_at": None}
        if self.has_cols.get("expired_reason"):
            patch["expired_reason"] = None
        for batch in chunks(ids, 100):
            try:
                self.client.table("listings").update(patch).in_("id", batch).execute()
            except Exception as e:
                self.errors.append(f"unexpire_hidden: {e}")

    # ------------------------------------------------------------------ row building
    def build_row(self, f: ListingFacts, existing: Optional[dict], thumb_url: Optional[str]) -> dict:
        """Columns we write. Existing rows keep their title, slugs and thumbnail;
        copied text and personal contact data are cleared."""
        live = (f.transaction_type != "rent") or self.rentals_active
        ts = now_iso()
        row = {
            "source": f.source,
            "source_url": f.source_url,
            "price": f.price,
            "currency": f.currency or "USD",
            "location": f.city,
            "region": extract_region(f.city or ""),
            "bedrooms": f.bedrooms,
            "bathrooms": f.bathrooms,
            "area_sqm": f.area_sqm,
            "total_area_sqm": f.total_area_sqm,
            "land_area_sqm": f.land_area_sqm,
            "parking_spaces": f.parking_spaces,
            "property_type": f.property_type,
            "transaction_type": f.transaction_type,
            "property_style": f.property_style,
            "condition": f.condition,
            "furnished": f.furnished,
            "construction_years": f.construction_years,
            "amenities": f.amenities or [],
            "state": f.state,
            "city": f.city,
            "neighborhood": f.neighborhood,
            "reference_code": f.reference_code,
            "photo_count": f.photo_count,
            "price_per_sqm": round(f.price / f.area_sqm, 2) if f.price and f.area_sqm else None,
            # our own text, from the facts
            "description_short": summary_es(f),
            "description_short_es": summary_es(f),
            "description_short_en": summary_en(f),
            "translation_model": "template-v1",
            "translated_at": ts,
            # link-out rules: no copied description, no personal contacts
            "description_full": None,
            "description_full_es": None,
            "description_full_en": None,
            "agent_name": None,
            "agent_phone": None,
            "agent_email": None,
            "agent_whatsapp": None,
            "agent_office": {"rentahouse": "Rent-A-House", "remax": "RE/MAX Venezuela"}.get(f.source),
            "street_address": None,
            "postal_code": None,
            "latitude": None,
            "longitude": None,
            "scraped_at": ts,
            "last_seen_at": ts,
            "active": live,
            "deactivated_at": None,
        }
        if self.has_cols.get("fingerprint"):
            row["fingerprint"] = fingerprint(f)
        if self.has_cols.get("expired_reason"):
            row["expired_reason"] = None
        if existing:
            thumb = existing.get("thumbnail_url") or thumb_url
            row["thumbnail_url"] = thumb
            row["image_urls"] = [thumb] if thumb else []
        else:
            pid = property_id_for(f.source_url)
            row.update({
                "title": title_es(f),
                "title_es": title_es(f),
                "title_en": title_en(f),
                "thumbnail_url": thumb_url,
                "image_urls": [thumb_url] if thumb_url else [],
                "url_slug": url_slug_en(f, pid),
                "url_slug_es": url_slug_es(f, pid),
                "has_360_tour": False,
                "has_video": False,
            })
        return row

    # ------------------------------------------------------------------ writes
    def upload_thumbnail(self, fetcher, f: ListingFacts) -> Optional[str]:
        """Download photo #1 (small size) and store it as {pid}/thumb.<ext>."""
        if not f.first_photo_url:
            return None
        pid = property_id_for(f.source_url)
        ext = os.path.splitext(f.first_photo_url.split("?")[0])[1].lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".jpg"
        path = f"{pid}/thumb{ext}"
        if self.dry_run:
            self._count("thumbnails_uploaded")
            return f"(dry-run) {BUCKET}/{path}"
        r = fetcher.get(f.first_photo_url, binary=True, check_robots=False)
        if not r.ok or not r.content:
            self.errors.append(f"thumbnail {f.first_photo_url}: {r.status} {r.error}")
            return None
        ctype = (r.headers or {}).get("content-type", "image/jpeg").split(";")[0]
        try:
            self.client.storage.from_(BUCKET).upload(
                path, r.content, file_options={"content-type": ctype, "upsert": "true"})
            return self.client.storage.from_(BUCKET).get_public_url(path)
        except Exception as e:
            self.errors.append(f"thumbnail upload {path}: {e}")
            return None

    def write_rows(self, rows: list, kind: str):
        """kind 'new': upsert on source_url, uniform keys per batch.
        kind 'update': rows carry '_id'; one PATCH per row (an upsert would
        trip the NOT NULL on title, which updates deliberately leave alone)."""
        if not rows:
            return 0
        if self.dry_run:
            self._count(f"rows_{kind}", len(rows))
            return len(rows)
        done = 0
        if kind == "update":
            for r in rows:
                r = dict(r)
                rid = r.pop("_id")
                try:
                    self.client.table("listings").update(r).eq("id", rid).execute()
                    done += 1
                except Exception as e:
                    self.errors.append(f"update {rid}: {e}")
            return done
        groups = {}
        for r in rows:
            groups.setdefault(tuple(sorted(r)), []).append(r)
        for batch_rows in groups.values():
            for batch in chunks(batch_rows, 50):
                try:
                    self.client.table("listings").upsert(batch, on_conflict="source_url").execute()
                    done += len(batch)
                except Exception as e:
                    self.errors.append(f"upsert {kind} ({len(batch)} rows): {e}")
        return done

    def touch_seen(self, urls: Iterable[str]):
        """Listings still in the source's index: bump last_seen_at."""
        urls = list(urls)
        if self.dry_run:
            self._count("rows_seen_touched", len(urls))
            return
        ts = now_iso()
        for batch in chunks(urls, 40):   # keeps the request URL under ~6 KB
            try:
                self.client.table("listings").update({"last_seen_at": ts}).in_("source_url", batch).execute()
            except Exception as e:
                self.errors.append(f"touch_seen: {e}")

    def set_active(self, ids: list, active: bool, reason: Optional[str] = None):
        """Expire (active=False, deactivated_at=now) or reactivate rows. Never deletes."""
        if not ids:
            return
        label = "rows_expired" if not active else "rows_reactivated"
        if self.dry_run:
            self._count(label + (f"_{reason}" if reason else ""), len(ids))
            return
        patch = {"active": active, "deactivated_at": None if active else now_iso()}
        if self.has_cols.get("expired_reason"):
            patch["expired_reason"] = None if active else reason
        for batch in chunks(ids, 100):
            try:
                self.client.table("listings").update(patch).in_("id", batch).execute()
            except Exception as e:
                self.errors.append(f"set_active({active}): {e}")

    def unhide_rentals(self, ids: list):
        """Rentals stored hidden (active=false, deactivated_at null) -> active."""
        if not ids:
            return
        if self.dry_run:
            self._count("rentals_unhidden", len(ids))
            return
        for batch in chunks(ids, 100):
            try:
                self.client.table("listings").update({"active": True}).in_("id", batch).is_("deactivated_at", "null").execute()
            except Exception as e:
                self.errors.append(f"unhide_rentals: {e}")

    # ------------------------------------------------------------------ price index
    def weekly_price_snapshot(self, force: bool = False) -> int:
        """Once a week, one 'full' price_history row per live for-sale listing
        (USD, plausible price, not a marked duplicate). compute_market_stats()
        only reads run_type='full' rows; the old scraper's daily rows never
        landed (RLS), and the weekly full scrape no longer exists, so this is
        what feeds the monthly index now."""
        today = datetime.now(timezone.utc).date()
        if not force:
            try:
                res = (self.client.table("price_history").select("recorded_at")
                       .eq("run_type", "full").gte("recorded_at", (today - timedelta(days=6)).isoformat())
                       .limit(1).execute())
                if res.data:
                    logger.info("price snapshot: already taken in the last 7 days")
                    return 0
            except Exception as e:
                # anon keys can't read price_history: treat as "unknown" and continue in dry-run
                logger.warning(f"price_history read failed: {e}")
                if not self.dry_run:
                    self.errors.append(f"price_history read: {e}")
                    return 0
        cols = "id,price,currency,city,state,property_type,bedrooms,area_sqm,transaction_type"
        if self.has_cols.get("duplicate_of"):
            cols += ",duplicate_of"
        rows, off = [], 0
        while True:
            res = (self.client.table("listings").select(cols).eq("active", True)
                   .eq("transaction_type", "sale").gt("price", 0)
                   .order("id").range(off, off + 999).execute())
            data = res.data or []
            rows += data
            if len(data) < 1000:
                break
            off += 1000
        snaps = []
        for r in rows:
            if r.get("duplicate_of"):
                continue
            f = ListingFacts(source="", source_url="", property_type=r.get("property_type") or "",
                             transaction_type="sale", price=float(r["price"]), currency=r.get("currency") or "USD")
            if not price_ok_for_index(f):
                continue
            area = float(r["area_sqm"]) if r.get("area_sqm") else None
            snaps.append({
                "listing_id": r["id"], "price": float(r["price"]), "currency": "USD",
                "city": r.get("city"), "state": r.get("state"), "property_type": r.get("property_type"),
                "bedrooms": r.get("bedrooms"), "area_sqm": area,
                "price_per_sqm": round(float(r["price"]) / area, 2) if area else None,
                "recorded_at": today.isoformat(), "run_type": "full",
            })
        if self.dry_run:
            self._count("price_snapshots", len(snaps))
            return len(snaps)
        written = 0
        for batch in chunks(snaps, 500):
            try:
                self.client.table("price_history").upsert(batch, on_conflict="listing_id,recorded_at").execute()
                written += len(batch)
            except Exception as e:
                self.errors.append(f"price_history upsert: {e}")
                break
        logger.info(f"price snapshot: {written}/{len(snaps)} rows written")
        return written

    # ------------------------------------------------------------------ run log
    def log_run(self, rec: dict):
        rec = dict(rec, dry_run=self.dry_run)
        wrote_db = False
        if self.has_scrape_runs and not self.dry_run:
            try:
                cols = {k: rec.get(k) for k in (
                    "source", "started_at", "finished_at", "status", "found", "new", "updated",
                    "seen", "expired", "reactivated", "errors", "fetched", "notes")}
                cols["notes"] = json.loads(json.dumps(rec.get("notes") or {}, default=str))
                self.client.table("scrape_runs").insert(cols).execute()
                wrote_db = True
            except Exception as e:
                logger.warning(f"scrape_runs insert failed, using the local log: {e}")
        if self.run_log_dir and not wrote_db:
            self.run_log_dir.mkdir(parents=True, exist_ok=True)
            p = self.run_log_dir / f"runs-{datetime.now(timezone.utc):%Y-%m}.jsonl"
            with p.open("a") as fh:
                fh.write(json.dumps(rec, default=str) + "\n")
