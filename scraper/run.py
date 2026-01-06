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

from playwright.sync_api import sync_playwright, Browser, Page
from bs4 import BeautifulSoup
from supabase import create_client, Client
from pydantic import BaseModel, Field, field_validator
from tenacity import retry, stop_after_attempt, wait_exponential
import re

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
# Playwright Extractor
# =============================================================================

class PlaywrightExtractor:
    """Extract listings using Playwright and BeautifulSoup - $0 cost!"""

    def __init__(self):
        self.browser: Browser = None
        self.playwright = None

    def __enter__(self):
        """Context manager entry - start browser."""
        self.playwright = sync_playwright().start()
        self.browser = self.playwright.chromium.launch(headless=True)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - close browser."""
        if self.browser:
            self.browser.close()
        if self.playwright:
            self.playwright.stop()

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
    def extract_listings(self, url: str, base_url: str) -> List[PropertyListing]:
        """Extract ALL listings from a BienesOnline page."""
        logger.info(f"Scraping: {url}")

        try:
            # Load page with Playwright
            page = self.browser.new_page()
            page.goto(url, wait_until="networkidle")
            html = page.content()
            page.close()

            # Parse with BeautifulSoup
            soup = BeautifulSoup(html, 'lxml')
            listings = []

            # Find all property cards - BienesOnline specific selectors
            # Properties are in article or div elements with links to ficha-casa pages
            property_links = soup.find_all('a', href=re.compile(r'/ficha-casa-venta-.*_CAV\d+\.php'))

            logger.info(f"Found {len(property_links)} potential property links")

            # Process each unique property (avoid duplicates)
            seen_urls = set()
            for link in property_links:
                try:
                    source_url = link.get('href', '')
                    if not source_url or source_url in seen_urls:
                        continue

                    seen_urls.add(source_url)

                    # Make URL absolute
                    if not source_url.startswith('http'):
                        source_url = f"{base_url.rstrip('/')}/{source_url.lstrip('/')}"

                    # For BienesOnline, the link itself and its siblings contain the data
                    # Extract data from link + siblings
                    raw_data = self._parse_bienes_online_link(link, source_url, base_url)

                    # Debug logging
                    if not raw_data:
                        logger.warning(f"No data extracted for {source_url}")
                    elif not raw_data.get('title'):
                        logger.warning(f"No title for {source_url}, data: {raw_data}")
                    else:
                        listing = PropertyListing(**raw_data)
                        listings.append(listing)
                        logger.info(f"Extracted: {listing.title[:50]}...")

                except Exception as e:
                    logger.warning(f"Failed to parse property {source_url}: {e}")
                    continue

            logger.info(f"Successfully extracted {len(listings)} listings")
            return listings

        except Exception as e:
            logger.error(f"Extraction failed: {e}")
            raise

    def _parse_bienes_online_link(self, link, source_url: str, base_url: str) -> dict:
        """Parse a single property from BienesOnline link and siblings."""
        data = {"source_url": source_url}

        # Title - try multiple strategies
        title = None

        # Strategy 1: Look for h2, h3, h4, or strong tag
        title_elem = link.find(['h2', 'h3', 'h4', 'strong'])
        if title_elem:
            title = title_elem.get_text(strip=True)

        # Strategy 2: Get all text from the link (excluding img alt text)
        if not title:
            # Remove img tags to avoid getting alt text
            link_copy = str(link)
            from bs4 import BeautifulSoup as BS
            temp_soup = BS(link_copy, 'lxml')
            for img in temp_soup.find_all('img'):
                img.decompose()
            title = temp_soup.get_text(strip=True)

        # Strategy 3: Get the alt text from image as last resort
        if not title or len(title) < 5:
            img = link.find('img')
            if img and img.get('alt'):
                title = img.get('alt')

        if title:
            data['title'] = title

        # Image - get from img inside the link
        img = link.find('img')
        if img:
            img_url = img.get('src', '')
            if img_url:
                if not img_url.startswith('http'):
                    img_url = f"{base_url.rstrip('/')}/{img_url.lstrip('/')}"
                data['image_urls'] = [img_url]

        # Get all sibling paragraph tags after the link for price, location, specs
        parent = link.parent
        if parent:
            # Get all text from parent and siblings
            all_text = parent.get_text()

            # Also check for <li> elements with specs
            li_elements = parent.find_all('li')
            for li in li_elements:
                li_text = li.get_text(strip=True)

                # Bedrooms
                if 'habitaciones' in li_text.lower():
                    bed_match = re.search(r'(\d+)', li_text)
                    if bed_match:
                        data['bedrooms'] = int(bed_match.group(1))

                # Bathrooms
                if 'baños' in li_text.lower() or 'banos' in li_text.lower():
                    bath_match = re.search(r'(\d+)', li_text)
                    if bath_match:
                        data['bathrooms'] = int(bath_match.group(1))

                # Area
                if 'm2' in li_text or 'm²' in li_text:
                    area_match = re.search(r'(\d+)', li_text)
                    if area_match:
                        data['area_sqm'] = float(area_match.group(1))

            # Price - look for "U$D" pattern
            price_match = re.search(r'U\$D\s*([\d,.]+)', all_text)
            if price_match:
                try:
                    price_str = price_match.group(1).replace('.', '').replace(',', '')
                    data['price'] = float(price_str)
                    data['currency'] = 'USD'
                except:
                    pass

            # Location - look for "Casa en Venta en [location]" pattern
            location_match = re.search(r'(?:Casa|Apartamento|Terreno)\s+en\s+Venta\s+en\s+([^,\n]+)', all_text, re.I)
            if location_match:
                data['location'] = location_match.group(1).strip()

        # Property type - infer from URL
        if 'casa' in source_url.lower():
            data['property_type'] = 'house'
        elif 'apartamento' in source_url.lower():
            data['property_type'] = 'apartment'
        elif 'terreno' in source_url.lower():
            data['property_type'] = 'land'

        return data


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
    extractor: PlaywrightExtractor,
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

    # Initialize storage
    storage = SupabaseStorage()
    results = []

    # Use Playwright extractor as context manager
    with PlaywrightExtractor() as extractor:
        # Scrape BienesOnline only
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
