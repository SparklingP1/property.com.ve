"""HTML email templates for property alert notifications."""

from typing import Optional


def format_price(price: Optional[float], currency: str = "USD") -> str:
    if price is None:
        return "Price on request"
    symbols = {"USD": "$", "EUR": "€", "VES": "Bs."}
    symbol = symbols.get(currency, "$")
    return f"{symbol}{price:,.0f}"


def listing_card_html(listing: dict, locale: str = "es") -> str:
    title = listing.get("title_en" if locale == "en" else "title") or listing.get("title", "")
    price = format_price(listing.get("price"), listing.get("currency", "USD"))
    city = listing.get("city", "")
    state = listing.get("state", "")
    location = f"{city}, {state}" if city and state else city or state or ""
    bedrooms = listing.get("bedrooms")
    bathrooms = listing.get("bathrooms")
    area = listing.get("area_sqm")
    slug = listing.get("url_slug") or listing.get("url_slug_es") or ""

    # Build detail URL
    state_slug = (state or "").lower().replace(" ", "-")
    city_slug = (city or "").lower().replace(" ", "-")
    base_url = "https://property.com.ve"
    if locale == "en":
        detail_url = f"{base_url}/en/property/{state_slug}/{city_slug}/{slug}" if slug else f"{base_url}/en/search"
    else:
        detail_url = f"{base_url}/property/{state_slug}/{city_slug}/{slug}" if slug else f"{base_url}/search"

    # Image
    images = listing.get("image_urls") or []
    thumbnail = images[0] if images else ""
    image_html = f'<img src="{thumbnail}" alt="{title}" style="width:100%;height:160px;object-fit:cover;border-radius:8px 8px 0 0;" />' if thumbnail else ""

    specs = []
    if bedrooms:
        specs.append(f"{bedrooms} {'beds' if locale == 'en' else 'hab.'}")
    if bathrooms:
        specs.append(f"{bathrooms} {'baths' if locale == 'en' else 'baños'}")
    if area:
        specs.append(f"{area} m²")
    specs_html = " · ".join(specs)

    return f"""
    <div style="border:1px solid #e7e5e4;border-radius:12px;overflow:hidden;margin-bottom:16px;background:#fff;">
      {image_html}
      <div style="padding:16px;">
        <div style="font-size:18px;font-weight:600;color:#0d9488;margin-bottom:4px;">{price}</div>
        <div style="font-size:15px;font-weight:500;color:#1c1917;margin-bottom:4px;">{title[:80]}</div>
        <div style="font-size:13px;color:#78716c;margin-bottom:8px;">{location}</div>
        <div style="font-size:13px;color:#a8a29e;margin-bottom:12px;">{specs_html}</div>
        <a href="{detail_url}" style="display:inline-block;background:#0d9488;color:#fff;padding:8px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:500;">
          {"View Property" if locale == "en" else "Ver Inmueble"}
        </a>
      </div>
    </div>
    """


def alert_email_html(
    alert_name: str,
    listings: list[dict],
    locale: str = "es",
    dashboard_url: str = "https://property.com.ve/dashboard",
) -> str:
    listing_cards = "\n".join(listing_card_html(l, locale) for l in listings[:10])
    count = len(listings)

    if locale == "en":
        subject_text = f"{count} new {'property' if count == 1 else 'properties'} matching \"{alert_name}\""
        header_text = f"New Properties Matching Your Alert"
        subheader_text = f"We found {count} new {'listing' if count == 1 else 'listings'} matching <strong>{alert_name}</strong>"
        manage_text = "Manage Your Alerts"
        footer_text = "You received this email because you have property alerts set up on Property.com.ve."
        unsubscribe_text = "Manage alerts to change or stop notifications."
    else:
        subject_text = f"{count} {'nuevo inmueble' if count == 1 else 'nuevos inmuebles'} para \"{alert_name}\""
        header_text = "Nuevos Inmuebles que Coinciden con tu Alerta"
        subheader_text = f"Encontramos {count} {'nuevo listado' if count == 1 else 'nuevos listados'} para <strong>{alert_name}</strong>"
        manage_text = "Gestionar tus Alertas"
        footer_text = "Recibiste este correo porque tienes alertas de inmuebles configuradas en Property.com.ve."
        unsubscribe_text = "Gestiona tus alertas para cambiar o detener las notificaciones."

    return f"""
    <!DOCTYPE html>
    <html lang="{locale}">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    </head>
    <body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:32px 16px;">
        <!-- Header -->
        <div style="text-align:center;margin-bottom:32px;">
          <div style="display:inline-block;background:#0d9488;color:#fff;font-weight:700;font-size:20px;width:40px;height:40px;line-height:40px;border-radius:10px;margin-bottom:12px;">P</div>
          <h1 style="font-size:22px;font-weight:700;color:#1c1917;margin:0 0 8px 0;">{header_text}</h1>
          <p style="font-size:15px;color:#78716c;margin:0;">{subheader_text}</p>
        </div>

        <!-- Listings -->
        {listing_cards}

        <!-- CTA -->
        <div style="text-align:center;margin:32px 0;">
          <a href="{dashboard_url}" style="display:inline-block;background:#1c1917;color:#fff;padding:12px 32px;border-radius:10px;text-decoration:none;font-size:15px;font-weight:600;">
            {manage_text}
          </a>
        </div>

        <!-- Footer -->
        <div style="text-align:center;padding-top:24px;border-top:1px solid #e7e5e4;">
          <p style="font-size:12px;color:#a8a29e;margin:0 0 4px 0;">{footer_text}</p>
          <p style="font-size:12px;color:#a8a29e;margin:0;">
            <a href="{dashboard_url}" style="color:#0d9488;">{unsubscribe_text}</a>
          </p>
        </div>
      </div>
    </body>
    </html>
    """


def alert_email_subject(alert_name: str, count: int, locale: str = "es") -> str:
    if locale == "en":
        return f"{count} new {'property' if count == 1 else 'properties'} matching \"{alert_name}\""
    return f"{count} {'nuevo inmueble' if count == 1 else 'nuevos inmuebles'} para \"{alert_name}\""
