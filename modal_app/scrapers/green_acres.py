"""Scraper for Green-Acres Venezuela."""

import logging
from typing import Generator

from .base import BaseScraper

logger = logging.getLogger(__name__)


class GreenAcresScraper(BaseScraper):
    """Scraper for ve.green-acres.com property listings."""

    @property
    def source_name(self) -> str:
        return "green-acres"

    @property
    def base_url(self) -> str:
        return "https://ve.green-acres.com"

    # Pagination configuration
    LISTINGS_PER_PAGE = 24
    MAX_PAGES = 20  # Safety limit

    def get_page_urls(self) -> Generator[str, None, None]:
        """Generate paginated URLs for Green-Acres listings."""
        # Green-Acres uses page parameter for pagination
        # URL pattern: /en/properties/buy?page=N

        # Property types to scrape
        property_types = [
            "houses-for-sale",
            "apartments-for-sale",
            "land-for-sale",
        ]

        for prop_type in property_types:
            for page in range(1, self.MAX_PAGES + 1):
                url = f"{self.base_url}/en/{prop_type}"
                if page > 1:
                    url += f"?page={page}"
                yield url

    def get_extraction_prompt(self) -> str:
        """Return site-specific extraction prompt."""
        return """
        Extract property listings from this Green-Acres Venezuela page.
        Prices are typically shown in EUR (€) or USD ($).
        Location format includes city and state in Venezuela.
        Source URLs should be full URLs to individual property pages on ve.green-acres.com.
        Property types: house, apartment, land, commercial.
        """
