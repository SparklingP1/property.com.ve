"""
Daily admin summary — sends a digest of yesterday's activity to the site admin.

Usage:
    python send_daily_summary.py

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

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")
FROM_EMAIL = "Property.com.ve <alerts@property.com.ve>"
ADMIN_EMAIL = "danperry1@gmail.com"


def get_daily_stats(supabase) -> dict:
    """Query yesterday's signup, addition, and removal counts."""
    now = datetime.now(timezone.utc)
    yesterday_start = (now - timedelta(days=1)).replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()
    yesterday_end = now.replace(
        hour=0, minute=0, second=0, microsecond=0
    ).isoformat()

    # 1. New user signups (profiles created yesterday)
    signups = (
        supabase.table("profiles")
        .select("id", count="exact")
        .gte("created_at", yesterday_start)
        .lt("created_at", yesterday_end)
        .execute()
    )
    signup_count = signups.count if signups.count is not None else 0

    # 2. Properties added yesterday (new listings created)
    added = (
        supabase.table("listings")
        .select("id", count="exact")
        .gte("created_at", yesterday_start)
        .lt("created_at", yesterday_end)
        .execute()
    )
    added_count = added.count if added.count is not None else 0

    # 3. Properties removed yesterday (deactivated_at in yesterday's window)
    removed = (
        supabase.table("listings")
        .select("id", count="exact")
        .gte("deactivated_at", yesterday_start)
        .lt("deactivated_at", yesterday_end)
        .execute()
    )
    removed_count = removed.count if removed.count is not None else 0

    # 4. Total active listings for context
    active = (
        supabase.table("listings")
        .select("id", count="exact")
        .eq("active", True)
        .execute()
    )
    active_count = active.count if active.count is not None else 0

    return {
        "date": (now - timedelta(days=1)).strftime("%A, %d %B %Y"),
        "signups": signup_count,
        "added": added_count,
        "removed": removed_count,
        "total_active": active_count,
    }


def build_summary_html(stats: dict) -> str:
    """Build a clean HTML email with yesterday's stats."""
    return f"""\
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:500px;margin:0 auto;padding:32px 16px;">
    <div style="background:#fff;border-radius:12px;padding:32px;border:1px solid #e7e5e4;">
      <h1 style="font-size:20px;font-weight:700;color:#1c1917;margin:0 0 4px 0;">
        Daily Summary
      </h1>
      <p style="font-size:14px;color:#78716c;margin:0 0 24px 0;">{stats['date']}</p>

      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;font-size:15px;color:#44403c;">New signups</td>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;font-size:20px;font-weight:700;color:#1c1917;text-align:right;">{stats['signups']}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;font-size:15px;color:#44403c;">Properties added</td>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;font-size:20px;font-weight:700;color:#16a34a;text-align:right;">+{stats['added']}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;font-size:15px;color:#44403c;">Properties removed</td>
          <td style="padding:12px 0;border-bottom:1px solid #f5f5f4;font-size:20px;font-weight:700;color:#dc2626;text-align:right;">-{stats['removed']}</td>
        </tr>
        <tr>
          <td style="padding:12px 0;font-size:15px;color:#44403c;">Total active listings</td>
          <td style="padding:12px 0;font-size:20px;font-weight:700;color:#1c1917;text-align:right;">{stats['total_active']:,}</td>
        </tr>
      </table>
    </div>

    <p style="text-align:center;font-size:11px;color:#a8a29e;margin-top:16px;">
      property.com.ve &mdash; daily admin digest
    </p>
  </div>
</body>
</html>"""


def send_email(to: str, subject: str, html: str) -> bool:
    """Send an email via Resend API."""
    try:
        response = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": FROM_EMAIL,
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
        logger.error(f"Failed to send email: {e}")
        return False


def main():
    if not all([SUPABASE_URL, SUPABASE_KEY]):
        logger.error("Missing SUPABASE_URL or SUPABASE_KEY")
        sys.exit(1)
    if not RESEND_API_KEY:
        logger.error("Missing RESEND_API_KEY")
        sys.exit(1)

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    stats = get_daily_stats(supabase)
    logger.info(
        f"Stats for {stats['date']}: "
        f"{stats['signups']} signups, "
        f"+{stats['added']} added, "
        f"-{stats['removed']} removed, "
        f"{stats['total_active']} active"
    )

    subject = (
        f"Property.com.ve \u2014 {stats['date']}: "
        f"{stats['signups']} signups, "
        f"+{stats['added']} / -{stats['removed']} listings"
    )
    html = build_summary_html(stats)

    if send_email(ADMIN_EMAIL, subject, html):
        logger.info(f"Summary email sent to {ADMIN_EMAIL}")
    else:
        logger.error("Failed to send summary email")
        sys.exit(1)


if __name__ == "__main__":
    main()
