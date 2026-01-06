"""
Modal app for Property.com.ve scraping infrastructure.

This module defines the Modal app that runs weekly scraping jobs
to aggregate property listings from Venezuelan real estate sites.

Usage:
    # Local testing
    modal run modal_app/main.py

    # Deploy to Modal
    modal deploy modal_app/main.py

    # Manual trigger
    modal run modal_app/main.py::scrape_all_sources
"""

import modal
import logging
import uuid
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Define Modal app
app = modal.App("property-scraper-venezuela")

# Define container image with dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "firecrawl-py>=1.0.0",
        "supabase>=2.0.0",
        "pydantic>=2.0.0",
        "pydantic-settings>=2.0.0",
        "sentry-sdk>=1.30.0",
        "tenacity>=8.2.0",
        "httpx>=0.25.0",
    )
)

# Define secrets (configured in Modal dashboard)
# To set up secrets in Modal:
# modal secret create firecrawl-secret FIRECRAWL_API_KEY=your_key
# modal secret create brightdata-secret BRIGHTDATA_PROXY_URL=http://user:pass@host:port
# modal secret create supabase-secret SUPABASE_URL=your_url SUPABASE_KEY=your_key
# modal secret create sentry-secret SENTRY_DSN=your_dsn


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("firecrawl-secret"),
        modal.Secret.from_name("supabase-secret"),
        modal.Secret.from_name("sentry-secret", required=False),
        modal.Secret.from_name("brightdata-secret", required=False),
    ],
    schedule=modal.Cron("0 3 * * 0"),  # Every Sunday at 3am UTC
    timeout=3600,  # 1 hour timeout
    retries=2,
)
def scrape_all_sources():
    """
    Main scheduled function that orchestrates scraping.

    Runs every Sunday at 3am UTC to:
    1. Scrape Green-Acres Venezuela
    2. Scrape BienesOnline Venezuela
    3. Mark stale listings as inactive
    4. Report metrics to Sentry
    """
    from scrapers import GreenAcresScraper, BienesOnlineScraper
    from extractors import FirecrawlExtractor
    from storage import SupabaseStorage
    from utils import init_sentry, capture_scrape_metrics, get_settings

    # Initialize
    init_sentry()
    settings = get_settings()
    scrape_run_id = str(uuid.uuid4())[:8]

    logger.info(f"Starting scrape run: {scrape_run_id}")
    logger.info(f"Timestamp: {datetime.utcnow().isoformat()}")

    # Initialize components
    extractor = FirecrawlExtractor(proxy_url=settings.brightdata_proxy_url)
    storage = SupabaseStorage()

    results = {}

    # Scrape Green-Acres
    try:
        logger.info("Scraping Green-Acres Venezuela...")
        green_acres = GreenAcresScraper(
            extractor=extractor, rate_limit_seconds=settings.rate_limit_seconds
        )
        listings = green_acres.scrape_all(max_pages=settings.max_pages_per_source)

        # Convert to dicts and upsert
        listing_dicts = [l.model_dump() for l in listings]
        upsert_result = storage.upsert_listings(
            listing_dicts, source=green_acres.source_name, scrape_run_id=scrape_run_id
        )

        # Mark stale listings
        stale_count = storage.mark_stale_listings(
            source=green_acres.source_name, stale_after_days=settings.stale_after_days
        )

        results["green-acres"] = {
            "scraped": len(listings),
            "upserted": upsert_result["upserted"],
            "errors": upsert_result["errors"],
            "marked_stale": stale_count,
        }

        capture_scrape_metrics("green-acres", results["green-acres"])
        logger.info(f"Green-Acres complete: {results['green-acres']}")

    except Exception as e:
        logger.error(f"Green-Acres scraping failed: {e}")
        results["green-acres"] = {"error": str(e)}

    # Scrape BienesOnline
    try:
        logger.info("Scraping BienesOnline Venezuela...")
        bienes_online = BienesOnlineScraper(
            extractor=extractor, rate_limit_seconds=settings.rate_limit_seconds
        )
        listings = bienes_online.scrape_all(max_pages=settings.max_pages_per_source)

        # Convert to dicts and upsert
        listing_dicts = [l.model_dump() for l in listings]
        upsert_result = storage.upsert_listings(
            listing_dicts, source=bienes_online.source_name, scrape_run_id=scrape_run_id
        )

        # Mark stale listings
        stale_count = storage.mark_stale_listings(
            source=bienes_online.source_name, stale_after_days=settings.stale_after_days
        )

        results["bienesonline"] = {
            "scraped": len(listings),
            "upserted": upsert_result["upserted"],
            "errors": upsert_result["errors"],
            "marked_stale": stale_count,
        }

        capture_scrape_metrics("bienesonline", results["bienesonline"])
        logger.info(f"BienesOnline complete: {results['bienesonline']}")

    except Exception as e:
        logger.error(f"BienesOnline scraping failed: {e}")
        results["bienesonline"] = {"error": str(e)}

    # Summary
    logger.info(f"Scrape run {scrape_run_id} complete")
    logger.info(f"Results: {results}")

    return results


@app.function(
    image=image,
    secrets=[
        modal.Secret.from_name("firecrawl-secret"),
        modal.Secret.from_name("supabase-secret"),
    ],
)
def scrape_single_source(source: str):
    """
    Scrape a single source for testing purposes.

    Args:
        source: 'green-acres' or 'bienesonline'
    """
    from scrapers import GreenAcresScraper, BienesOnlineScraper
    from extractors import FirecrawlExtractor
    from storage import SupabaseStorage
    from utils import get_settings

    settings = get_settings()
    scrape_run_id = str(uuid.uuid4())[:8]

    extractor = FirecrawlExtractor(proxy_url=settings.brightdata_proxy_url)
    storage = SupabaseStorage()

    if source == "green-acres":
        scraper = GreenAcresScraper(extractor=extractor)
    elif source == "bienesonline":
        scraper = BienesOnlineScraper(extractor=extractor)
    else:
        raise ValueError(f"Unknown source: {source}")

    listings = scraper.scrape_all(max_pages=5)  # Limit for testing

    listing_dicts = [l.model_dump() for l in listings]
    result = storage.upsert_listings(
        listing_dicts, source=scraper.source_name, scrape_run_id=scrape_run_id
    )

    return {
        "source": source,
        "scraped": len(listings),
        "upserted": result["upserted"],
        "errors": result["errors"],
    }


@app.local_entrypoint()
def main():
    """Local entrypoint for testing."""
    logger.info("Running local test...")
    result = scrape_all_sources.remote()
    logger.info(f"Result: {result}")


if __name__ == "__main__":
    main()
