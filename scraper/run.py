#!/usr/bin/env python3
"""
Standalone scraper for Property.com.ve
Runs via GitHub Actions on a weekly schedule.
Supports distributed scraping with page ranges for high-volume sources.
"""

import os
import sys
import logging
import uuid
import time
import argparse
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Generator, Tuple
from dataclasses import dataclass

from playwright.sync_api import sync_playwright, Browser, Page
from bs4 import BeautifulSoup
from supabase import create_client, Client
from pydantic import BaseModel, Field, field_validator
from tenacity import retry, stop_after_attempt, wait_exponential
import re
import httpx
import hashlib
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Import translator for English conversion
try:
    from translator import PropertyTranslator
    TRANSLATION_ENABLED = True
except ImportError:
    TRANSLATION_ENABLED = False
    logger.warning("Translation module not available - listings will be stored in Spanish")


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

    # Enhanced fields for Rent-A-House and others
    parking_spaces: Optional[int] = Field(None, ge=0, le=100)
    condition: Optional[str] = Field(None)
    furnished: Optional[bool] = Field(None)
    transaction_type: Optional[str] = Field(None)  # 'sale' or 'rent'
    property_style: Optional[str] = Field(None)
    city: Optional[str] = Field(None)
    neighborhood: Optional[str] = Field(None)
    state: Optional[str] = Field(None)
    total_area_sqm: Optional[float] = Field(None, ge=0)
    land_area_sqm: Optional[float] = Field(None, ge=0)
    amenities: Optional[list] = Field(default_factory=list)
    features: Optional[dict] = Field(default_factory=dict)
    agent_name: Optional[str] = Field(None)
    agent_office: Optional[str] = Field(None)
    reference_code: Optional[str] = Field(None)
    photo_count: Optional[int] = Field(None, ge=0)
    description_full: Optional[str] = Field(None)

    # Extended fields (multi-source)
    latitude: Optional[float] = Field(None)
    longitude: Optional[float] = Field(None)
    construction_years: Optional[int] = Field(None, ge=0)
    price_per_sqm: Optional[float] = Field(None, ge=0)
    street_address: Optional[str] = Field(None)
    postal_code: Optional[str] = Field(None)
    has_360_tour: Optional[bool] = Field(default=False)
    has_video: Optional[bool] = Field(default=False)
    agent_phone: Optional[str] = Field(None)
    agent_email: Optional[str] = Field(None)
    agent_whatsapp: Optional[str] = Field(None)

    # English translations (for international buyers)
    title_en: Optional[str] = Field(None)
    description_short_en: Optional[str] = Field(None)
    description_full_en: Optional[str] = Field(None)

    # Spanish originals (preserved for reference)
    title_es: Optional[str] = Field(None)
    description_short_es: Optional[str] = Field(None)
    description_full_es: Optional[str] = Field(None)

    # Translation metadata
    translation_model: Optional[str] = Field(None)

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

    def __init__(self, storage=None):
        self.browser: Browser = None
        self.playwright = None
        self.translator = None
        self.storage = storage
        self.remax_seen_ids: set = set()  # Dedup RE/MAX listings across location queries

        # Initialize translator if enabled
        if TRANSLATION_ENABLED:
            try:
                self.translator = PropertyTranslator()
                logger.info("✅ Translation enabled - listings will be converted to English")
                logger.info("💡 Smart translation: Only new/changed listings will be translated")
            except Exception as e:
                logger.warning(f"Translation initialization failed: {e}")
                self.translator = None

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

    def needs_translation(self, source_url: str, title: str, description_full: str) -> Tuple[bool, dict]:
        """Check if a listing needs translation.

        Returns True if:
        - Listing doesn't exist in database (new listing)
        - Listing exists but Spanish content has changed
        - Listing exists but has no English translation

        Args:
            source_url: The listing's source URL (unique identifier)
            title: Current Spanish title
            description_full: Current Spanish full description

        Returns:
            tuple: (needs_translation: bool, existing_translations: dict)
        """
        if not self.storage:
            # No storage connection - translate everything
            return True, {}

        try:
            # Query database for existing listing
            result = self.storage.client.table("listings").select(
                "title_en, title_es, description_short_en, description_full_en, description_full_es, translation_model"
            ).eq("source_url", source_url).single().execute()

            existing = result.data if result.data else None

            if not existing:
                # New listing - needs translation
                logger.debug(f"New listing, needs translation: {source_url}")
                return True, {}

            # Check if already translated
            if not existing.get('title_en'):
                # Exists but not translated - needs translation
                logger.debug(f"Untranslated listing, needs translation: {source_url}")
                return True, {}

            # Check if Spanish content changed
            title_changed = existing.get('title_es') != title
            desc_changed = existing.get('description_full_es') != description_full

            if title_changed or desc_changed:
                # Content changed - needs re-translation
                logger.info(f"Content changed, needs re-translation: {source_url}")
                return True, {}

            # Already translated and content unchanged - return existing translations
            logger.debug(f"Already translated, skipping: {source_url}")
            existing_translations = {
                'title_en': existing.get('title_en'),
                'description_short_en': existing.get('description_short_en'),
                'description_full_en': existing.get('description_full_en'),
                'translation_model': existing.get('translation_model')
            }
            return False, existing_translations

        except Exception as e:
            # On error, default to translating (safe fallback)
            logger.debug(f"Error checking translation status, defaulting to translate: {e}")
            return True, {}

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
    def extract_listings(self, url: str, base_url: str) -> List[PropertyListing]:
        """Extract ALL listings from a BienesOnline page."""
        logger.info(f"Scraping: {url}")

        try:
            # Load page with Playwright
            page = self.browser.new_page()
            page.goto(url, wait_until="domcontentloaded")
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

        # Find the property card container (go up to div/article parent)
        card = link.find_parent(['div', 'article'])
        if not card:
            card = link.parent

        # Title - look for h2/h3 in the card
        title_elem = card.find(['h2', 'h3', 'h4']) if card else link.find(['h2', 'h3', 'h4'])
        if title_elem:
            data['title'] = title_elem.get_text(strip=True)
        elif link.find('img'):
            # Fallback to image alt text
            data['title'] = link.find('img').get('alt', '')

        # Image - get from img inside the card or link
        img = (card.find('img') if card else None) or link.find('img')
        if img:
            img_url = img.get('src', '')
            if img_url and not img_url.startswith(('http', 'data:', 'blob:')):
                img_url = f"{base_url.rstrip('/')}/{img_url.lstrip('/')}"
            if img_url and img_url.startswith('http'):
                data['image_urls'] = [img_url]

        # Get all text from the card
        all_text = card.get_text() if card else link.get_text()

        # Extract bedrooms, bathrooms, area from <li> elements
        if card:
            li_elements = card.find_all('li')
            for li in li_elements:
                li_text = li.get_text(strip=True).lower()

                # Bedrooms: "7 habitaciones"
                if 'habitacion' in li_text:
                    bed_match = re.search(r'(\d+)', li_text)
                    if bed_match:
                        data['bedrooms'] = int(bed_match.group(1))

                # Bathrooms: "6 baños"
                if 'baño' in li_text or 'bano' in li_text:
                    bath_match = re.search(r'(\d+)', li_text)
                    if bath_match:
                        data['bathrooms'] = int(bath_match.group(1))

                # Area: "580 m2"
                if 'm2' in li_text or 'm²' in li_text:
                    area_match = re.search(r'(\d+)', li_text)
                    if area_match:
                        data['area_sqm'] = float(area_match.group(1))

        # Fallback: extract from description text (e.g., "7 habitaciones 6 banos")
        if not data.get('bedrooms'):
            bed_match = re.search(r'(\d+)\s*habitacion', all_text, re.I)
            if bed_match:
                data['bedrooms'] = int(bed_match.group(1))

        if not data.get('bathrooms'):
            bath_match = re.search(r'(\d+)\s*baños?', all_text, re.I)
            if bath_match:
                data['bathrooms'] = int(bath_match.group(1))

        if not data.get('area_sqm'):
            area_match = re.search(r'(\d+)\s*m[2²]', all_text, re.I)
            if area_match:
                data['area_sqm'] = float(area_match.group(1))

        # Price - look for "U$D" pattern
        price_match = re.search(r'U\$D\s*([\d,.]+)', all_text)
        if price_match:
            try:
                price_str = price_match.group(1).replace('.', '').replace(',', '')
                data['price'] = float(price_str)
                data['currency'] = 'USD'
            except (ValueError, IndexError) as e:
                logger.warning(f"Failed to parse price: {e}")
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

    def extract_rentahouse_listings(
        self,
        url: str,
        base_url: str,
        max_pages: int = 5,
        start_page: int = 1,
        end_page: Optional[int] = None,
        storage=None,
        source_id: str = None
    ) -> List[PropertyListing]:
        """Extract listings from Rent-A-House with pagination support and batch uploads.

        Args:
            url: Base search URL (can include filters)
            base_url: Base domain URL
            max_pages: Maximum pages to scrape (used if end_page not specified)
            start_page: Starting page number (for distributed scraping)
            end_page: Ending page number (for distributed scraping)
            storage: SupabaseStorage instance for batch uploads
            source_id: Source identifier for database

        Returns:
            List of PropertyListing objects
        """
        actual_end_page = end_page if end_page is not None else (start_page + max_pages - 1)

        logger.info(f"Scraping Rent-A-House: {url}")
        logger.info(f"📄 Page range: {start_page} to {actual_end_page} ({actual_end_page - start_page + 1} pages)")

        all_listings = []
        batch_size = 10  # Upload every 10 pages
        total_uploaded = 0

        for page_num in range(start_page, actual_end_page + 1):
            try:
                page_start_time = time.time()

                # Append page parameter (handle existing query params)
                separator = '&' if '?' in url else '?'
                page_url = f"{url}{separator}page={page_num}"
                logger.info(f"Scraping page {page_num}: {page_url}")

                # Load page
                load_start = time.time()
                page = self.browser.new_page()
                page.goto(page_url, wait_until="domcontentloaded")
                html = page.content()
                page.close()
                load_time = time.time() - load_start
                logger.info(f"⏱️  Page load: {load_time:.2f}s")

                # Parse with BeautifulSoup
                soup = BeautifulSoup(html, 'lxml')

                # Find all property links
                # Pattern: /[property-type]_en_[sale/rental]_en_[city]_en_[neighborhood]_rah-[code].html
                property_links = soup.find_all('a', href=re.compile(r'_rah-\d+.*\.html'))

                if not property_links:
                    logger.info(f"No properties found on page {page_num}, stopping pagination")
                    break

                logger.info(f"Found {len(property_links)} property links on page {page_num}")

                # Extract unique URLs
                seen_urls = set()
                for link in property_links:
                    source_url = link.get('href', '')
                    if not source_url or source_url in seen_urls:
                        continue

                    seen_urls.add(source_url)

                    # Make URL absolute
                    if not source_url.startswith('http'):
                        source_url = f"{base_url.rstrip('/')}/{source_url.lstrip('/')}"

                    # Visit individual listing page to get all details
                    try:
                        parse_start = time.time()
                        raw_data = self._parse_rentahouse_listing(source_url, base_url)
                        parse_time = time.time() - parse_start

                        if raw_data and raw_data.get('title'):
                            logger.info(f"⏱️  Property parse: {parse_time:.2f}s")

                            # Filter: Only residential properties (apartment, house)
                            property_type = raw_data.get('property_type', '').lower()
                            if property_type not in ('apartment', 'house'):
                                logger.info(f"Skipping non-residential ({property_type}): {raw_data.get('title', '')[:60]}")
                                continue

                            # Filter: Only for-sale properties (exclude rentals)
                            transaction_type = raw_data.get('transaction_type', '').lower()
                            if transaction_type == 'rent':
                                logger.info(f"Skipping rental property: {raw_data.get('title', '')[:60]}")
                                continue

                            # Smart translation: Only translate new or changed listings
                            if self.translator:
                                try:
                                    # Check if translation is needed
                                    title = raw_data.get('title', '')
                                    desc_full = raw_data.get('description_full', '')

                                    trans_check_start = time.time()
                                    needs_trans, existing_trans = self.needs_translation(source_url, title, desc_full)
                                    trans_check_time = time.time() - trans_check_start

                                    if needs_trans:
                                        # Translate the listing
                                        trans_start = time.time()
                                        raw_data = self.translator.translate_listing(raw_data)
                                        trans_time = time.time() - trans_start
                                        logger.info(f"✅ Translated: {title[:60]}... (check: {trans_check_time:.2f}s, translate: {trans_time:.2f}s)")
                                    else:
                                        # Use existing translations from database
                                        raw_data.update(existing_trans)
                                        logger.debug(f"⏭️  Skipped translation (unchanged): {title[:60]}... (check: {trans_check_time:.2f}s)")
                                except Exception as e:
                                    logger.warning(f"Translation failed for {source_url}: {e}")

                            listing = PropertyListing(**raw_data)
                            all_listings.append(listing)
                            title_display = raw_data.get('title_en') or listing.title
                            logger.info(f"Extracted: {title_display[:60]}...")
                        else:
                            logger.warning(f"No data extracted for {source_url}")
                    except Exception as e:
                        logger.warning(f"Failed to parse {source_url}: {e}")
                        continue

                # Batch upload every 10 pages
                if storage and source_id and page_num % batch_size == 0 and all_listings:
                    logger.info(f"📦 Uploading batch of {len(all_listings)} listings after page {page_num}...")
                    upload_start = time.time()
                    result = storage.upsert_listings(all_listings, source_id)
                    upload_time = time.time() - upload_start
                    total_uploaded += result.get('upserted', 0)
                    logger.info(f"✅ Batch uploaded: {result.get('upserted', 0)} upserted, {result.get('errors', 0)} errors. Total uploaded so far: {total_uploaded} (upload time: {upload_time:.2f}s)")
                    all_listings = []  # Clear batch

                # Page timing summary
                page_total_time = time.time() - page_start_time
                logger.info(f"⏱️  Page {page_num} total: {page_total_time:.2f}s")

                # Rate limiting between pages
                if page_num < max_pages:
                    time.sleep(10)

            except Exception as e:
                logger.error(f"Failed to scrape page {page_num}: {e}")
                continue

        logger.info(f"Total Rent-A-House listings extracted: {len(all_listings)} (plus {total_uploaded} already uploaded)")
        return all_listings

    def _parse_rentahouse_listing(self, url: str, base_url: str) -> dict:
        """Parse a single Rent-A-House listing page with proper HTML structure parsing."""
        try:
            # Load listing page
            page = self.browser.new_page()
            page.goto(url, wait_until="domcontentloaded", timeout=30000)
            html = page.content()
            page.close()

            soup = BeautifulSoup(html, 'lxml')
            data = {"source_url": url}

            # Title - from meta tag or h1
            meta_title = soup.find('meta', property='og:title')
            if meta_title:
                data['title'] = meta_title.get('content', '').strip()
            else:
                h1 = soup.find('h1')
                if h1:
                    data['title'] = h1.get_text(strip=True)

            # Price - from div.price strong
            price_div = soup.find('div', class_='price')
            if price_div:
                price_strong = price_div.find('strong')
                if price_strong:
                    price_text = price_strong.get_text(strip=True)
                    # Extract currency and amount (e.g., "USD 58.000")
                    price_match = re.search(r'(USD|VES|EUR)\s*([\d,.]+)', price_text)
                    if price_match:
                        data['currency'] = price_match.group(1)
                        try:
                            # Remove thousand separators and convert
                            price_str = price_match.group(2).replace('.', '').replace(',', '')
                            data['price'] = float(price_str)
                        except (ValueError, IndexError) as e:
                            logger.warning(f"Failed to parse RentAHouse price: {e}")
                            pass

            # Extract from property-detailes-list (structured data)
            details_list = soup.find('ul', class_='property-detailes-list')
            if details_list:
                for li in details_list.find_all('li'):
                    text = li.get_text(strip=True)

                    # RAH Code
                    if 'Código RAH:' in text:
                        code_span = li.find('span', class_='float-right')
                        if code_span:
                            data['reference_code'] = code_span.get_text(strip=True)

                    # Property Type
                    elif 'Tipo de Propiedad:' in text:
                        type_span = li.find('span', class_='float-right')
                        if type_span:
                            prop_type = type_span.get_text(strip=True).lower()
                            if 'apartamento' in prop_type:
                                data['property_type'] = 'apartment'
                            elif 'casa' in prop_type:
                                data['property_type'] = 'house'
                            elif 'comercial' in prop_type or 'local' in prop_type:
                                data['property_type'] = 'commercial'
                            elif 'edificio' in prop_type:
                                data['property_type'] = 'building'
                            elif 'terreno' in prop_type:
                                data['property_type'] = 'land'
                            elif 'oficina' in prop_type:
                                data['property_type'] = 'office'

                    # Property Style
                    elif 'Estilo:' in text:
                        style_span = li.find('span', class_='float-right')
                        if style_span:
                            data['property_style'] = style_span.get_text(strip=True)

                    # Private Area
                    elif 'Área Privada:' in text:
                        area_span = li.find('span', class_='float-right')
                        if area_span:
                            area_text = area_span.get_text(strip=True)
                            area_match = re.search(r'(\d+)\s*m', area_text)
                            if area_match:
                                data['area_sqm'] = float(area_match.group(1))

                    # Total Area
                    elif 'Área Total:' in text or 'Área Construida:' in text:
                        area_span = li.find('span', class_='float-right')
                        if area_span:
                            area_text = area_span.get_text(strip=True)
                            area_match = re.search(r'(\d+)\s*m', area_text)
                            if area_match:
                                data['total_area_sqm'] = float(area_match.group(1))

                    # Land Area
                    elif 'Área del Terreno:' in text:
                        area_span = li.find('span', class_='float-right')
                        if area_span:
                            area_text = area_span.get_text(strip=True)
                            area_match = re.search(r'(\d+)\s*m', area_text)
                            if area_match:
                                data['land_area_sqm'] = float(area_match.group(1))

                    # Condition
                    elif 'Estado Del Inmueble:' in text:
                        condition_span = li.find('span', class_='float-right')
                        if condition_span:
                            condition = condition_span.get_text(strip=True).lower()
                            if 'usado' in condition:
                                data['condition'] = 'used'
                            elif 'nuevo' in condition:
                                data['condition'] = 'new'

                    # Bedrooms
                    elif 'Dormitorios:' in text or 'Habitaciones:' in text:
                        bed_span = li.find('span', class_='float-right')
                        if bed_span:
                            bed_text = bed_span.get_text(strip=True)
                            bed_match = re.search(r'(\d+)', bed_text)
                            if bed_match:
                                data['bedrooms'] = int(bed_match.group(1))

                    # Bathrooms
                    elif 'Total Baños:' in text:
                        bath_span = li.find('span', class_='float-right')
                        if bath_span:
                            bath_text = bath_span.get_text(strip=True)
                            bath_match = re.search(r'(\d+)', bath_text)
                            if bath_match:
                                data['bathrooms'] = int(bath_match.group(1))

                    # Parking
                    elif 'Puestos De Estacionamiento:' in text:
                        parking_span = li.find('span', class_='float-right')
                        if parking_span:
                            parking_text = parking_span.get_text(strip=True)
                            parking_match = re.search(r'(\d+)', parking_text)
                            if parking_match:
                                data['parking_spaces'] = int(parking_match.group(1))

                    # Furnished
                    elif 'Amoblado:' in text:
                        furnished_span = li.find('span', class_='float-right')
                        if furnished_span:
                            furnished_text = furnished_span.get_text(strip=True).lower()
                            data['furnished'] = 'sí' in furnished_text or 'si' in furnished_text

            # Transaction type from URL
            if '_venta_' in url:
                data['transaction_type'] = 'sale'
            elif '_alquiler_' in url or '_arriendo_' in url:
                data['transaction_type'] = 'rent'

            # Location details
            location_section = soup.find('h2', text='Ubicación')
            if location_section:
                location_list = location_section.find_next('ul', class_='property-detailes-list-min')
                if location_list:
                    for li in location_list.find_all('li'):
                        text = li.get_text(strip=True)

                        if 'Estado:' in text:
                            state_span = li.find('span', class_='float-right')
                            if state_span:
                                data['state'] = state_span.get_text(strip=True)

                        elif 'Ciudad:' in text:
                            city_span = li.find('span', class_='float-right')
                            if city_span:
                                data['city'] = city_span.get_text(strip=True)

                        elif 'Urbanización:' in text:
                            neighborhood_span = li.find('span', class_='float-right')
                            if neighborhood_span:
                                data['neighborhood'] = neighborhood_span.get_text(strip=True)

            # Amenities from "Detalles" and "Dispositivos" sections
            amenities = []

            # Check amenities lists
            amenity_sections = soup.find_all('ul', class_='property-detailes-list-min')
            for section in amenity_sections:
                for li in section.find_all('li'):
                    text = li.get_text(strip=True).lower()

                    # Only include items with checkmark (✅)
                    if '✅' in text or 'sí' in text or 'si' in text:
                        if 'ascensor' in text:
                            amenities.append('elevator')
                        elif 'piscina' in text:
                            amenities.append('pool')
                        elif 'vigilancia' in text or 'seguridad' in text:
                            amenities.append('security')
                        elif 'gimnasio' in text:
                            amenities.append('gym')
                        elif 'planta eléctrica' in text or 'planta electrica' in text:
                            amenities.append('generator')
                        elif 'parque infantil' in text:
                            amenities.append('playground')
                        elif 'cancha' in text:
                            amenities.append('sports_court')
                        elif 'salón de fiestas' in text or 'salon de fiestas' in text:
                            amenities.append('party_room')
                        elif 'portero' in text:
                            amenities.append('concierge')

            if amenities:
                data['amenities'] = list(set(amenities))  # Remove duplicates

            # Agent name and office
            agent_card = soup.find('div', class_='agent-card')
            if agent_card:
                agent_h2 = agent_card.find('h2', itemprop='name')
                if agent_h2:
                    data['agent_name'] = agent_h2.get_text(strip=True)

                # Try to find agent office/company name in agent card
                agent_office_elem = agent_card.find('span', class_='agent-office')
                if not agent_office_elem:
                    agent_office_elem = agent_card.find('p', class_='agent-company')
                if not agent_office_elem:
                    # Look for any text containing "Rent-A-House"
                    for elem in agent_card.find_all(['span', 'p', 'div']):
                        text = elem.get_text(strip=True)
                        if 'Rent-A-House' in text or 'RAH' in text:
                            data['agent_office'] = text
                            break
                else:
                    data['agent_office'] = agent_office_elem.get_text(strip=True)

            # If agent_office still not found and we know this is Rent-A-House
            if 'agent_office' not in data and 'rentahouse' in url.lower():
                data['agent_office'] = 'Rent-A-House Venezuela'

            # Images - Extract actual URLs from srcset (use existing URLs, don't reconstruct)
            images = []
            seen_urls = set()

            # Find all srcset attributes
            for img in soup.find_all('img'):
                srcset = img.get('data-srcset', '')
                if not srcset:
                    continue

                # Extract actual image URLs from srcset
                # srcset format: "url1 640w, url2 800w, url3 1024w, ..."
                # We want the LARGEST available (usually the last one)
                url_matches = re.findall(r'(https://[^\s]+\.(?:jpg|jpeg|png))', srcset)

                # Take the last (largest) URL for each image
                if url_matches:
                    largest_url = url_matches[-1]  # Last URL is usually highest quality
                    if largest_url not in seen_urls:
                        seen_urls.add(largest_url)
                        images.append(largest_url)

            if images:
                data['image_urls'] = images
                data['photo_count'] = len(images)

            # Description
            desc_section = soup.find('h2', text='Descripción')
            if desc_section:
                desc_p = desc_section.find_next('p')
                if desc_p:
                    desc_text = desc_p.get_text(strip=True)
                    data['description_full'] = desc_text
                    data['description'] = desc_text[:200] + '...' if len(desc_text) > 200 else desc_text

            # --- Extended fields ---

            # Agent phone from agent card
            if agent_card:
                phone_link = agent_card.find('a', href=re.compile(r'^tel:'))
                if phone_link:
                    data['agent_phone'] = phone_link['href'].replace('tel:', '').strip()

                # Agent WhatsApp
                wa_link = agent_card.find('a', href=re.compile(r'wa\.me'))
                if wa_link:
                    wa_match = re.search(r'wa\.me/(\d+)', wa_link['href'])
                    if wa_match:
                        data['agent_whatsapp'] = f"+{wa_match.group(1)}"

                # Agent email
                email_link = agent_card.find('a', href=re.compile(r'^mailto:'))
                if email_link:
                    data['agent_email'] = email_link['href'].replace('mailto:', '').strip()

            # Price per sqm
            if data.get('price') and data.get('area_sqm') and data['area_sqm'] > 0:
                data['price_per_sqm'] = round(data['price'] / data['area_sqm'], 2)

            # Set region from state/city for compatibility
            if data.get('city'):
                data['location'] = data['city']
            if data.get('state'):
                data['region'] = data['state']

            return data

        except Exception as e:
            logger.error(f"Failed to parse Rent-A-House listing {url}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {}

    # -------------------------------------------------------------------------
    # RE/MAX Venezuela
    # -------------------------------------------------------------------------

    def extract_remax_listings(
        self,
        url: str,
        base_url: str,
        storage=None,
        source_id: str = None,
        max_listings: Optional[int] = None
    ) -> List[PropertyListing]:
        """Extract listings from RE/MAX Venezuela via location-based search.

        The search URL format is: /inmuebles/venta?ubi={location}&page={n}
        Each page returns 26 listings, server-rendered with pagination.

        This method:
        1. Loads the first page to get total count and max pages
        2. Paginates through all result pages
        3. Extracts SEO-friendly listing URLs from rendered HTML
        4. Visits each detail page (deduplicating by listing ID)

        Args:
            url: Search URL (e.g., /inmuebles/venta?ubi=Zulia%2C+Zulia%2C+VEN)
            base_url: Base domain URL
            storage: SupabaseStorage instance for batch uploads
            source_id: Source identifier for database

        Returns:
            List of PropertyListing objects
        """
        logger.info(f"Scraping RE/MAX Venezuela: {url}")

        all_listings = []
        batch_size = 50  # Upload every 50 listings
        total_uploaded = 0

        try:
            # --- Phase 1: Discover listing URLs via paginated search ---
            listing_urls = self._discover_remax_urls_from_search(url, base_url)
            logger.info(f"Search discovery: {len(listing_urls)} unique listing URLs")

            # Apply max_listings limit if set (for testing)
            if max_listings and len(listing_urls) > max_listings:
                logger.info(f"⚠️  Limiting to {max_listings} listings (from {len(listing_urls)})")
                listing_urls = listing_urls[:max_listings]

            # --- Phase 2: Visit each listing detail page ---
            for i, listing_url in enumerate(listing_urls):
                try:
                    parse_start = time.time()
                    raw_data = self._parse_remax_listing(listing_url, base_url)
                    parse_time = time.time() - parse_start

                    if raw_data and raw_data.get('title'):
                        logger.info(f"⏱️  RE/MAX property parse: {parse_time:.2f}s")

                        # Filter: Only residential properties (apartment, house)
                        property_type = raw_data.get('property_type', '').lower()
                        if property_type not in ('apartment', 'house'):
                            logger.info(f"Skipping non-residential ({property_type}): {raw_data.get('title', '')[:60]}")
                            continue

                        # Smart translation
                        if self.translator:
                            try:
                                title = raw_data.get('title', '')
                                desc_full = raw_data.get('description_full', '')
                                needs_trans, existing_trans = self.needs_translation(listing_url, title, desc_full)

                                if needs_trans:
                                    trans_start = time.time()
                                    raw_data = self.translator.translate_listing(raw_data)
                                    trans_time = time.time() - trans_start
                                    logger.info(f"✅ Translated: {title[:60]}... ({trans_time:.2f}s)")
                                else:
                                    raw_data.update(existing_trans)
                                    logger.debug(f"⏭️  Skipped translation (unchanged): {title[:60]}...")
                            except Exception as e:
                                logger.warning(f"Translation failed for {listing_url}: {e}")

                        listing = PropertyListing(**raw_data)
                        all_listings.append(listing)
                        title_display = raw_data.get('title_en') or listing.title
                        logger.info(f"Extracted [{i+1}/{len(listing_urls)}]: {title_display[:60]}...")
                    else:
                        logger.warning(f"No data extracted for {listing_url}")

                except Exception as e:
                    logger.warning(f"Failed to parse RE/MAX listing {listing_url}: {e}")
                    continue

                # Batch upload
                if storage and source_id and len(all_listings) >= batch_size:
                    logger.info(f"📦 Uploading batch of {len(all_listings)} RE/MAX listings...")
                    upload_start = time.time()
                    result = storage.upsert_listings(all_listings, source_id)
                    upload_time = time.time() - upload_start
                    total_uploaded += result.get('upserted', 0)
                    logger.info(f"✅ Batch uploaded: {result.get('upserted', 0)} upserted, {result.get('errors', 0)} errors. Total: {total_uploaded} ({upload_time:.2f}s)")
                    all_listings = []

                # Rate limiting: 1-second delay per robots.txt crawl-delay
                time.sleep(1)

        except Exception as e:
            logger.error(f"Failed to scrape RE/MAX search {url}: {e}")
            import traceback
            logger.error(traceback.format_exc())

        logger.info(f"Total RE/MAX listings extracted: {len(all_listings)} (plus {total_uploaded} already uploaded)")
        return all_listings

    def _discover_remax_urls_from_search(self, search_url: str, base_url: str) -> List[str]:
        """Discover listing URLs by paginating through RE/MAX search results.

        Each page has 26 listings and pagination links showing the last page number.
        Returns deduplicated list of SEO-friendly listing URLs.
        """
        seen_ids = self.remax_seen_ids  # Shared across location queries for cross-dedup
        urls = []

        try:
            # Load first page to get total count and max page
            page = self.browser.new_page()
            page.goto(search_url, wait_until="networkidle", timeout=60000)
            time.sleep(4)

            html = page.content()
            soup = BeautifulSoup(html, 'lxml')

            # Extract total count (e.g., "616 Inmuebles")
            page_text = soup.get_text(' ', strip=True)
            count_match = re.search(r'(\d+)\s+Inmueble', page_text)
            total_count = int(count_match.group(1)) if count_match else 0
            logger.info(f"RE/MAX search: {total_count} total listings")

            if total_count == 0:
                page.close()
                return urls

            # Find max page from pagination links
            max_page = 1
            for link in soup.find_all('a', href=True):
                page_match = re.search(r'page=(\d+)', link['href'])
                if page_match:
                    max_page = max(max_page, int(page_match.group(1)))

            logger.info(f"RE/MAX search: {max_page} pages to scrape")

            # Extract listing URLs from first page
            self._extract_remax_urls_from_page(soup, base_url, seen_ids, urls)
            page.close()

            # Paginate through remaining pages
            for page_num in range(2, max_page + 1):
                try:
                    separator = '&' if '?' in search_url else '?'
                    page_url = f"{search_url}{separator}page={page_num}"
                    logger.info(f"RE/MAX search page {page_num}/{max_page}: {page_url}")

                    page = self.browser.new_page()
                    page.goto(page_url, wait_until="networkidle", timeout=30000)
                    time.sleep(3)

                    html = page.content()
                    soup = BeautifulSoup(html, 'lxml')
                    self._extract_remax_urls_from_page(soup, base_url, seen_ids, urls)
                    page.close()

                    # Rate limit between search pages
                    time.sleep(1)

                except Exception as e:
                    logger.warning(f"Failed to scrape RE/MAX search page {page_num}: {e}")
                    continue

        except Exception as e:
            logger.error(f"Failed RE/MAX search discovery: {e}")

        logger.info(f"RE/MAX search: discovered {len(urls)} unique listing URLs")
        return urls

    def _extract_remax_urls_from_page(
        self, soup: BeautifulSoup, base_url: str, seen_ids: set, urls: list
    ) -> None:
        """Extract listing URLs from a rendered RE/MAX search results page.

        Modifies seen_ids and urls in place.
        """
        for link in soup.find_all('a', href=True):
            href = link['href']
            # Match SEO-friendly listing URLs: /inmuebles/{type}/{transaction}/{slug}-{id}
            id_match = re.search(r'/inmuebles/[^/]+/[^/]+/.+-(\d{5,6})$', href)
            if id_match:
                listing_id = id_match.group(1)
                if listing_id not in seen_ids:
                    seen_ids.add(listing_id)
                    if href.startswith('http'):
                        urls.append(href)
                    else:
                        urls.append(f"{base_url.rstrip('/')}{href}")

    def _parse_remax_listing(self, url: str, base_url: str) -> dict:
        """Parse a single RE/MAX Venezuela listing page.

        RE/MAX pages are fully client-rendered. Uses Playwright to render,
        then extracts data from:
        1. JSON-LD Product schema (title, description, price, rooms, area, address)
        2. Meta tags (og:title, description, keywords with amenities)
        3. Rendered body text (structured "Datos del inmueble" and "Ubicación" sections)
        4. CDN images (full-size use 0_ prefix, thumbnails use P_ prefix)
        5. Agent profile image alt text for agent name
        """
        try:
            page = self.browser.new_page()
            page.goto(url, wait_until="networkidle", timeout=30000)

            # Wait for the page to actually render content
            try:
                page.wait_for_function(
                    """() => {
                        return document.querySelector('h1') !== null ||
                               document.body.innerText.includes('no encontrado');
                    }""",
                    timeout=15000
                )
            except Exception:
                logger.debug(f"Timeout waiting for content on {url}, proceeding")

            html = page.content()
            page.close()

            soup = BeautifulSoup(html, 'lxml')
            data = {"source_url": url}

            # Check for "not found" page
            page_text = soup.get_text()
            if 'no encontrado' in page_text.lower() or 'no está disponible' in page_text.lower():
                logger.info(f"RE/MAX listing not found (expired): {url}")
                return {}

            # --- 1. Extract from JSON-LD Product schema ---
            import json as json_module
            for script in soup.find_all('script', type='application/ld+json'):
                try:
                    ld = json_module.loads(script.string)
                    if ld.get('@type') == 'Product':
                        if ld.get('name'):
                            data['title'] = ld['name'].strip()
                        if ld.get('description'):
                            desc = ld['description'].strip()
                            data['description_full'] = desc
                            data['description'] = desc[:200] + '...' if len(desc) > 200 else desc

                        # Price from offers
                        offers = ld.get('offers', {})
                        if isinstance(offers, list):
                            offers = offers[0] if offers else {}
                        if offers.get('price'):
                            try:
                                data['price'] = float(str(offers['price']).replace(',', ''))
                            except ValueError:
                                pass
                        if offers.get('priceCurrency'):
                            data['currency'] = offers['priceCurrency']

                        # Image from JSON-LD (OG size — single image)
                        if ld.get('image'):
                            # Don't use this as primary — we'll get full gallery from img tags

                            pass

                        # Related Apartment/House data
                        related = ld.get('isRelatedTo', {})
                        if related:
                            if related.get('numberOfRooms'):
                                data['bedrooms'] = int(related['numberOfRooms'])
                            if related.get('numberOfBathroomsTotal'):
                                data['bathrooms'] = int(related['numberOfBathroomsTotal'])

                            floor_size = related.get('floorSize', {})
                            if floor_size.get('value'):
                                data['area_sqm'] = float(floor_size['value'])

                            # Parking from amenityFeature
                            for feat in related.get('amenityFeature', []):
                                if 'estacionamiento' in feat.get('name', '').lower():
                                    data['parking_spaces'] = int(feat.get('value', 0))

                            # Address
                            address = related.get('address', {})
                            if address.get('postalCode'):
                                data['postal_code'] = address['postalCode']
                            if address.get('streetAddress'):
                                data['street_address'] = address['streetAddress']
                except (json_module.JSONDecodeError, Exception) as e:
                    logger.debug(f"JSON-LD parse error: {e}")

            # --- 2. Extract from meta tags ---
            og_title = soup.find('meta', attrs={'property': 'og:title'})
            if og_title and og_title.get('content') and not data.get('title'):
                data['title'] = og_title['content'].strip()

            meta_title = soup.find('meta', attrs={'name': 'title'})
            if meta_title and meta_title.get('content') and not data.get('title'):
                data['title'] = meta_title['content'].strip()

            # Amenities from meta keywords
            # e.g., "Apartamento, Venta, LOS CREPUSCULOS, Aire acondicionado,Jardín,Rejas,..."
            meta_keywords = soup.find('meta', attrs={'name': 'keywords'})
            if meta_keywords and meta_keywords.get('content'):
                keywords_text = meta_keywords['content'].lower()
                amenity_map = {
                    'piscina': 'pool', 'gimnasio': 'gym', 'ascensor': 'elevator',
                    'seguridad': 'security', 'vigilancia': 'security',
                    'planta eléctrica': 'generator', 'planta electrica': 'generator',
                    'aire acondicionado': 'ac', 'jacuzzi': 'jacuzzi', 'sauna': 'sauna',
                    'jardín': 'garden', 'jardin': 'garden', 'terraza': 'terrace',
                    'parrillera': 'grill', 'parque infantil': 'playground',
                    'salón de fiestas': 'party_room', 'salon de fiestas': 'party_room',
                    'portería': 'concierge', 'porteria': 'concierge',
                    'lavandero': 'laundry', 'tanque de agua': 'water_tank',
                }
                amenities = []
                for keyword, amenity in amenity_map.items():
                    if keyword in keywords_text:
                        amenities.append(amenity)
                if amenities:
                    data['amenities'] = list(set(amenities))

            # --- 3. Extract property type and transaction from URL ---
            url_lower = url.lower()
            remax_type_map = {
                '/apartamento/': 'apartment',
                '/casa-o-townhouse/': 'house',
                '/casa/': 'house',
                '/terreno-y-parcela/': 'land',
                '/terreno/': 'land',
                '/local-comercial/': 'commercial',
                '/oficina/': 'office',
                '/edificio/': 'building',
                '/local-industrial-y-galpon/': 'industrial',
                '/posada-turistica/': 'tourism',
                '/negocio/': 'commercial',
                '/consultorio-medico/': 'commercial',
            }
            for url_pattern, prop_type in remax_type_map.items():
                if url_pattern in url_lower:
                    data['property_type'] = prop_type
                    break

            if '/venta/' in url_lower or '/venta' in url_lower:
                data['transaction_type'] = 'sale'
            elif '/alquiler/' in url_lower:
                data['transaction_type'] = 'rent'

            # Reference code from URL (trailing ID)
            ref_match = re.search(r'-(\d{5,6})$', url.rstrip('/'))
            if ref_match:
                data['reference_code'] = ref_match.group(1)

            if not data.get('currency'):
                data['currency'] = 'USD'  # RE/MAX VE defaults to USD

            # --- 4. Extract structured details from rendered body text ---
            # The rendered page has clear labeled sections:
            # "Código RE/MAX: 322879"
            # "Precio: USD $43.000"
            # "Habitaciones: 3"
            # "Baños: 1"
            # "Estacionamiento: 1"
            # "Área de Construcción: 76 m²"
            # "Años de Construcción: 33"
            # "Estado: Lara"
            # "Ciudad: Barquisimeto"
            # "Urbanización: Zona Industrial II"
            body_text = soup.get_text(' ', strip=True)

            # Reference code from text
            if not data.get('reference_code'):
                code_match = re.search(r'C[oó]digo\s+RE/?MAX\s*:\s*(\d+)', body_text, re.IGNORECASE)
                if code_match:
                    data['reference_code'] = code_match.group(1)

            # Price from text (fallback)
            if not data.get('price'):
                price_match = re.search(r'Precio\s*:\s*USD\s*\$?\s*([\d.,]+)', body_text, re.IGNORECASE)
                if price_match:
                    try:
                        price_str = price_match.group(1).replace('.', '').replace(',', '')
                        data['price'] = float(price_str)
                    except ValueError:
                        pass

            # Bedrooms
            if not data.get('bedrooms'):
                bed_match = re.search(r'Habitaciones\s*:\s*(\d+)', body_text, re.IGNORECASE)
                if bed_match:
                    data['bedrooms'] = int(bed_match.group(1))

            # Bathrooms
            if not data.get('bathrooms'):
                bath_match = re.search(r'Ba[ñn]os?\s*:\s*(\d+)', body_text, re.IGNORECASE)
                if bath_match:
                    data['bathrooms'] = int(bath_match.group(1))

            # Parking
            if not data.get('parking_spaces'):
                park_match = re.search(r'Estacionamiento\s*:\s*(\d+)', body_text, re.IGNORECASE)
                if park_match:
                    data['parking_spaces'] = int(park_match.group(1))

            # Construction area
            if not data.get('area_sqm'):
                area_match = re.search(r'[AÁá]rea\s+de\s+Construcci[oó]n\s*:\s*(\d+(?:[.,]\d+)?)\s*m', body_text, re.IGNORECASE)
                if area_match:
                    data['area_sqm'] = float(area_match.group(1).replace(',', '.'))

            # Location: State
            state_match = re.search(r'Estado\s*:\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s+Ciudad|\s+$)', body_text)
            if state_match:
                data['state'] = state_match.group(1).strip()

            # Location: City
            city_match = re.search(r'Ciudad\s*:\s*([A-ZÁÉÍÓÚÑa-záéíóúñ\s]+?)(?:\s+Urbanización|\s+Dirección|\s+$)', body_text)
            if city_match:
                data['city'] = city_match.group(1).strip()

            # Location: Neighborhood
            urb_match = re.search(r'Urbanizaci[oó]n\s*:\s*([A-ZÁÉÍÓÚÑa-záéíóúñ0-9\s]+?)(?:\s+Dirección|\s+Precio|\s+$)', body_text)
            if urb_match:
                data['neighborhood'] = urb_match.group(1).strip()

            # --- 5. Images from CDN (full-size only, skip thumbnails) ---
            images = []
            seen_img_urls = set()
            for img in soup.find_all('img'):
                src = img.get('src', '')
                if not src:
                    continue
                # Full-size images: cdn.remax.com.ve/.../0_{hash}.webp
                # Thumbnails: cdn.remax.com.ve/.../P_0_{hash}.webp (skip)
                if 'cdn.remax.com.ve' in src and '/inmuebles_usados/' in src:
                    filename = src.split('/')[-1]
                    if not filename.startswith('P_') and not filename.startswith('OG_'):
                        if src not in seen_img_urls:
                            seen_img_urls.add(src)
                            images.append(src)
            if images:
                data['image_urls'] = images
                data['photo_count'] = len(images)

            # --- 6. Agent info ---
            data['agent_office'] = 'RE/MAX Venezuela'
            # Agent name from profile image alt text (e.g., alt="Marisol Fermin Mendoza")
            for img in soup.find_all('img'):
                src = img.get('src', '')
                alt = img.get('alt', '')
                if 'novus/perfil' in src and 'asesores' in src and alt:
                    data['agent_name'] = alt.strip()
                    break

            # Agent phone (from tel: links)
            for a_tag in soup.find_all('a', href=True):
                href = a_tag['href']
                if href.startswith('tel:'):
                    phone = href.replace('tel:', '').strip()
                    if phone and not data.get('agent_phone'):
                        data['agent_phone'] = phone

            # Agent WhatsApp (from wa.me links)
            for a_tag in soup.find_all('a', href=True):
                href = a_tag['href']
                wa_match = re.search(r'wa\.me/(\d+)', href)
                if wa_match and not data.get('agent_whatsapp'):
                    data['agent_whatsapp'] = f"+{wa_match.group(1)}"

            # Agent email
            email_match = re.search(r'[\w.]+@[\w.]*remax[\w.]*\.ve', html)
            if email_match:
                data['agent_email'] = email_match.group(0)

            # --- 7. Extended fields ---

            # Construction years -> also set condition
            age_match = re.search(r'A.os de Construcci.n:\s*(\d+)', body_text)
            if age_match:
                years = int(age_match.group(1))
                data['construction_years'] = years
                data['condition'] = 'new' if years <= 3 else 'used'

            # Price per sqm
            if data.get('price') and data.get('area_sqm') and data['area_sqm'] > 0:
                data['price_per_sqm'] = round(data['price'] / data['area_sqm'], 2)

            # Street address from "Dirección:" field
            dir_match = re.search(r'Direcci.n:\s*([A-Z0-9].*?)(?:\s+Precio fijado|\s+share|\s+Compartir)', body_text)
            if dir_match:
                data['street_address'] = dir_match.group(1).strip()

            # 360 tour and video flags
            data['has_360_tour'] = '360' in body_text
            data['has_video'] = 'videocam' in body_text.lower()

            # Geo coordinates from Leaflet map data in HTML
            lat_match = re.search(r'"lat(?:itude)?"\s*:\s*([\d.-]+)', html)
            lon_match = re.search(r'"lng"\s*:\s*([\d.-]+)', html)
            if lat_match and lon_match:
                try:
                    lat = float(lat_match.group(1))
                    lon = float(lon_match.group(1))
                    # Sanity check: Venezuela is roughly 1-12°N, 60-73°W
                    if 1 <= lat <= 13 and -74 <= lon <= -59:
                        data['latitude'] = lat
                        data['longitude'] = lon
                except (ValueError, TypeError):
                    pass

            # --- 8. Set region/location for compatibility ---
            if data.get('city'):
                data['location'] = data['city']
            if data.get('state'):
                data['region'] = data['state']

            # Title fallback
            if not data.get('title'):
                h1 = soup.find('h1')
                if h1:
                    data['title'] = h1.get_text(strip=True)

            if not data.get('title'):
                logger.warning(f"No title found for RE/MAX listing: {url}")
                return {}

            return data

        except Exception as e:
            logger.error(f"Failed to parse RE/MAX listing {url}: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return {}


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

    def __init__(self, run_type: str = "full"):
        url = os.environ.get("SUPABASE_URL")
        key = os.environ.get("SUPABASE_KEY")
        if not url or not key:
            raise ValueError("SUPABASE_URL and SUPABASE_KEY required")
        self.client: Client = create_client(url, key)
        self.http_client = httpx.Client(timeout=30.0, follow_redirects=True)
        self.run_type = run_type  # 'full' or 'daily' — used to tag price_history snapshots

    @staticmethod
    def _slugify(text: str) -> str:
        """Convert text to URL-friendly slug."""
        import unicodedata
        # Remove accents
        text = unicodedata.normalize('NFD', text)
        text = text.encode('ascii', 'ignore').decode('utf-8')
        # Lowercase and replace spaces with hyphens
        text = text.lower().strip()
        text = re.sub(r'[^\w\s-]', '', text)
        text = re.sub(r'[-\s]+', '-', text)
        return text.strip('-')

    def _generate_url_slug(self, listing: PropertyListing, property_id: str) -> str:
        """Generate SEO-friendly URL slug.

        Format: {bedrooms}-bed-{property_type}-{neighborhood}-for-sale-{short_id}
        Example: 3-bed-apartment-cumbres-de-curumo-for-sale-abc123
        """
        parts = []

        # Add bedrooms if available
        if listing.bedrooms:
            parts.append(f"{listing.bedrooms}-bed")

        # Add property type
        if listing.property_type:
            parts.append(self._slugify(listing.property_type))

        # Add neighborhood, fallback to city
        location = getattr(listing, 'neighborhood', None) or getattr(listing, 'city', None)
        if location:
            parts.append(self._slugify(location))

        # Add transaction type
        transaction = getattr(listing, 'transaction_type', 'sale') or 'sale'
        parts.append(f"for-{transaction}")

        # Add short ID for uniqueness (last 8 chars of property_id)
        parts.append(property_id[-8:])

        return '-'.join(parts)

    def _generate_url_slug_es(self, listing: PropertyListing, property_id: str) -> str:
        """Generate Spanish SEO-friendly URL slug.

        Format: {bedrooms}-hab-{property_type_es}-{neighborhood}-en-venta-{short_id}
        Example: 3-hab-apartamento-cumbres-de-curumo-en-venta-abc123
        """
        type_map = {
            'apartment': 'apartamento',
            'house': 'casa',
            'land': 'terreno',
            'commercial': 'comercial',
            'office': 'oficina',
        }
        parts = []

        if listing.bedrooms:
            parts.append(f"{listing.bedrooms}-hab")

        if listing.property_type:
            es_type = type_map.get(listing.property_type, self._slugify(listing.property_type))
            parts.append(es_type)

        location = getattr(listing, 'neighborhood', None) or getattr(listing, 'city', None)
        if location:
            parts.append(self._slugify(location))

        transaction = getattr(listing, 'transaction_type', 'sale') or 'sale'
        parts.append('en-alquiler' if transaction == 'rent' else 'en-venta')

        parts.append(property_id[-8:])

        return '-'.join(parts)

    def download_and_upload_image(self, image_url: str, property_id: str, index: int = 0) -> Optional[str]:
        """Download image and upload to Supabase Storage. Returns public URL or None."""
        try:
            # Download image
            response = self.http_client.get(image_url)
            response.raise_for_status()
            image_data = response.content

            # Generate filename: property-id/image-0.jpg
            ext = Path(image_url).suffix or '.jpg'
            filename = f"{property_id}/image-{index}{ext}"

            # Upload to Supabase Storage bucket 'property-images'
            # Note: Bucket must be created in Supabase dashboard first
            self.client.storage.from_("property-images").upload(
                filename,
                image_data,
                file_options={"content-type": response.headers.get("content-type", "image/jpeg"), "upsert": "true"}
            )

            # Get public URL
            public_url = self.client.storage.from_("property-images").get_public_url(filename)
            logger.info(f"Uploaded image: {filename}")
            return public_url

        except Exception as e:
            logger.warning(f"Failed to download/upload image {image_url}: {e}")
            return None

    def _get_existing_images(self, source_urls: list) -> dict:
        """Bulk-fetch existing image_urls and thumbnail_url for listings already in DB.
        Returns dict mapping source_url -> (image_urls, thumbnail_url)."""
        existing = {}
        if not source_urls:
            return existing
        # Query in chunks of 100 to stay within URL length limits
        for i in range(0, len(source_urls), 100):
            chunk = source_urls[i:i+100]
            try:
                result = (
                    self.client.table("listings")
                    .select("source_url,image_urls,thumbnail_url")
                    .in_("source_url", chunk)
                    .execute()
                )
                for row in (result.data or []):
                    imgs = row.get("image_urls") or []
                    if imgs:  # Only cache if images exist
                        existing[row["source_url"]] = (imgs, row.get("thumbnail_url"))
            except Exception as e:
                logger.warning(f"Failed to fetch existing images: {e}")
        return existing

    def upsert_listings(self, listings: List[PropertyListing], source: str) -> dict:
        """Upsert listings to database."""
        if not listings:
            return {"upserted": 0, "errors": 0}

        now = datetime.now(timezone.utc).isoformat()
        upserted = 0
        errors = 0
        images_skipped = 0

        # Bulk-fetch existing images so we can skip re-uploading
        existing_images = self._get_existing_images([l.source_url for l in listings])

        for listing in listings:
            try:
                # Generate unique property ID from source URL
                property_id = hashlib.md5(listing.source_url.encode()).hexdigest()[:12]

                # Check if this listing already has images in the DB
                cached = existing_images.get(listing.source_url)
                if cached:
                    hosted_image_urls = cached[0]
                    thumbnail = cached[1] or (hosted_image_urls[0] if hosted_image_urls else None)
                    images_skipped += 1
                else:
                    # New listing — download and re-host images
                    original_image_urls = getattr(listing, 'image_urls', None) or []
                    hosted_image_urls = []

                    images_start = time.time()
                    for idx, img_url in enumerate(original_image_urls):
                        hosted_url = self.download_and_upload_image(img_url, property_id, idx)
                        if hosted_url:
                            hosted_image_urls.append(hosted_url)
                    images_time = time.time() - images_start
                    if original_image_urls:
                        logger.debug(f"⏱️  Images ({len(original_image_urls)}): {images_time:.2f}s ({images_time/len(original_image_urls):.2f}s/image)")

                    thumbnail = hosted_image_urls[0] if hosted_image_urls else None

                # Generate SEO-friendly URL slugs (both English and Spanish)
                # These are stored separately so upserts don't overwrite stable slugs
                url_slug = self._generate_url_slug(listing, property_id)
                url_slug_es = self._generate_url_slug_es(listing, property_id)

                data = {
                    "source": source,
                    "source_url": listing.source_url,
                    "title": listing.title,
                    "price": listing.price,
                    "currency": listing.currency,
                    "location": listing.location,
                    "region": self._extract_region(listing.location or listing.city or ""),
                    "bedrooms": listing.bedrooms,
                    "bathrooms": listing.bathrooms,
                    "area_sqm": listing.area_sqm,
                    "thumbnail_url": thumbnail,
                    "description_short": listing.description,
                    "description_full": getattr(listing, 'description_full', None),
                    "property_type": listing.property_type,
                    "image_urls": hosted_image_urls,  # Store self-hosted images
                    "scraped_at": now,
                    "last_seen_at": now,
                    "active": True,

                    # Enhanced fields
                    "parking_spaces": getattr(listing, 'parking_spaces', None),
                    "condition": getattr(listing, 'condition', None),
                    "furnished": getattr(listing, 'furnished', None),
                    "transaction_type": getattr(listing, 'transaction_type', None),
                    "property_style": getattr(listing, 'property_style', None),
                    "city": getattr(listing, 'city', None),
                    "neighborhood": getattr(listing, 'neighborhood', None),
                    "state": getattr(listing, 'state', None),
                    "total_area_sqm": getattr(listing, 'total_area_sqm', None),
                    "land_area_sqm": getattr(listing, 'land_area_sqm', None),
                    "amenities": getattr(listing, 'amenities', None),
                    "features": getattr(listing, 'features', None),
                    "agent_name": getattr(listing, 'agent_name', None),
                    "agent_office": getattr(listing, 'agent_office', None),
                    "reference_code": getattr(listing, 'reference_code', None),
                    "photo_count": getattr(listing, 'photo_count', None) or len(hosted_image_urls),

                    # English translations
                    "title_en": getattr(listing, 'title_en', None),
                    "description_short_en": getattr(listing, 'description_short_en', None),
                    "description_full_en": getattr(listing, 'description_full_en', None),

                    # Spanish originals
                    "title_es": getattr(listing, 'title_es', None),
                    "description_short_es": getattr(listing, 'description_short_es', None),
                    "description_full_es": getattr(listing, 'description_full_es', None),

                    # Translation metadata
                    "translation_model": getattr(listing, 'translation_model', None),
                    "translated_at": now if getattr(listing, 'title_en', None) else None,

                    # Extended fields (multi-source)
                    "latitude": getattr(listing, 'latitude', None),
                    "longitude": getattr(listing, 'longitude', None),
                    "construction_years": getattr(listing, 'construction_years', None),
                    "price_per_sqm": getattr(listing, 'price_per_sqm', None),
                    "street_address": getattr(listing, 'street_address', None),
                    "postal_code": getattr(listing, 'postal_code', None),
                    "has_360_tour": getattr(listing, 'has_360_tour', False),
                    "has_video": getattr(listing, 'has_video', False),
                    "agent_phone": getattr(listing, 'agent_phone', None),
                    "agent_email": getattr(listing, 'agent_email', None),
                    "agent_whatsapp": getattr(listing, 'agent_whatsapp', None),
                }

                try:
                    result = self.client.table("listings").upsert(
                        data, on_conflict="source_url"
                    ).select("id").execute()
                except AttributeError:
                    # Newer supabase-py versions don't chain .select() after .upsert()
                    result = self.client.table("listings").upsert(
                        data, on_conflict="source_url"
                    ).execute()

                # Set url_slug only for new listings (where it's NULL)
                # This prevents scraper runs from breaking existing URLs
                self.client.table("listings").update(
                    {"url_slug": url_slug, "url_slug_es": url_slug_es}
                ).eq("source_url", listing.source_url).is_("url_slug", "null").execute()

                # Record price snapshot for market statistics tracking
                if result.data and listing.price and listing.price > 0:
                    listing_id = result.data[0]["id"]
                    price_per_sqm = None
                    if listing.area_sqm and listing.area_sqm > 0:
                        price_per_sqm = round(listing.price / listing.area_sqm, 2)
                    try:
                        self.client.table("price_history").upsert({
                            "listing_id": listing_id,
                            "price": listing.price,
                            "currency": listing.currency,
                            "city": getattr(listing, 'city', None),
                            "state": getattr(listing, 'state', None),
                            "property_type": listing.property_type,
                            "bedrooms": listing.bedrooms,
                            "area_sqm": listing.area_sqm,
                            "price_per_sqm": price_per_sqm,
                            "run_type": self.run_type,
                        }, on_conflict="listing_id,recorded_at").execute()
                    except Exception as ph_err:
                        logger.warning(f"Price history insert failed (non-fatal): {ph_err}")

                upserted += 1

            except Exception as e:
                logger.error(f"Upsert failed: {e}")
                errors += 1

        if images_skipped:
            logger.info(f"⚡ Skipped image uploads for {images_skipped}/{len(listings)} existing listings")
        return {"upserted": upserted, "errors": errors}

    def mark_stale_listings(self, source: str, days: int = 14) -> int:
        """Mark old listings as inactive."""
        cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        try:
            result = (
                self.client.table("listings")
                .update({"active": False, "deactivated_at": datetime.now(timezone.utc).isoformat()})
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


def get_rentahouse_config() -> ScraperConfig:
    """Rent-A-House Venezuela scraper config.

    Uses filtered search to only get for-sale residential properties:
    - tipo_negocio=venta (only sales, not rentals)
    - tipo_inmueble=Apartamento,Casa,Townhouse (residential only)

    Total: 15,405 listings across 1,284 pages (as of Jan 2026)
    """
    base = "https://rentahouse.com.ve"
    urls = []

    # Filtered search: for-sale residential properties only
    search_url = f"{base}/buscar-propiedades?tipo_negocio=venta&tipo_inmueble=Apartamento,Casa,Townhouse"
    urls.append(search_url)

    return ScraperConfig(
        name="Rent-A-House",
        source_id="rentahouse",
        base_url=base,
        page_urls=urls
    )


def get_remax_config() -> ScraperConfig:
    """RE/MAX Venezuela scraper config.

    Discovery via location-based search:
    /inmuebles/venta?ubi={location}&page={n}

    Each search page returns 26 listings, server-rendered with pagination.
    Uses state-level + major city queries for complete coverage.
    Listings are deduplicated by the RE/MAX ID in the URL.

    Total: ~7,000+ active listings across all locations.
    """
    base = "https://remax.com.ve"

    # Location-based search queries for complete coverage.
    #
    # ubi format: "{place}, {municipality (optional)}, {state}, VEN"
    # Do NOT duplicate the place name in the ubi string.
    #
    # Strategy: use the broadest query per state (state-level returns
    # the most listings). Deduplication by RE/MAX listing ID handles
    # any overlap. State-level queries use just "{state}, VEN" format.
    #
    # For Caracas metro, which spans Distrito Capital + Miranda states,
    # we use both state-level queries plus city-level queries for
    # municipalities that may not be captured at state level.
    locations = [
        # --- Small states still needing scraping ---
        "Nueva Esparta (Isla de Margarita), VEN",                          # ~127 residential
        "Mérida, VEN",                                                     # ~32 residential
        "La Guaira, VEN",                                                  # ~29 residential
        "Sucre, VEN",                                                      # ~25 residential
        "Bolívar, VEN",                                                    # ~8 residential
        "Yaracuy, VEN",                                                    # ~5 residential
        # --- All other states ---
        "Zulia, VEN",                                                      # ~1256
        "Táchira, VEN",                                                    # ~1179
        "Carabobo, VEN",                                                   # ~973
        "Aragua, VEN",                                                     # ~972
        "Lara, VEN",                                                       # ~652
        "Falcón, VEN",                                                     # ~420
        "Portuguesa, VEN",                                                 # ~230
        "Trujillo, VEN",                                                   # ~206
        "Monagas, VEN",                                                    # ~187
        "Anzoátegui, VEN",                                                 # ~179
        # --- Caracas metro (Distrito Capital + Miranda) ---
        "Distrito Capital, VEN",                                           # ~336
        "Miranda, VEN",                                                    # ~954
        # City-level supplements to catch any listings not in state search
        "Caracas, Miranda, VEN",                                           # ~826
        "Caracas, Distrito Capital, VEN",                                  # ~336
        "Maracaibo, Zulia, VEN",                                           # ~987 (overlap with Zulia)
    ]

    import urllib.parse
    urls = [
        f"{base}/inmuebles/venta?ubi={urllib.parse.quote(loc, safe='')}"
        for loc in locations
    ]

    return ScraperConfig(
        name="RE/MAX Venezuela",
        source_id="remax",
        base_url=base,
        page_urls=urls
    )


def scrape_source(
    config: ScraperConfig,
    extractor: PlaywrightExtractor,
    storage: SupabaseStorage,
    rate_limit: float = 10.0,
    max_pages: int = 5,
    start_page: int = 1,
    end_page: Optional[int] = None,
    max_listings: Optional[int] = None
) -> dict:
    """Scrape a single source.

    Args:
        config: Scraper configuration
        extractor: Playwright extractor instance
        storage: Supabase storage instance
        rate_limit: Delay between requests (seconds)
        max_pages: Maximum pages to scrape (if end_page not specified)
        start_page: Starting page number (for distributed scraping)
        end_page: Ending page number (for distributed scraping)
        max_listings: Maximum listings to process (for testing, default: unlimited)

    Returns:
        Dictionary with scrape results and statistics
    """
    logger.info(f"Starting scrape: {config.name}")
    if max_listings:
        logger.info(f"⚠️  Limited to {max_listings} listings (test mode)")

    all_listings: List[PropertyListing] = []

    for i, url in enumerate(config.page_urls):
        try:
            # Rent-A-House uses special pagination extraction with batch uploads
            if config.source_id == "rentahouse":
                listings = extractor.extract_rentahouse_listings(
                    url,
                    config.base_url,
                    max_pages=max_pages,
                    start_page=start_page,
                    end_page=end_page,
                    storage=storage,
                    source_id=config.source_id
                )
            elif config.source_id == "remax":
                # RE/MAX uses client-rendered pages with its own extraction
                # Reduce max_listings by what we've already collected
                remaining = max_listings - len(all_listings) if max_listings else None
                if remaining is not None and remaining <= 0:
                    logger.info(f"Reached max_listings={max_listings}, stopping")
                    break
                listings = extractor.extract_remax_listings(
                    url,
                    config.base_url,
                    storage=storage,
                    source_id=config.source_id,
                    max_listings=remaining
                )
            else:
                # BienesOnline and others use standard extraction
                listings = extractor.extract_listings(url, config.base_url)

            all_listings.extend(listings)

            if i < len(config.page_urls) - 1:
                time.sleep(rate_limit)

        except Exception as e:
            logger.error(f"Failed {url}: {e}")
            continue

    # Store remaining listings in Supabase (those not uploaded in batches)
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

def parse_args():
    """Parse command-line arguments for distributed scraping."""
    parser = argparse.ArgumentParser(
        description='Property.com.ve Scraper - Supports distributed scraping with page ranges'
    )
    parser.add_argument(
        '--start-page',
        type=int,
        default=1,
        help='Starting page number (for distributed scraping, default: 1)'
    )
    parser.add_argument(
        '--end-page',
        type=int,
        default=None,
        help='Ending page number (for distributed scraping, default: None = use max-pages)'
    )
    parser.add_argument(
        '--max-pages',
        type=int,
        default=1284,
        help='Maximum pages to scrape if end-page not specified (default: 1284)'
    )
    parser.add_argument(
        '--run-type',
        type=str,
        choices=['full', 'daily'],
        default='full',
        help='Scrape run type for price history tagging (default: full)'
    )
    parser.add_argument(
        '--source',
        type=str,
        choices=['rentahouse', 'remax', 'all'],
        default='all',
        help='Which source to scrape (default: all)'
    )
    parser.add_argument(
        '--max-listings',
        type=int,
        default=None,
        help='Maximum number of listings to process per source (for testing, default: unlimited)'
    )
    return parser.parse_args()


def main():
    """Run the scraper with optional page range and source selection.

    Examples:
        # Scrape all sources (default):
        python scraper/run.py

        # Scrape only RE/MAX:
        python scraper/run.py --source remax

        # Scrape only Rent-A-House with page range:
        python scraper/run.py --source rentahouse --start-page 1 --end-page 150

        # Scrape first 100 pages of Rent-A-House:
        python scraper/run.py --source rentahouse --max-pages 100
    """
    args = parse_args()

    logger.info("=" * 60)
    logger.info("Property.com.ve Scraper Starting")
    logger.info(f"Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info(f"🎯 Source: {args.source}")
    if args.source in ('rentahouse', 'all'):
        if args.end_page:
            logger.info(f"📄 Page Range: {args.start_page} to {args.end_page}")
        else:
            logger.info(f"📄 Max Pages: {args.max_pages} (starting from page {args.start_page})")
    logger.info(f"📊 Run Type: {args.run_type}")
    logger.info("=" * 60)

    # Initialize storage
    storage = SupabaseStorage(run_type=args.run_type)
    results = []

    # Use Playwright extractor as context manager (pass storage for smart translation)
    with PlaywrightExtractor(storage=storage) as extractor:

        # Scrape Rent-A-House (15,405 listings across 1,284 pages)
        if args.source in ('rentahouse', 'all'):
            try:
                config = get_rentahouse_config()
                result = scrape_source(
                    config,
                    extractor,
                    storage,
                    max_pages=args.max_pages,
                    start_page=args.start_page,
                    end_page=args.end_page
                )
                results.append(result)
                logger.info(f"Rent-A-House result: {result}")
            except Exception as e:
                logger.error(f"Rent-A-House failed: {e}")
                results.append({"source": "Rent-A-House", "error": str(e)})

        # Scrape RE/MAX Venezuela (~400-500 listings, single job)
        if args.source in ('remax', 'all'):
            try:
                config = get_remax_config()
                result = scrape_source(
                    config,
                    extractor,
                    storage,
                    rate_limit=1.0,  # 1s per robots.txt crawl-delay
                    max_listings=args.max_listings,
                )
                results.append(result)
                logger.info(f"RE/MAX result: {result}")
            except Exception as e:
                logger.error(f"RE/MAX failed: {e}")
                results.append({"source": "RE/MAX Venezuela", "error": str(e)})

    # Summary
    logger.info("=" * 60)
    logger.info("SCRAPE COMPLETE")
    for r in results:
        logger.info(f"  {r}")
    logger.info("=" * 60)

    # Exit with error if all sources failed
    if results and all("error" in r for r in results):
        sys.exit(1)


if __name__ == "__main__":
    main()
