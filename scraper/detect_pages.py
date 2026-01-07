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

            # Strategy 1: Try the high page number redirect test FIRST
            # This is most reliable for sites that only show nearby pagination links
            logger.info("Trying high page number to find limit...")
            page = browser.new_page()
            try:
                page.goto(f"{url}{'&' if '?' in url else '?'}page=9999",
                         wait_until="networkidle", timeout=60000)

                # Check if we got redirected to a specific max page
                current_url = page.url
                match = re.search(r'[?&]page=(\d+)', current_url)
                if match:
                    detected_page = int(match.group(1))

                    # If we got 9999 back, the site doesn't redirect - verify it has properties
                    if detected_page >= 9999:
                        html = page.content()
                        soup = BeautifulSoup(html, 'lxml')
                        # Check if there are any property listings on this page
                        properties = soup.find_all(['div', 'article'], class_=re.compile(r'property|listing|card', re.I))
                        if len(properties) == 0:
                            logger.warning(f"Page 9999 has no properties - site doesn't redirect, need different strategy")
                        else:
                            logger.info(f"✅ Detected max page from redirect: {detected_page}")
                            browser.close()
                            return detected_page
                    # Only trust redirect if it's a reasonable number (100-9000)
                    elif detected_page > 100:
                        logger.info(f"✅ Detected max page from redirect: {detected_page}")
                        browser.close()
                        return detected_page
                    else:
                        logger.warning(f"Redirect gave suspiciously low page: {detected_page}")

                # Try to find pagination text on the high page
                html = page.content()
                soup = BeautifulSoup(html, 'lxml')
                pagination_text = soup.find(text=re.compile(r'of\s+(\d+)', re.IGNORECASE))
                if pagination_text:
                    match = re.search(r'of\s+(\d+)', pagination_text, re.IGNORECASE)
                    if match:
                        total = int(match.group(1))
                        if total > 100:
                            logger.info(f"✅ Found pagination text on high page: {total} pages")
                            browser.close()
                            return total

            except Exception as e:
                logger.warning(f"High page test failed: {e}")

            # Strategy 2: Load first page and look for pagination indicators
            logger.info(f"Checking pagination at: {url}")
            page.goto(url, wait_until="networkidle", timeout=60000)
            html = page.content()
            soup = BeautifulSoup(html, 'lxml')

            # Look for "of XXX" text
            pagination_text = soup.find(text=re.compile(r'of\s+(\d+)', re.IGNORECASE))
            if pagination_text:
                match = re.search(r'of\s+(\d+)', pagination_text, re.IGNORECASE)
                if match:
                    total = int(match.group(1))
                    logger.info(f"✅ Found pagination text: {total} pages")
                    browser.close()
                    return total

            # Find all page number links (but don't trust if too low)
            page_links = soup.find_all('a', href=re.compile(r'[?&]page=(\d+)'))
            if page_links:
                page_numbers = []
                for link in page_links:
                    href = link.get('href', '')
                    match = re.search(r'[?&]page=(\d+)', href)
                    if match:
                        page_numbers.append(int(match.group(1)))

                if page_numbers:
                    max_visible = max(page_numbers)
                    logger.info(f"Found max visible page link: {max_visible}")
                    # Only trust if it's high enough
                    if max_visible > 1000:
                        logger.info(f"✅ Using max visible page: {max_visible}")
                        browser.close()
                        return max_visible
                    else:
                        logger.warning(f"Max visible page ({max_visible}) seems too low, trying binary search")

                        # Strategy 3: Binary search to find actual max page
                        # This is needed for sites that only show nearby pagination links
                        logger.info("Binary searching for actual max page...")

                        def has_properties_on_page(page_num: int) -> bool:
                            """Check if a specific page has property listings"""
                            try:
                                test_url = f"{url}{'&' if '?' in url else '?'}page={page_num}"
                                page.goto(test_url, wait_until="networkidle", timeout=60000)
                                html = page.content()
                                soup = BeautifulSoup(html, 'lxml')
                                properties = soup.find_all(['div', 'article'], class_=re.compile(r'property|listing|card', re.I))
                                return len(properties) > 0
                            except Exception as e:
                                logger.warning(f"Error checking page {page_num}: {e}")
                                return False

                        # Binary search between max_visible and a reasonable upper bound
                        low = max_visible
                        high = 10000
                        actual_max = max_visible

                        while low <= high:
                            mid = (low + high) // 2
                            logger.info(f"  Checking page {mid}...")

                            if has_properties_on_page(mid):
                                actual_max = mid
                                low = mid + 1
                            else:
                                high = mid - 1

                        logger.info(f"✅ Binary search found max page: {actual_max}")
                        browser.close()
                        return actual_max

            browser.close()

            # Fallback: return a safe default
            logger.warning("Could not reliably detect page count, using default: 1284")
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
