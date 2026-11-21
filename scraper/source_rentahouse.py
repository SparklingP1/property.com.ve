"""Rent-A-House Venezuela (rentahouse.com.ve).

Discovery: the property-details sitemap, which lists every live listing on one
URL. robots.txt asks for `Crawl-delay: 10` and `Disallow: /*?`, so we never
request a URL with a query string and fetch one page at a time, 10 s apart.
Listing pages are server-rendered HTML: plain HTTP, no browser.
"""

from __future__ import annotations

import logging
import re
from typing import Optional
from xml.etree import ElementTree

from bs4 import BeautifulSoup

from facts import ListingFacts
from polite_http import PoliteFetcher

logger = logging.getLogger(__name__)

SOURCE_ID = "rentahouse"
BRAND = "Rent-A-House"
BASE = "https://rentahouse.com.ve"
SITEMAP_INDEX = f"{BASE}/sitemap-rentahouse.com.ve-index.xml"
DETAILS_SITEMAP_HINT = "property-details"
MIN_DELAY = 10.0

# First token of the listing URL -> our property type (None = skip)
URL_TYPE = {
    "apartamento": "apartment",
    "casa": "house",
    "townhouse": "house",
    "quinta": "house",
    "terreno": "land",
    "anexo": "annex",
}
URL_RX = re.compile(r"^https?://(?:www\.)?rentahouse\.com\.ve/([a-z-]+)_en_(venta|alquiler)_en_.*_rah-[\d-]+\.html$")


def classify_url(url: str) -> Optional[tuple]:
    """(property_type, transaction_type) from the URL, or None to skip."""
    m = URL_RX.match(url)
    if not m:
        return None
    ptype = URL_TYPE.get(m.group(1))
    if not ptype:
        return None
    return ptype, ("rent" if m.group(2) == "alquiler" else "sale")


def discover(fetcher: PoliteFetcher) -> dict:
    """Return {'urls': [...all listing URLs in the sitemap...], 'total': n}.
    Raises on failure (expiry must not run on a failed discovery)."""
    idx = fetcher.get(SITEMAP_INDEX)
    if not idx.ok:
        raise RuntimeError(f"sitemap index failed: {idx.status} {idx.error}")
    locs = _locs(idx.text)
    details = [u for u in locs if DETAILS_SITEMAP_HINT in u]
    if not details:
        raise RuntimeError("no property-details sitemap in the index")
    urls = []
    for sm in details:
        r = fetcher.get(sm)
        if not r.ok:
            raise RuntimeError(f"sitemap {sm} failed: {r.status} {r.error}")
        urls += _locs(r.text)
    urls = list(dict.fromkeys(u.strip() for u in urls if "_rah-" in u))
    return {"urls": urls, "total": len(urls)}


def _locs(xml_text: str) -> list:
    try:
        root = ElementTree.fromstring(xml_text.encode("utf-8"))
    except ElementTree.ParseError:
        return re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml_text)
    return [el.text.strip() for el in root.iter() if el.tag.endswith("loc") and el.text]


def _num(text: str) -> Optional[float]:
    """'1.200 m²' -> 1200.0 ; '85,5 m²' -> 85.5 ; '146 m²' -> 146.0"""
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


def _int(text: str) -> Optional[int]:
    m = re.search(r"\d+", text or "")
    return int(m.group(0)) if m else None


def parse(url: str, html: str) -> Optional[ListingFacts]:
    """Parse one listing page into facts. Returns None if the page is not a
    storable listing (wrong type, no price block, etc.)."""
    cls = classify_url(url)
    if not cls:
        return None
    ptype, txn = cls
    soup = BeautifulSoup(html, "lxml")

    f = ListingFacts(source=SOURCE_ID, source_url=url, property_type=ptype, transaction_type=txn)

    price_div = soup.find("div", class_="price")
    if price_div:
        strong = price_div.find("strong") or price_div
        m = re.search(r"(USD|VES|EUR|Bs\.?)\s*([\d.,]+)", strong.get_text(" ", strip=True))
        if m:
            cur = m.group(1).upper().rstrip(".")
            f.currency = "VES" if cur == "BS" else cur
            f.price = _num(m.group(2))

    labels = {}
    for ul in soup.find_all("ul", class_=re.compile(r"property-detailes-list")):
        for li in ul.find_all("li"):
            t = li.get_text(" ", strip=True)
            if ":" in t:
                k, v = t.split(":", 1)
                k = re.sub(r"[^\wáéíóúñü ]", "", k.lower()).strip()
                labels.setdefault(k, v.strip())

    def lab(*names):
        for n in names:
            if n in labels:
                return labels[n]
        return None

    page_type = (lab("tipo de propiedad") or "").lower()
    if page_type:
        if "apartamento" in page_type:
            f.property_type = "apartment"
        elif any(w in page_type for w in ("casa", "townhouse", "quinta")):
            f.property_type = "house"
        elif "terreno" in page_type:
            f.property_type = "land"
        elif "anexo" in page_type:
            f.property_type = "annex"
        else:
            return None   # the page says commercial/office/etc.

    f.reference_code = lab("código rah", "codigo rah")
    f.property_style = lab("estilo")
    f.area_sqm = _num(lab("área privada", "area privada") or "")
    f.total_area_sqm = _num(lab("área total", "área construida", "area total", "area construida") or "")
    f.land_area_sqm = _num(lab("área del terreno", "área de terreno", "area del terreno", "area de terreno") or "")
    if f.property_type == "land" and not f.area_sqm:
        f.area_sqm = f.land_area_sqm or f.total_area_sqm
    cond = (lab("estado del inmueble") or "").lower()
    f.condition = "used" if "usado" in cond else ("new" if "nuevo" in cond else None)
    f.bedrooms = _int(lab("dormitorios", "habitaciones") or "")
    f.bathrooms = _int(lab("total baños", "total banos") or "")
    f.parking_spaces = _int(lab("puestos de estacionamiento") or "")
    furn = (lab("amoblado") or "").lower()
    f.furnished = None if not furn else (furn.startswith("s"))
    f.state = lab("estado")
    f.city = lab("ciudad")
    f.neighborhood = lab("urbanización", "urbanizacion")

    amen = []
    amen_map = {
        "ascensor": "elevator", "piscina": "pool", "vigilancia": "security",
        "seguridad": "security", "gimnasio": "gym", "planta electrica": "generator",
        "planta eléctrica": "generator", "parque infantil": "playground",
        "cancha": "sports_court", "salon de fiesta": "party_room",
        "salón de fiesta": "party_room", "portero": "concierge", "pozo": "well",
    }
    for ul in soup.find_all("ul", class_="property-detailes-list-min"):
        for li in ul.find_all("li"):
            t = li.get_text(" ", strip=True).lower()
            if "✅" in t:
                for k, v in amen_map.items():
                    if k in t:
                        amen.append(v)
    f.amenities = sorted(set(amen))

    # Photos: count unique photo ids in the gallery; keep only the URL of the
    # first one, at the 640 px size the CDN already offers.
    ids, first_640, first_any = [], None, None
    for img in soup.find_all("img"):
        srcset = img.get("data-srcset") or ""
        if "sparkplatform" not in srcset:
            continue
        pid = re.findall(r"/ven/(?:\d+x\d+/true/)?(\d{10,})", srcset)
        if pid and pid[0] not in ids:
            ids.append(pid[0])
        if first_any is None:
            cands = re.findall(r"(https://\S+?\.(?:jpe?g|png|webp))\s+(\d+)w", srcset)
            if cands:
                first_any = cands[-1][0]
                for u, w in cands:
                    if w == "640":
                        first_640 = u
                        break
    f.photo_count = len(ids) or None
    f.first_photo_url = first_640 or first_any


    if f.price is None and not f.area_sqm and not f.bedrooms:
        return None   # not a listing page we understand
    return f
