"""Abstract base class for property scrapers."""

import time
import logging
from abc import ABC, abstractmethod
from typing import List, Generator

from ..models.listing import PropertyListing
from ..extractors.firecrawl_extractor import FirecrawlExtractor

logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """Abstract base class for property scrapers."""

    def __init__(
        self, extractor: FirecrawlExtractor, rate_limit_seconds: float = 2.0
    ):
        """Initialize the scraper."""
        self.extractor = extractor
        self.rate_limit_seconds = rate_limit_seconds

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Unique identifier for this scraper source."""
        pass

    @property
    @abstractmethod
    def base_url(self) -> str:
        """Base URL for the property listing site."""
        pass

    @abstractmethod
    def get_page_urls(self) -> Generator[str, None, None]:
        """Generate URLs for all pages to scrape."""
        pass

    def scrape_all(self, max_pages: int = 20) -> List[PropertyListing]:
        """Scrape all pages and return validated listings."""
        all_listings: List[PropertyListing] = []
        pages_scraped = 0

        for url in self.get_page_urls():
            if pages_scraped >= max_pages:
                logger.info(f"Reached max pages limit ({max_pages})")
                break

            try:
                listings = self.extractor.extract_listings(url)
                all_listings.extend(listings)
                pages_scraped += 1

                logger.info(
                    f"Page {pages_scraped}: Got {len(listings)} listings from {url}"
                )

                # Rate limiting
                if pages_scraped < max_pages:
                    time.sleep(self.rate_limit_seconds)

            except Exception as e:
                logger.error(f"Failed to scrape {url}: {e}")
                continue

        logger.info(
            f"Scraping complete: {len(all_listings)} total listings from {pages_scraped} pages"
        )
        return all_listings
