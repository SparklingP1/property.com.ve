#!/usr/bin/env python3
"""
Standalone scraper for Property.com.ve
Runs via GitHub Actions on a weekly schedule.
"""

import os
import sys
import logging
import uuid
import time
from datetime import datetime, timedelta
from typing import List, Optional, Generator
from dataclasses import dataclass

from firecrawl import Firecrawl
from supabase import create_client, Client
from pydantic import BaseModel, Field, field_validator
from tenacity import retry, stop_after_attempt, wait_exponential

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


# =============================================================================
# Models
# =============================================================================

class PropertyListing(BaseModel):
    """Validated property listing schema."""

    title: str = Field(..., min_length=1, max_length=500)
    price: Optional[float] = Field(None, ge=0)
    currency: str = Field(default="USD")
    location: Optional[str] = Field(None)
    bedrooms: Optional[int] = Field(None, ge=0, le=50)
    bathrooms: Optional[int] = Field(None, ge=0, le=50)
    area_sqm: Optional[float] = Field(None, ge=0)
    thumbnail_url: Optional[str] = Field(None)
    description: Optional[str] = Field(None)
    source_url: str = Field(..., min_length=10)
    property_type: Optional[str] = Field(None)
    image_urls: Optional[list] = Field(default_factory=list)

    @field_validator("description", mode="before")
    @classmethod
    def truncate_description(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 200:
            return v[:197] + "..."
        return v

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, v: Optional[str]) -> str:
        if not v:
            return "USD"
        v = v.upper().strip()
        currency_map = {"€": "EUR", "$": "USD", "EUROS": "EUR", "BS": "VES"}
        return currency_map.get(v, v) if len(v) <= 5 else "USD"


# =============================================================================
# Firecrawl Extractor
# =============================================================================

class FirecrawlExtractor:
    """Extract listings using Firecrawl AI."""

    # Full schema with all details
    LISTING_SCHEMA = {
        "type": "object",
        "properties": {
            "title": {"type": "string", "description": "Property title/headline"},
            "price": {"type": "number", "description": "Price as number"},
            "currency": {"type": "string", "description": "Currency code like USD, EUR, VES"},
            "source_url": {"type": "string", "description": "URL to property details"},
            "location": {"type": "string", "description": "Full address or area"},
            "bedrooms": {"type": "number", "description": "Number of bedrooms"},
            "bathrooms": {"type": "number", "description": "Number of bathrooms"},
            "area_sqm": {"type": "number", "description": "Area in square meters"},
            "property_type": {"type": "string", "description": "Type: house, apartment, land, etc"},
            "description": {"type": "string", "description": "Brief description"},
            "image_urls": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Array of photo URLs"
            },
        },
        "required": ["title", "source_url"],
    }

    EXTRACTION_PROMPT = """
    Extract ONE property listing from this page with ALL available details.

    Extract:
    - title: Property headline
    - price: Numeric price (no currency symbols)
    - currency: Currency code (USD, EUR, VES, etc)
    - source_url: URL to the property page
    - location: Address or location area
    - bedrooms: Number of bedrooms
    - bathrooms: Number of bathrooms
    - area_sqm: Property area in square meters
    - property_type: house, apartment, land, commercial, etc
    - description: Brief property description
    - image_urls: Array of ALL photo/image URLs for this property

    Extract as much data as available. Some fields may be missing.
    """

    def __init__(self):
        api_key = os.environ.get("FIRECRAWL_API_KEY")
        if not api_key:
            raise ValueError("FIRECRAWL_API_KEY environment variable required")
        self.client = Firecrawl(api_key=api_key)

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
    def extract_listings(self, url: str, base_url: str) -> List[PropertyListing]:
        """Extract listings from a page."""
        logger.info(f"Extracting: {url}")

        try:
            # Use Firecrawl extract() method - extract ONE listing
            result = self.client.extract(
                urls=[url],
                prompt=self.EXTRACTION_PROMPT,
                schema=self.LISTING_SCHEMA
            )

            # Debug logging
            logger.info(f"Firecrawl response type: {type(result)}")

            # Extract data - result should have .data attribute
            extract_data = result.data if hasattr(result, 'data') else result
            logger.info(f"Extract data type: {type(extract_data)}")
            logger.info(f"Extract data: {extract_data}")

            if not extract_data:
                logger.warning(f"No extraction result for: {url}")
                return []

            # Since we're extracting just ONE listing, wrap it in an array
            raw_listings = [extract_data] if isinstance(extract_data, dict) else []
            logger.info(f"Raw listings count: {len(raw_listings)}")
            validated = []

            for raw in raw_listings:
                try:
                    # Make source_url absolute
                    source_url = raw.get("source_url", "")
                    if source_url and not source_url.startswith("http"):
                        source_url = f"{base_url.rstrip('/')}/{source_url.lstrip('/')}"
                        raw["source_url"] = source_url

                    # Ensure required field exists
                    if not raw.get("source_url"):
                        logger.warning(f"Skipping listing without URL: {raw.get('title', 'unknown')}")
                        continue

                    listing = PropertyListing(**raw)
                    validated.append(listing)
                    logger.info(f"Validated listing: {listing.title[:50]}...")
                except Exception as e:
                    logger.warning(f"Validation failed for {raw}: {e}")

            logger.info(f"Extracted {len(validated)} listings")
            return validated

        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            raise


# =============================================================================
# Supabase Storage
# =============================================================================

class SupabaseStorage:
    """Store listings in Supabase."""

    REGIONS = [
        "Caracas", "Miranda", "Zulia", "Carabobo", "Lara", "Aragua",
        "Nueva Esparta", "Anzoategui", "Bolivar", "Merida", "Tachira",
        "Falcon", "Portuguesa", "Barinas", "Guarico", "Monagas", "Sucre",
    ]

    def __init__(self):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY required")
        self.client: Client = create_client(url, key)

    def upsert_listings(self, listings: List[PropertyListing], source: str) -> dict:
        """Upsert listings to database."""
        if not listings:
            return {"upserted": 0, "errors": 0}

        now = datetime.utcnow().isoformat()
        upserted = 0
        errors = 0

        for listing in listings:
            try:
                # Handle image URLs - use first as thumbnail, store all in array
                image_urls = getattr(listing, 'image_urls', None) or []
                thumbnail = image_urls[0] if image_urls else getattr(listing, 'thumbnail_url', None)

                data = {
                    "source": source,
                    "source_url": listing.source_url,
                    "title": listing.title,
                    "price": listing.price,
                    "currency": listing.currency,
                    "location": listing.location,
                    "region": self._extract_region(listing.location or ""),
                    "bedrooms": listing.bedrooms,
                    "bathrooms": listing.bathrooms,
                    "area_sqm": listing.area_sqm,
                    "thumbnail_url": thumbnail,
                    "description_short": listing.description,
                    "property_type": listing.property_type,
                    "image_urls": image_urls,  # Store all images
                    "scraped_at": now,
                    "last_seen_at": now,
                    "active": True,
                }

                self.client.table("listings").upsert(
                    data, on_conflict="source_url"
                ).execute()
                upserted += 1

            except Exception as e:
                logger.error(f"Upsert failed: {e}")
                errors += 1

        return {"upserted": upserted, "errors": errors}

    def mark_stale_listings(self, source: str, days: int = 14) -> int:
        """Mark old listings as inactive."""
        cutoff = (datetime.utcnow() - timedelta(days=days)).isoformat()

        try:
            result = (
                self.client.table("listings")
                .update({"active": False})
                .eq("source", source)
                .eq("active", True)
                .lt("last_seen_at", cutoff)
                .execute()
            )
            count = len(result.data) if result.data else 0
            logger.info(f"Marked {count} stale listings for {source}")
            return count
        except Exception as e:
            logger.error(f"Failed to mark stale: {e}")
            return 0

    def _extract_region(self, location: str) -> str:
        location_lower = location.lower()
        for region in self.REGIONS:
            if region.lower() in location_lower:
                return region
        return ""


# =============================================================================
# Scrapers
# =============================================================================

@dataclass
class ScraperConfig:
    name: str
    source_id: str
    base_url: str
    page_urls: List[str]


def get_green_acres_config() -> ScraperConfig:
    """Green-Acres Venezuela scraper config - DISABLED FOR NOW."""
    base = "https://ve.green-acres.com"
    urls = []
    # Disabled - focusing on BienesOnline first

    return ScraperConfig(
        name="Green-Acres",
        source_id="green-acres",
        base_url=base,
        page_urls=urls
    )


def get_bienes_online_config() -> ScraperConfig:
    """BienesOnline Venezuela scraper config."""
    base = "https://venezuela.bienesonline.com"
    urls = []

    # Start with just 1 URL for testing to save credits
    urls.append(f"{base}/casas")

    return ScraperConfig(
        name="BienesOnline",
        source_id="bienesonline",
        base_url=base,
        page_urls=urls
    )


def scrape_source(
    config: ScraperConfig,
    extractor: FirecrawlExtractor,
    storage: SupabaseStorage,
    rate_limit: float = 10.0
) -> dict:
    """Scrape a single source."""
    logger.info(f"Starting scrape: {config.name}")

    all_listings: List[PropertyListing] = []

    for i, url in enumerate(config.page_urls):
        try:
            listings = extractor.extract_listings(url, config.base_url)
            all_listings.extend(listings)

            if i < len(config.page_urls) - 1:
                time.sleep(rate_limit)

        except Exception as e:
            logger.error(f"Failed {url}: {e}")
            continue

    # Store in Supabase
    result = storage.upsert_listings(all_listings, config.source_id)

    # Mark stale
    stale = storage.mark_stale_listings(config.source_id)

    return {
        "source": config.name,
        "scraped": len(all_listings),
        "upserted": result["upserted"],
        "errors": result["errors"],
        "marked_stale": stale,
    }


# =============================================================================
# Main
# =============================================================================

def main():
    """Run the scraper."""
    logger.info("=" * 60)
    logger.info("Property.com.ve Scraper Starting")
    logger.info(f"Time: {datetime.utcnow().isoformat()}")
    logger.info("=" * 60)

    # Initialize
    extractor = FirecrawlExtractor()
    storage = SupabaseStorage()

    results = []

    # Skip Green-Acres for now - focus on BienesOnline
    # try:
    #     config = get_green_acres_config()
    #     result = scrape_source(config, extractor, storage)
    #     results.append(result)
    #     logger.info(f"Green-Acres result: {result}")
    # except Exception as e:
    #     logger.error(f"Green-Acres failed: {e}")
    #     results.append({"source": "Green-Acres", "error": str(e)})

    # Scrape BienesOnline
    try:
        config = get_bienes_online_config()
        result = scrape_source(config, extractor, storage)
        results.append(result)
        logger.info(f"BienesOnline result: {result}")
    except Exception as e:
        logger.error(f"BienesOnline failed: {e}")
        results.append({"source": "BienesOnline", "error": str(e)})

    # Summary
    logger.info("=" * 60)
    logger.info("SCRAPE COMPLETE")
    for r in results:
        logger.info(f"  {r}")
    logger.info("=" * 60)

    # Exit with error if all sources failed
    if all("error" in r for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
