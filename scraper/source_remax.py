"""RE/MAX Venezuela (www.remax.com.ve).

robots.txt allows everything with `Crawl-delay: 1`. Its sitemap.xml is a
stale static file (2025), so discovery walks the server-rendered search
results for the whole country (`/inmuebles/{venta|alquiler}?ubi=VEN&page=N`,
27 listings a page), one request a second. Detail pages are server-rendered
too (JSON-LD + a "Datos del inmueble" block): plain HTTP, no browser.
"""

from __future__ import annotations

import json
import logging
import re
from typing import Optional

from bs4 import BeautifulSoup

from facts import ListingFacts
from polite_http import PoliteFetcher

logger = logging.getLogger(__name__)

SOURCE_ID = "remax"
BRAND = "RE/MAX Venezuela"
BASE = "https://www.remax.com.ve"
MIN_DELAY = 1.0
OPERATIONS = {"venta": "sale", "alquiler": "rent"}

URL_TYPE = {
    "apartamento": "apartment",
    "casa-o-townhouse": "house",
    "casa": "house",
    "quinta": "house",
    "townhouse": "house",
    "terreno-y-parcela": "land",
    "terreno": "land",
    "anexo": "annex",
}
URL_RX = re.compile(r"^https?://(?:www\.)?remax\.com\.ve/inmuebles/([a-z-]+)/(venta|alquiler)/[^?#]*-(\d{5,7})/?$")


def listing_id(url: str) -> Optional[str]:
    m = re.search(r"-(\d{5,7})/?$", url or "")
    return m.group(1) if m else None


def canonical(url: str) -> str:
    """DB rows use https://www.remax.com.ve/...; keep that form."""
    url = url.split("#")[0].rstrip("/")
    return re.sub(r"^https?://(?:www\.)?remax\.com\.ve", BASE, url)


def classify_url(url: str) -> Optional[tuple]:
    m = URL_RX.match(url)
    if not m:
        return None
    ptype = URL_TYPE.get(m.group(1))
    if not ptype:
        return None
    return ptype, OPERATIONS[m.group(2)]


def _search_page(fetcher: PoliteFetcher, op: str, page: int):
    url = f"{BASE}/inmuebles/{op}?ubi=VEN" + (f"&page={page}" if page > 1 else "")
    r = fetcher.get(url)
    if not r.ok:
        return None, None, None
    soup = BeautifulSoup(r.text, "lxml")
    text = soup.get_text(" ", strip=True)
    m = re.search(r"([\d.]+)\s+Inmuebles", text)
    total = int(m.group(1).replace(".", "")) if m else None
    max_page = max([int(x) for x in re.findall(r"[?&;]page=(\d+)", r.text)] or [1])
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"]
        if f"/{op}/" in href and listing_id(href):
            links.append(canonical(href if href.startswith("http") else BASE + href))
    return links, total, max_page


def discover(fetcher: PoliteFetcher, operations=("venta", "alquiler"), max_pages: Optional[int] = None) -> dict:
    """Walk the national search for each operation. Returns
    {'urls': [...], 'total': reported_total, 'complete': bool}."""
    urls, seen_ids = [], set()
    reported, complete = 0, True
    for op in operations:
        links, total, last = _search_page(fetcher, op, 1)
        if links is None:
            raise RuntimeError(f"RE/MAX search {op} page 1 failed")
        reported += total or 0
        pages = min(last, max_pages) if max_pages else last
        if max_pages:
            complete = False
        failures = 0
        for page in range(1, pages + 1):
            if page > 1:
                links, _, last2 = _search_page(fetcher, op, page)
                if links is None:
                    failures += 1
                    logger.warning(f"RE/MAX search {op} page {page} failed")
                    continue
            for u in links:
                lid = listing_id(u)
                if lid and lid not in seen_ids:
                    seen_ids.add(lid)
                    urls.append(u)
        if failures > max(3, pages // 50):
            complete = False
        logger.info(f"RE/MAX {op}: reported {total}, pages {pages}, collected so far {len(urls)}, failed pages {failures}")
    return {"urls": urls, "total": reported, "complete": complete}


def _num(text: str) -> Optional[float]:
    if not text:
        return None
    m = re.search(r"\d[\d.,]*", text)
    if not m:
        return None
    s = m.group(0).rstrip(".,")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    elif re.fullmatch(r"\d{1,3}(\.\d{3})+", s):
        s = s.replace(".", "")
    try:
        return float(s)
    except ValueError:
        return None


def is_not_found(html: str) -> bool:
    low = (html or "").lower()
    return "no encontrado" in low[:20000] and "datos del inmueble" not in low


def parse(url: str, html: str) -> Optional[ListingFacts]:
    cls = classify_url(url)
    if not cls:
        return None
    ptype, txn = cls
    soup = BeautifulSoup(html, "lxml")
    f = ListingFacts(source=SOURCE_ID, source_url=canonical(url), property_type=ptype, transaction_type=txn)
    f.reference_code = listing_id(url)

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            ld = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        if not isinstance(ld, dict) or ld.get("@type") != "Product":
            continue
        offers = ld.get("offers") or {}
        if isinstance(offers, list):
            offers = offers[0] if offers else {}
        try:
            if offers.get("price"):
                f.price = float(str(offers["price"]).replace(",", ""))
        except ValueError:
            pass
        if offers.get("priceCurrency"):
            f.currency = str(offers["priceCurrency"]).upper()
        rel = ld.get("isRelatedTo") or {}
        try:
            # RE/MAX writes 0 when the agent left the field empty
            if rel.get("numberOfRooms"):
                f.bedrooms = int(rel["numberOfRooms"])
            if rel.get("numberOfBathroomsTotal"):
                f.bathrooms = int(rel["numberOfBathroomsTotal"])
            fs = rel.get("floorSize") or {}
            if fs.get("value"):
                f.area_sqm = float(fs["value"])
            for feat in rel.get("amenityFeature") or []:
                if "estacionamiento" in str(feat.get("name", "")).lower():
                    f.parking_spaces = int(feat.get("value") or 0) or None
        except (TypeError, ValueError):
            pass

    text = soup.get_text(" ", strip=True)
    # Only the listing's own data block (the page also shows similar listings)
    start = text.find("Datos del inmueble")
    end = text.find("Precio fijado", start)
    if end < 0:
        end = text.find("Otros anuncios similares", start)
    block = text[start:end if end > start else start + 1500] if start >= 0 else ""

    def num_after(label_rx):
        m = re.search(label_rx + r"\s*:\s*(?:[A-Z]{3}\s*)?\$?\s*([\d][\d.,]*)", block)
        return _num(m.group(1)) if m else None

    if not f.price:
        f.price = num_after(r"Precio")
    if f.bedrooms is None and num_after(r"Habitaciones"):
        f.bedrooms = int(num_after(r"Habitaciones"))
    if f.bathrooms is None and num_after(r"Baños"):
        f.bathrooms = int(num_after(r"Baños"))
    if f.parking_spaces is None and num_after(r"Estacionamiento"):
        f.parking_spaces = int(num_after(r"Estacionamiento"))
    built = num_after(r"Área de Construcción")
    land = num_after(r"Área de Terreno")
    if built and not f.area_sqm:
        f.area_sqm = built
    if land:
        f.land_area_sqm = land
    if ptype == "land" and not f.area_sqm:
        f.area_sqm = land
    age = num_after(r"Años de Construcción")
    if age is not None:
        f.construction_years = int(age)
        f.condition = "new" if f.construction_years <= 3 else "used"

    loc_m = re.search(
        r"Ubicación\s+Estado\s*:\s*(.+?)\s+Ciudad\s*:\s*(.+?)\s+Urbanizaci[oó]n\s*:\s*(.+?)\s+(?:Dirección|Ubicación referencial|Precio fijado)",
        text)
    if loc_m:
        f.state = loc_m.group(1).strip()
        f.city = loc_m.group(2).strip()
        f.neighborhood = loc_m.group(3).strip()
    else:
        st = re.search(r"Estado\s*:\s*(.+?)\s+Ciudad\s*:", text)
        ci = re.search(r"Ciudad\s*:\s*(.+?)\s+Urbanizaci", text)
        f.state = st.group(1).strip() if st else None
        f.city = ci.group(1).strip() if ci else None

    # Amenities from the keywords meta (a list of tags, not prose)
    kw = soup.find("meta", attrs={"name": "keywords"})
    amen = []
    if kw and kw.get("content"):
        k = kw["content"].lower()
        for word, tag in {
            "piscina": "pool", "gimnasio": "gym", "ascensor": "elevator", "seguridad": "security",
            "vigilancia": "security", "planta eléctrica": "generator", "planta electrica": "generator",
            "aire acondicionado": "ac", "jardín": "garden", "jardin": "garden", "terraza": "terrace",
            "parrillera": "grill", "parque infantil": "playground", "tanque de agua": "water_tank",
        }.items():
            if word in k:
                amen.append(tag)
    f.amenities = sorted(set(amen))

    # Photos of this listing only (path contains its id); keep the first, small size
    lid = f.reference_code
    hashes, first_full, first_small = [], None, None
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or ""
        if "cdn.remax.com.ve" not in src or f"/{lid}/" not in src:
            continue
        name = src.rsplit("/", 1)[-1]
        if name.startswith("OG_"):
            continue
        h = re.sub(r"^P_", "", name)
        if name.startswith("P_"):
            first_small = first_small or src
            continue
        if h not in hashes:
            hashes.append(h)
            first_full = first_full or src
    f.photo_count = len(hashes) or None
    # Prefer the CDN's small "P_" rendition of photo #1 when the page has it
    if first_full:
        small_name = "P_" + first_full.rsplit("/", 1)[1]
        f.first_photo_url = first_small if (first_small and first_small.endswith(small_name)) else first_full
    else:
        f.first_photo_url = first_small

    if f.price is None and not f.area_sqm:
        return None
    return f
