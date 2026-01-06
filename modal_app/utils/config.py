"""Configuration settings for the scraper."""

import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Configuration settings loaded from environment."""

    # Firecrawl
    firecrawl_api_key: str = ""

    # Bright Data proxy
    brightdata_proxy_url: Optional[str] = None

    # Supabase
    supabase_url: str = ""
    supabase_key: str = ""

    # Sentry
    sentry_dsn: Optional[str] = None

    # Scraping behavior
    rate_limit_seconds: float = 2.0
    max_pages_per_source: int = 20
    request_timeout_seconds: int = 30

    # Stale detection
    stale_after_days: int = 14  # 2 weekly scrapes

    class Config:
        env_prefix = ""
        case_sensitive = False


def get_settings() -> Settings:
    """Get settings from environment."""
    return Settings(
        firecrawl_api_key=os.environ.get("FIRECRAWL_API_KEY", ""),
        brightdata_proxy_url=os.environ.get("BRIGHTDATA_PROXY_URL"),
        supabase_url=os.environ.get("SUPABASE_URL", ""),
        supabase_key=os.environ.get("SUPABASE_KEY", ""),
        sentry_dsn=os.environ.get("SENTRY_DSN"),
    )
