"""Sentry monitoring integration."""

import os
import sentry_sdk
from sentry_sdk.integrations.logging import LoggingIntegration
import logging


def init_sentry() -> None:
    """Initialize Sentry SDK with Modal-appropriate configuration."""
    dsn = os.environ.get("SENTRY_DSN")
    if not dsn:
        logging.warning("SENTRY_DSN not configured, skipping Sentry initialization")
        return

    sentry_sdk.init(
        dsn=dsn,
        environment=os.environ.get("MODAL_ENVIRONMENT", "production"),
        traces_sample_rate=0.1,  # 10% of transactions for performance
        integrations=[
            LoggingIntegration(level=logging.INFO, event_level=logging.ERROR),
        ],
        before_send=_add_scraper_context,
    )


def _add_scraper_context(event: dict, hint: dict) -> dict:
    """Add scraper-specific context to Sentry events."""
    event.setdefault("tags", {})
    event["tags"]["service"] = "property-scraper"
    return event


def capture_scrape_metrics(source: str, stats: dict) -> None:
    """Send custom metrics to Sentry."""
    with sentry_sdk.push_scope() as scope:
        scope.set_tag("source", source)
        scope.set_context("scrape_stats", stats)
        sentry_sdk.capture_message(f"Scrape completed: {source}", level="info")
