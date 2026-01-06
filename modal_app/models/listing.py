"""Pydantic models for property listings."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, field_validator


class PropertyListing(BaseModel):
    """Validated property listing schema for Firecrawl extraction."""

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

    @field_validator("description", mode="before")
    @classmethod
    def truncate_description(cls, v: Optional[str]) -> Optional[str]:
        """Truncate description to 200 characters."""
        if v and len(v) > 200:
            return v[:197] + "..."
        return v

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, v: Optional[str]) -> str:
        """Normalize currency codes."""
        if not v:
            return "USD"
        v = v.upper().strip()
        # Common mappings
        currency_map = {
            "€": "EUR",
            "$": "USD",
            "EUROS": "EUR",
            "DOLLARS": "USD",
            "BS": "VES",
            "BSF": "VES",
        }
        return currency_map.get(v, v) if len(v) <= 5 else "USD"


class ListingWithMetadata(PropertyListing):
    """Extended model with database metadata."""

    id: Optional[str] = None
    source: str  # 'green-acres' or 'bienesonline'
    region: Optional[str] = None
    scrape_run_id: str
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)
    active: bool = True
    created_at: Optional[datetime] = None
