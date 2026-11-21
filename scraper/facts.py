"""Link-out data model: the facts we keep about a listing, and the text we
generate from them.

Rules (owner decision, 21 Nov 2026):
- keep facts only (price, currency, areas, rooms, baths, parking, type,
  sale/rent, state/city/neighbourhood, source, source URL, first/last seen);
- one thumbnail image, stored by us;
- no agent names, phones, e-mails or WhatsApp numbers;
- no copy of the source's description: our own short summary, generated
  deterministically from the facts by a template (no LLM, nothing invented).
"""

from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass, field, asdict
from typing import Optional

# Property types we store. Commercial, office, building, business are skipped.
STORED_TYPES = ("apartment", "house", "land", "annex")

TYPE_ES = {
    "apartment": ("Apartamento", "Apartamentos"),
    "house": ("Casa", "Casas"),
    "land": ("Terreno", "Terrenos"),
    "annex": ("Anexo", "Anexos"),
}
TYPE_EN = {
    "apartment": "Apartment",
    "house": "House",
    "land": "Plot of land",
    "annex": "Annex",
}
TYPE_SLUG_ES = {
    "apartment": "apartamento",
    "house": "casa",
    "land": "terreno",
    "annex": "anexo",
    "commercial": "comercial",
    "office": "oficina",
}

# Plausible price ranges in USD, used only to keep outliers out of the
# price index (the row itself stores what the source says).
PRICE_RANGE_USD = {"sale": (1_000, 20_000_000), "rent": (50, 50_000)}


@dataclass
class ListingFacts:
    source: str                      # 'rentahouse' | 'remax'
    source_url: str
    property_type: str               # one of STORED_TYPES (others are skipped)
    transaction_type: str            # 'sale' | 'rent'
    price: Optional[float] = None
    currency: str = "USD"
    area_sqm: Optional[float] = None         # private / built area
    total_area_sqm: Optional[float] = None
    land_area_sqm: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    parking_spaces: Optional[int] = None
    state: Optional[str] = None
    city: Optional[str] = None
    neighborhood: Optional[str] = None
    reference_code: Optional[str] = None
    condition: Optional[str] = None          # 'new' | 'used'
    furnished: Optional[bool] = None
    property_style: Optional[str] = None
    construction_years: Optional[int] = None
    amenities: list = field(default_factory=list)
    photo_count: Optional[int] = None        # how many photos the source shows
    first_photo_url: Optional[str] = None    # source URL of photo #1 (small size)
    has_video: bool = False
    has_360_tour: bool = False

    def as_dict(self) -> dict:
        return asdict(self)


# ---------------------------------------------------------------------------
# Small text helpers
# ---------------------------------------------------------------------------

_SMALL_WORDS_ES = {"de", "del", "la", "las", "el", "los", "y", "en", "e"}


def tidy_place(name: Optional[str]) -> Optional[str]:
    """Normalise a place name for display: collapse spaces, fix ALL CAPS or
    all-lowercase names to title case. Leaves mixed-case names alone."""
    if not name:
        return None
    s = re.sub(r"\s+", " ", str(name)).strip(" ,.-")
    if not s:
        return None
    if s.isupper() or s.islower():
        words = s.lower().split(" ")
        out = []
        for i, w in enumerate(words):
            if i > 0 and w in _SMALL_WORDS_ES:
                out.append(w)
            else:
                out.append(w[:1].upper() + w[1:])
        s = " ".join(out)
    return s


def _fold(s: Optional[str]) -> str:
    """Lowercase, strip accents and punctuation: for comparisons and keys."""
    if not s:
        return ""
    s = unicodedata.normalize("NFD", str(s))
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z0-9]+", " ", s.lower())
    return s.strip()


def fmt_int_es(n: float) -> str:
    return f"{int(round(n)):,}".replace(",", ".")


def fmt_int_en(n: float) -> str:
    return f"{int(round(n)):,}"


def place_phrase(neighborhood: Optional[str], city: Optional[str], state: Optional[str]) -> Optional[str]:
    """'El Cafetal, Caracas' / 'Caracas' / 'Miranda'. Drops repeats."""
    parts = []
    for p in (neighborhood, city, state):
        p = tidy_place(p)
        if p and all(_fold(p) != _fold(q) for q in parts):
            parts.append(p)
        if len(parts) == 2:
            break
    return ", ".join(parts) if parts else None


# ---------------------------------------------------------------------------
# Generated text (deterministic)
# ---------------------------------------------------------------------------

def _rooms_es(f: ListingFacts) -> list:
    bits = []
    if f.property_type != "land":
        if f.bedrooms:
            bits.append(f"{f.bedrooms} habitación" if f.bedrooms == 1 else f"{f.bedrooms} habitaciones")
        if f.bathrooms:
            bits.append(f"{f.bathrooms} baño" if f.bathrooms == 1 else f"{f.bathrooms} baños")
    area = f.area_sqm or f.total_area_sqm or (f.land_area_sqm if f.property_type == "land" else None)
    if area:
        bits.append(f"{fmt_int_es(area)} m²")
    if f.property_type != "land" and f.parking_spaces:
        bits.append("1 puesto de estacionamiento" if f.parking_spaces == 1
                    else f"{f.parking_spaces} puestos de estacionamiento")
    return bits


def _rooms_en(f: ListingFacts) -> list:
    bits = []
    if f.property_type != "land":
        if f.bedrooms:
            bits.append(f"{f.bedrooms} bedroom" if f.bedrooms == 1 else f"{f.bedrooms} bedrooms")
        if f.bathrooms:
            bits.append(f"{f.bathrooms} bathroom" if f.bathrooms == 1 else f"{f.bathrooms} bathrooms")
    area = f.area_sqm or f.total_area_sqm or (f.land_area_sqm if f.property_type == "land" else None)
    if area:
        bits.append(f"{fmt_int_en(area)} m²")
    if f.property_type != "land" and f.parking_spaces:
        bits.append("1 parking space" if f.parking_spaces == 1 else f"{f.parking_spaces} parking spaces")
    return bits


def _price_es(f: ListingFacts) -> str:
    if f.price and f.price > 0:
        return f"{f.currency or 'USD'} {fmt_int_es(f.price)}"
    return "precio a consultar"


def _price_en(f: ListingFacts) -> str:
    if f.price and f.price > 0:
        return f"{f.currency or 'USD'} {fmt_int_en(f.price)}"
    return "price on request"


def title_es(f: ListingFacts) -> str:
    t = TYPE_ES.get(f.property_type, ("Inmueble",))[0]
    if f.bedrooms and f.property_type in ("apartment", "house", "annex"):
        t += f" de {f.bedrooms} habitación" if f.bedrooms == 1 else f" de {f.bedrooms} habitaciones"
    t += " en alquiler" if f.transaction_type == "rent" else " en venta"
    place = place_phrase(f.neighborhood, f.city, f.state)
    if place:
        t += f" en {place}"
    return t


def title_en(f: ListingFacts) -> str:
    base = TYPE_EN.get(f.property_type, "Property")
    if f.bedrooms and f.property_type in ("apartment", "house", "annex"):
        base = f"{f.bedrooms}-bedroom {base.lower()}"
    t = base + (" for rent" if f.transaction_type == "rent" else " for sale")
    place = place_phrase(f.neighborhood, f.city, f.state)
    if place:
        t += f" in {place}"
    return t


def summary_es(f: ListingFacts) -> str:
    """e.g. 'Apartamento en venta en El Cafetal, Caracas: 3 habitaciones,
    2 baños, 120 m², USD 85.000.'"""
    head = TYPE_ES.get(f.property_type, ("Inmueble",))[0]
    head += " en alquiler" if f.transaction_type == "rent" else " en venta"
    place = place_phrase(f.neighborhood, f.city, f.state)
    if place:
        head += f" en {place}"
    bits = _rooms_es(f) + [_price_es(f)]
    return f"{head}: {', '.join(bits)}."


def summary_en(f: ListingFacts) -> str:
    head = TYPE_EN.get(f.property_type, "Property")
    head += " for rent" if f.transaction_type == "rent" else " for sale"
    place = place_phrase(f.neighborhood, f.city, f.state)
    if place:
        head += f" in {place}"
    bits = _rooms_en(f) + [_price_en(f)]
    return f"{head}: {', '.join(bits)}."


# ---------------------------------------------------------------------------
# Rows that already exist in the DB (dict from Supabase) -> facts
# ---------------------------------------------------------------------------

def facts_from_row(row: dict) -> ListingFacts:
    def num(v):
        try:
            return float(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    def intg(v):
        try:
            return int(v) if v is not None else None
        except (TypeError, ValueError):
            return None

    return ListingFacts(
        source=row.get("source") or "",
        source_url=row.get("source_url") or "",
        property_type=row.get("property_type") or "",
        transaction_type=row.get("transaction_type") or "sale",
        price=num(row.get("price")),
        currency=row.get("currency") or "USD",
        area_sqm=num(row.get("area_sqm")),
        total_area_sqm=num(row.get("total_area_sqm")),
        land_area_sqm=num(row.get("land_area_sqm")),
        bedrooms=intg(row.get("bedrooms")),
        bathrooms=intg(row.get("bathrooms")),
        parking_spaces=intg(row.get("parking_spaces")),
        state=row.get("state"),
        city=row.get("city"),
        neighborhood=row.get("neighborhood"),
    )


# ---------------------------------------------------------------------------
# Dedup fingerprint
# ---------------------------------------------------------------------------

def fingerprint(f: ListingFacts) -> Optional[str]:
    """Group key for duplicate detection: town, neighbourhood, type, sale/rent,
    area rounded to the nearest m², bedrooms. Price is compared separately
    (within 3%). Returns None when there is too little to match on."""
    area = f.area_sqm or f.total_area_sqm or f.land_area_sqm
    if not area or not f.price or not (f.city or f.neighborhood):
        return None
    if f.property_type != "land" and f.bedrooms is None:
        return None
    key = "|".join([
        _fold(f.city), _fold(f.neighborhood), f.property_type or "",
        f.transaction_type or "sale", str(int(round(area))),
        str(f.bedrooms if f.bedrooms is not None else ""),
    ])
    return hashlib.sha1(key.encode()).hexdigest()[:16]


def price_ok_for_index(f: ListingFacts) -> bool:
    if not f.price or (f.currency or "USD") != "USD":
        return False
    lo, hi = PRICE_RANGE_USD.get(f.transaction_type or "sale", PRICE_RANGE_USD["sale"])
    return lo <= f.price <= hi


# ---------------------------------------------------------------------------
# Slugs (formats unchanged from the previous scraper so URLs stay stable)
# ---------------------------------------------------------------------------

def slugify(text: str) -> str:
    text = unicodedata.normalize("NFD", text)
    text = text.encode("ascii", "ignore").decode("utf-8")
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[-\s]+", "-", text)
    return text.strip("-")


def property_id_for(source_url: str) -> str:
    return hashlib.md5(source_url.encode()).hexdigest()[:12]


def url_slug_en(f: ListingFacts, pid: str) -> str:
    parts = []
    if f.bedrooms:
        parts.append(f"{f.bedrooms}-bed")
    if f.property_type:
        parts.append(slugify(f.property_type))
    loc = f.neighborhood or f.city
    if loc:
        parts.append(slugify(loc))
    parts.append(f"for-{f.transaction_type or 'sale'}")
    parts.append(pid[-8:])
    return "-".join(p for p in parts if p)


def url_slug_es(f: ListingFacts, pid: str) -> str:
    parts = []
    if f.bedrooms:
        parts.append(f"{f.bedrooms}-hab")
    if f.property_type:
        parts.append(TYPE_SLUG_ES.get(f.property_type, slugify(f.property_type)))
    loc = f.neighborhood or f.city
    if loc:
        parts.append(slugify(loc))
    parts.append("en-alquiler" if f.transaction_type == "rent" else "en-venta")
    parts.append(pid[-8:])
    return "-".join(p for p in parts if p)


REGIONS = [
    "Caracas", "Miranda", "Zulia", "Carabobo", "Lara", "Aragua",
    "Nueva Esparta", "Anzoategui", "Bolivar", "Merida", "Tachira",
    "Falcon", "Portuguesa", "Barinas", "Guarico", "Monagas", "Sucre",
]


def extract_region(location: str) -> str:
    """Same rule as the previous scraper (substring match on city/location)."""
    loc = (location or "").lower()
    for region in REGIONS:
        if region.lower() in loc:
            return region
    return ""
