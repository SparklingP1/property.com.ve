"""Supabase client for property listing storage."""

import os
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from supabase import create_client, Client

logger = logging.getLogger(__name__)


class SupabaseStorage:
    """Supabase client for property listing storage."""

    TABLE_NAME = "listings"

    def __init__(self):
        """Initialize Supabase client."""
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")

        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY environment variables are required")

        self.client: Client = create_client(url, key)

    def upsert_listings(
        self, listings: List[Dict[str, Any]], source: str, scrape_run_id: str
    ) -> Dict[str, int]:
        """
        Upsert listings using source_url as unique constraint.

        - If source_url exists: UPDATE with new data + last_seen_at
        - If source_url new: INSERT new record
        """
        if not listings:
            return {"upserted": 0, "errors": 0}

        now = datetime.utcnow().isoformat()
        upserted = 0
        errors = 0

        for listing in listings:
            try:
                # Prepare listing data
                data = {
                    "source": source,
                    "source_url": listing.get("source_url"),
                    "title": listing.get("title"),
                    "price": listing.get("price"),
                    "currency": listing.get("currency", "USD"),
                    "location": listing.get("location"),
                    "region": self._extract_region(listing.get("location", "")),
                    "bedrooms": listing.get("bedrooms"),
                    "bathrooms": listing.get("bathrooms"),
                    "area_sqm": listing.get("area_sqm"),
                    "thumbnail_url": listing.get("thumbnail_url"),
                    "description_short": listing.get("description", "")[:200] if listing.get("description") else None,
                    "property_type": listing.get("property_type"),
                    "scraped_at": now,
                    "last_seen_at": now,
                    "active": True,
                }

                # Upsert with conflict on source_url
                self.client.table(self.TABLE_NAME).upsert(
                    data, on_conflict="source_url"
                ).execute()

                upserted += 1

            except Exception as e:
                logger.error(f"Failed to upsert listing: {e}")
                errors += 1

        logger.info(f"Upserted {upserted} listings, {errors} errors")
        return {"upserted": upserted, "errors": errors}

    def mark_stale_listings(self, source: str, stale_after_days: int = 14) -> int:
        """
        Mark listings as inactive if not seen in consecutive scrapes.

        Logic: Find listings where last_seen_at is older than stale_after_days
        and mark active = False.
        """
        cutoff_date = datetime.utcnow() - timedelta(days=stale_after_days)

        try:
            result = (
                self.client.table(self.TABLE_NAME)
                .update({"active": False})
                .eq("source", source)
                .eq("active", True)
                .lt("last_seen_at", cutoff_date.isoformat())
                .execute()
            )

            count = len(result.data) if result.data else 0
            logger.info(f"Marked {count} stale listings as inactive for source: {source}")
            return count

        except Exception as e:
            logger.error(f"Failed to mark stale listings: {e}")
            return 0

    def get_scrape_stats(self, source: str) -> Dict[str, int]:
        """Get statistics for a source."""
        try:
            # Count active listings
            active_result = (
                self.client.table(self.TABLE_NAME)
                .select("id", count="exact")
                .eq("source", source)
                .eq("active", True)
                .execute()
            )

            # Count inactive listings
            inactive_result = (
                self.client.table(self.TABLE_NAME)
                .select("id", count="exact")
                .eq("source", source)
                .eq("active", False)
                .execute()
            )

            return {
                "active": active_result.count or 0,
                "inactive": inactive_result.count or 0,
            }

        except Exception as e:
            logger.error(f"Failed to get scrape stats: {e}")
            return {"active": 0, "inactive": 0}

    def _extract_region(self, location: str) -> str:
        """Extract region from location string."""
        if not location:
            return ""

        # Common Venezuelan regions
        regions = [
            "Caracas",
            "Miranda",
            "Zulia",
            "Carabobo",
            "Lara",
            "Aragua",
            "Nueva Esparta",
            "Anzoategui",
            "Bolivar",
            "Merida",
            "Tachira",
            "Falcon",
            "Portuguesa",
            "Barinas",
            "Guarico",
            "Monagas",
            "Sucre",
            "Vargas",
            "Yaracuy",
            "Delta Amacuro",
            "Amazonas",
            "Apure",
            "Cojedes",
            "Trujillo",
        ]

        location_lower = location.lower()
        for region in regions:
            if region.lower() in location_lower:
                return region

        return ""
