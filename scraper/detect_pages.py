#!/usr/bin/env python3
"""
Quick page detection for dynamic distributed scraping.
Checks the pagination to find the total number of pages available.
"""

import sys
from playwright.sync_api import sync_playwright
from bs4 import BeautifulSoup
import re
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def detect_total_pages(url: str) -> int:
    """Detect the total number of pages by checking pagination.

    Args:
        url: Base search URL

    Returns:
        Total number of pages available
    """
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()

            # Load first page
            logger.info(f"Checking pagination at: {url}")
            page.goto(url, wait_until="networkidle", timeout=60000)
            html = page.content()
            browser.close()

            # Parse with BeautifulSoup
            soup = BeautifulSoup(html, 'lxml')

            # Find pagination indicators
            # Common patterns: "Page X of Y" or last page number link

            # Strategy 1: Look for "of XXX" text
            pagination_text = soup.find(text=re.compile(r'of\s+(\d+)', re.IGNORECASE))
            if pagination_text:
                match = re.search(r'of\s+(\d+)', pagination_text, re.IGNORECASE)
                if match:
                    total = int(match.group(1))
                    logger.info(f"✅ Found pagination text: {total} pages")
                    return total

            # Strategy 2: Find all page number links and get the highest
            page_links = soup.find_all('a', href=re.compile(r'[?&]page=(\d+)'))
            if page_links:
                page_numbers = []
                for link in page_links:
                    href = link.get('href', '')
                    match = re.search(r'[?&]page=(\d+)', href)
                    if match:
                        page_numbers.append(int(match.group(1)))

                if page_numbers:
                    total = max(page_numbers)
                    logger.info(f"✅ Found max page number in links: {total}")
                    return total

            # Strategy 3: Try navigating to a very high page and see what we get
            logger.info("Trying high page number to find limit...")
            page = browser.new_page()
            page.goto(f"{url}{'&' if '?' in url else '?'}page=9999",
                     wait_until="networkidle", timeout=60000)
            html = page.content()
            soup = BeautifulSoup(html, 'lxml')

            # Check if we got redirected or see a max page indicator
            current_url = page.url
            match = re.search(r'[?&]page=(\d+)', current_url)
            if match:
                total = int(match.group(1))
                logger.info(f"✅ Detected max page from redirect: {total}")
                return total

            # Fallback: return a safe default
            logger.warning("Could not detect page count, using default: 1284")
            return 1284

    except Exception as e:
        logger.error(f"Error detecting pages: {e}")
        return 1284  # Fallback to known value


def calculate_page_ranges(total_pages: int, num_jobs: int = 9) -> list:
    """Split total pages into equal ranges for parallel jobs.

    Args:
        total_pages: Total number of pages to scrape
        num_jobs: Number of parallel jobs to create

    Returns:
        List of dictionaries with page ranges
    """
    pages_per_job = total_pages // num_jobs
    remainder = total_pages % num_jobs

    ranges = []
    start = 1

    for job_num in range(1, num_jobs + 1):
        # Distribute remainder across first jobs
        extra = 1 if job_num <= remainder else 0
        end = start + pages_per_job - 1 + extra

        ranges.append({
            "start": start,
            "end": min(end, total_pages),
            "name": f"Job {job_num}/{num_jobs}"
        })

        start = end + 1

    return ranges


if __name__ == "__main__":
    # URL for Rent-A-House for-sale residential listings
    url = "https://rentahouse.com.ve/buscar-propiedades?tipo_negocio=venta&tipo_inmueble=Apartamento,Casa,Townhouse"

    # Detect total pages
    total_pages = detect_total_pages(url)

    # Calculate ranges for 9 parallel jobs
    ranges = calculate_page_ranges(total_pages, num_jobs=9)

    # Output JSON for GitHub Actions
    import json
    print(json.dumps({
        "total_pages": total_pages,
        "ranges": ranges
    }))
