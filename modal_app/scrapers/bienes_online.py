"""Scraper for BienesOnline Venezuela."""

import logging
from typing import Generator

from .base import BaseScraper

logger = logging.getLogger(__name__)


class BienesOnlineScraper(BaseScraper):
    """Scraper for venezuela.bienesonline.com listings."""

    @property
    def source_name(self) -> str:
        return "bienesonline"

    @property
    def base_url(self) -> str:
        return "https://venezuela.bienesonline.com"

    # Configuration
    MAX_PAGES = 20  # Safety limit

    def get_page_urls(self) -> Generator[str, None, None]:
        """
        Generate URLs for BienesOnline listings.

        BienesOnline has category and state-specific pages.
        We scrape the main category landing pages.
        """
        # Property categories
        categories = [
            "casas",
            "apartamentos",
            "terrenos",
            "oficinas",
            "locales-comerciales",
        ]

        # Venezuelan states (most populous)
        states = [
            "miranda",
            "distrito-capital",
            "zulia",
            "carabobo",
            "lara",
            "aragua",
            "nueva-esparta",
            "anzoategui",
            "bolivar",
            "merida",
        ]

        # Main category pages
        for category in categories:
            yield f"{self.base_url}/{category}"

        # State-specific pages for houses and apartments
        for state in states:
            yield f"{self.base_url}/casas/venta/{state}"
            yield f"{self.base_url}/apartamentos/venta/{state}"

    def get_extraction_prompt(self) -> str:
        """Return site-specific extraction prompt."""
        return """
        Extract property listings from this BienesOnline Venezuela page.
        Prices are typically shown in USD ($) or VES (Bs).
        Location format includes city and state in Venezuela.
        Source URLs should be full URLs to individual property pages on bienesonline.com.
        Property types: casa (house), apartamento (apartment), terreno (land),
        oficina (office), local comercial (commercial).
        """
