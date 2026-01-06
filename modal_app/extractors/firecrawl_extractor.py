"""Firecrawl-based property listing extractor."""

import os
import logging
from typing import List, Optional
from firecrawl import FirecrawlApp
from tenacity import retry, stop_after_attempt, wait_exponential

from ..models.listing import PropertyListing

logger = logging.getLogger(__name__)


class FirecrawlExtractor:
    """Firecrawl-based property listing extractor using AI extraction."""

    # Schema definition for Firecrawl extraction
    LISTING_SCHEMA = {
        "type": "object",
        "properties": {
            "listings": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "price": {"type": "number"},
                        "currency": {"type": "string"},
                        "location": {"type": "string"},
                        "bedrooms": {"type": "number"},
                        "bathrooms": {"type": "number"},
                        "area_sqm": {"type": "number"},
                        "thumbnail_url": {"type": "string"},
                        "description": {"type": "string"},
                        "source_url": {"type": "string"},
                        "property_type": {"type": "string"},
                    },
                    "required": ["title", "source_url"],
                },
            }
        },
    }

    EXTRACTION_PROMPT = """
    Extract all property listings from this real estate page.
    For each listing, extract:
    - title: The property title or headline
    - price: Numeric price value (without currency symbol)
    - currency: Currency code (USD, EUR, VES, etc.)
    - location: Full address or location description
    - bedrooms: Number of bedrooms
    - bathrooms: Number of bathrooms
    - area_sqm: Area in square meters
    - thumbnail_url: URL of the property image
    - description: Brief description (max 200 chars)
    - source_url: Link to the full property listing page (must be absolute URL)
    - property_type: Type of property (apartment, house, land, commercial, office)

    Make sure source_url is the full URL to the individual property page, not the current page URL.
    """

    def __init__(self, proxy_url: Optional[str] = None):
        """Initialize the Firecrawl extractor."""
        api_key = os.environ.get("FIRECRAWL_API_KEY")
        if not api_key:
            raise ValueError("FIRECRAWL_API_KEY environment variable is required")

        self.client = FirecrawlApp(api_key=api_key)
        self.proxy_url = proxy_url

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=30),
    )
    def extract_listings(self, url: str) -> List[PropertyListing]:
        """Extract property listings from a single page."""
        logger.info(f"Extracting listings from: {url}")

        try:
            # Use Firecrawl's extract method with schema
            result = self.client.scrape_url(
                url,
                params={
                    "formats": ["extract"],
                    "extract": {
                        "schema": self.LISTING_SCHEMA,
                        "prompt": self.EXTRACTION_PROMPT,
                    },
                },
            )

            if not result or "extract" not in result:
                logger.warning(f"No extraction result for: {url}")
                return []

            extracted = result.get("extract", {})
            raw_listings = extracted.get("listings", [])

            # Validate and convert to PropertyListing objects
            validated_listings = []
            for raw in raw_listings:
                try:
                    # Ensure source_url is absolute
                    source_url = raw.get("source_url", "")
                    if source_url and not source_url.startswith("http"):
                        # Make relative URL absolute
                        base_url = url.rsplit("/", 1)[0]
                        source_url = f"{base_url}/{source_url.lstrip('/')}"
                        raw["source_url"] = source_url

                    listing = PropertyListing(**raw)
                    validated_listings.append(listing)
                except Exception as e:
                    logger.warning(f"Failed to validate listing: {e}")
                    continue

            logger.info(f"Extracted {len(validated_listings)} listings from: {url}")
            return validated_listings

        except Exception as e:
            logger.error(f"Extraction failed for {url}: {e}")
            raise
