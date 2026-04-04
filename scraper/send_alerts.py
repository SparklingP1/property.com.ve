"""
Property alert sender — runs after the scraper to notify users of matching new listings.

Usage:
    python send_alerts.py

Required environment variables:
    SUPABASE_URL        - Supabase project URL
    SUPABASE_KEY        - Supabase service role key (bypasses RLS)
    RESEND_API_KEY      - Resend API key for sending emails
"""

import os
import sys
import logging
from datetime import datetime, timedelta, timezone

import requests
from supabase import create_client

from email_templates import alert_email_html, alert_email_subject

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
FROM_EMAIL = os.environ.get("FROM_EMAIL", "Property.com.ve <alerts@property.com.ve>")
REPLY_TO_EMAIL = os.environ.get("REPLY_TO_EMAIL", "info@property.com.ve")
SITE_URL = os.environ.get("SITE_URL", "https://property.com.ve")


def build_alert_query(supabase, criteria: dict, since: str):
    """Build a Supabase query from alert criteria — mirrors frontend search logic."""
    query = (
        supabase.table("listings")
        .select("id, title, title_en, price, currency, city, state, bedrooms, bathrooms, area_sqm, image_urls, url_slug, url_slug_es, property_type, transaction_type")
        .eq("active", True)
        .gt("created_at", since)
    )

    if criteria.get("type") and criteria["type"] != "all":
        query = query.eq("property_type", criteria["type"])
    if criteria.get("transaction") and criteria["transaction"] != "all":
        query = query.eq("transaction_type", criteria["transaction"])
    if criteria.get("state") and criteria["state"] != "all":
        query = query.eq("state", criteria["state"])
    if criteria.get("city") and criteria["city"] != "all":
        query = query.eq("city", criteria["city"])
    if criteria.get("minPrice"):
        query = query.gte("price", int(criteria["minPrice"]))
    if criteria.get("maxPrice"):
        query = query.lte("price", int(criteria["maxPrice"]))
    if criteria.get("bedrooms") and criteria["bedrooms"] != "all":
        query = query.gte("bedrooms", int(criteria["bedrooms"]))
    if criteria.get("bathrooms") and criteria["bathrooms"] != "all":
        query = query.gte("bathrooms", int(criteria["bathrooms"]))
    if criteria.get("parking") and criteria["parking"] != "all":
        query = query.gte("parking_spaces", int(criteria["parking"]))
    if criteria.get("minArea"):
        query = query.gte("area_sqm", float(criteria["minArea"]))
    if criteria.get("maxArea"):
        query = query.lte("area_sqm", float(criteria["maxArea"]))
    if criteria.get("furnished") and criteria["furnished"] != "all":
        query = query.eq("furnished", criteria["furnished"].lower() == "true")

    return query.order("created_at", desc=True).limit(20)


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend API."""
    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
                "reply_to": REPLY_TO_EMAIL,
                "to": [to],
                "subject": subject,
                "html": html,
            },
            timeout=30,
        )
        if response.status_code == 200:
            return True
        logger.error(f"Resend API error {response.status_code}: {response.text}")
        return False
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


def main():
    if not all([SUPABASE_URL, SUPABASE_KEY]):
        logger.error("Missing SUPABASE_URL or SUPABASE_KEY")
        sys.exit(1)

    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY not set — skipping alert emails")
        return

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Get all active alerts with user profile info
    result = supabase.table("property_alerts").select(
        "id, name, criteria, last_notified_at, match_count, user_id, profiles(email, preferred_locale)"
    ).eq("is_active", True).execute()

    alerts = result.data or []
    logger.info(f"Found {len(alerts)} active alerts")

    if not alerts:
        return

    emails_sent = 0
    alerts_matched = 0

    for alert in alerts:
        alert_id = alert["id"]
        alert_name = alert["name"]
        criteria = alert.get("criteria", {})
        profile = alert.get("profiles", {})

        if not profile or not profile.get("email"):
            logger.warning(f"Alert {alert_id} has no associated email — skipping")
            continue

        email = profile["email"]
        locale = profile.get("preferred_locale", "es")

        # Determine the "since" timestamp
        since = alert.get("last_notified_at")
        if not since:
            # First notification: look back 24 hours
            since = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()

        # Find matching new listings
        try:
            query = build_alert_query(supabase, criteria, since)
            matches = query.execute()
            listings = matches.data or []
        except Exception as e:
            logger.error(f"Error querying listings for alert {alert_id}: {e}")
            continue

        if not listings:
            continue

        alerts_matched += 1
        logger.info(f"Alert '{alert_name}' ({alert_id}): {len(listings)} new matches for {email}")

        # Build and send email
        dashboard_url = f"{SITE_URL}/{'en/' if locale == 'en' else ''}dashboard"
        subject = alert_email_subject(alert_name, len(listings), locale)
        html = alert_email_html(alert_name, listings, locale, dashboard_url)

        if send_email(email, subject, html):
            emails_sent += 1

            # Update alert: last_notified_at and match_count
            listing_ids = [l["id"] for l in listings]
            new_match_count = (alert.get("match_count") or 0) + len(listings)

            supabase.table("property_alerts").update({
                "last_notified_at": datetime.now(timezone.utc).isoformat(),
                "match_count": new_match_count,
            }).eq("id", alert_id).execute()

            # Record notification
            supabase.table("alert_notifications").insert({
                "alert_id": alert_id,
                "listing_ids": listing_ids,
            }).execute()

    logger.info(f"Done: {alerts_matched} alerts matched, {emails_sent} emails sent")


if __name__ == "__main__":
    main()
