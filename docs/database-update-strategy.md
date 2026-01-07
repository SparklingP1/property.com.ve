# Database Update Strategy & Best Practices

## Overview

This document explains how Property.com.ve keeps its listing database fresh, handles stale listings, and ensures users see only current, for-sale residential properties.

**Last Updated:** January 2026

---

## Current Implementation

### 1. Scraping Frequency

**Schedule:** Weekly (Every Sunday at 3:00 AM UTC)

```yaml
# .github/workflows/scrape.yml
schedule:
  - cron: '0 3 * * 0'  # Sunday at 3am UTC
```

**Rationale:**
- ✅ Balances freshness with resource costs
- ✅ Appropriate for Venezuela's market velocity
- ✅ Minimizes load on source websites
- ✅ Reduces Firecrawl API costs

**Current Limitation:**
- ⚠️ 60-minute timeout (GitHub Actions)
- ⚠️ Only completes ~24 of 83 pages per run
- 📊 Result: ~140 listings per week

---

### 2. Listing Lifecycle Management

#### A. **New Listings**
When a property is first discovered:
```python
{
    "source_url": "https://...",  # Unique identifier
    "scraped_at": "2026-01-07T...",  # First discovery
    "last_seen_at": "2026-01-07T...",  # Last confirmation
    "active": true  # Visible on website
}
```

#### B. **Updated Listings**
On subsequent scrapes (upsert based on `source_url`):
```python
# If listing still exists on source:
UPDATE listings SET
    last_seen_at = NOW(),  # ✅ Confirms still live
    price = new_price,     # Updates any changes
    active = true          # Ensures visibility
WHERE source_url = '...'
```

#### C. **Stale Listings**
After scraping completes, automatic cleanup runs:
```python
def mark_stale_listings(source: str, days: int = 14):
    """Mark listings inactive if not seen in 14 days."""
    UPDATE listings SET active = false
    WHERE source = 'rentahouse'
      AND active = true
      AND last_seen_at < NOW() - INTERVAL '14 days'
```

**Grace Period:** 14 days (2 full scrape cycles)

**Benefits:**
- ✅ Forgiving of temporary scraper failures
- ✅ Handles listings temporarily removed/re-listed
- ✅ Maintains historical data for analytics
- ✅ Soft delete (no data loss)

#### D. **Website Display**
Frontend queries only show active listings:
```sql
SELECT * FROM listings
WHERE active = true
  AND transaction_type = 'sale'
  AND property_type IN ('apartment', 'house', 'townhouse', 'land')
ORDER BY last_seen_at DESC
```

---

### 3. Filtering Strategy

#### **Implemented Filters** (as of January 2026)

**Filter 1: Property Type**
```python
# Only residential properties
property_type = raw_data.get('property_type', '').lower()
if property_type in ['commercial', 'office', 'building']:
    logger.info(f"Skipping commercial property")
    continue
```

**Filter 2: Transaction Type** ⭐ NEW
```python
# Only for-sale properties (no rentals)
transaction_type = raw_data.get('transaction_type', '').lower()
if transaction_type == 'rent':
    logger.info(f"Skipping rental property")
    continue
```

**Allowed Property Types:**
- ✅ Apartment (`apartamento`)
- ✅ House (`casa`)
- ✅ Townhouse (`townhouse`)
- ✅ Land (`terreno` - residential only)
- ❌ Commercial (`comercial`)
- ❌ Office (`oficina`)
- ❌ Building (`edificio`)

**Allowed Transaction Types:**
- ✅ Sale (`venta`)
- ❌ Rent (`alquiler`, `arriendo`)

---

## Data Freshness Indicators

### For Users (Frontend)

**Recommended UI Indicators:**

```typescript
// Show freshness badges
const freshnessScore = (lastSeenAt: Date) => {
  const daysAgo = (Date.now() - lastSeenAt.getTime()) / (1000 * 60 * 60 * 24);

  if (daysAgo < 7) return { label: "Recently Verified", color: "green" };
  if (daysAgo < 14) return { label: "Verified This Month", color: "yellow" };
  return { label: "Verify Availability", color: "gray" };
};

// Sort by freshness
ORDER BY last_seen_at DESC, price ASC
```

**Display Options:**
- 🟢 **New** - Listed within 7 days
- 🟡 **Active** - Seen within 14 days
- 🔍 **Call to Verify** - Older than 14 days (shouldn't appear with current logic)

---

## Recommended Improvements

### Priority 1: Fix Timeout Issue ⚠️ CRITICAL

**Problem:** 60-minute timeout only scrapes 24/83 pages (~29%)

**Solution Options:**

#### Option A: Increase Timeout (Simple)
```yaml
# .github/workflows/scrape.yml
timeout-minutes: 360  # 6 hours
```
- ✅ Simple one-line change
- ✅ Completes full scrape
- ⚠️ Uses more GitHub Actions minutes
- 💰 Cost: ~6 hours/week = 24 hours/month (still within free tier)

#### Option B: Paginated Scraping (Complex)
```yaml
# Run 4 separate jobs in parallel
strategy:
  matrix:
    page_range: [1-20, 21-40, 41-60, 61-83]
```
- ✅ Faster completion (parallel execution)
- ✅ Fault-tolerant (one failure doesn't stop others)
- ⚠️ More complex workflow
- ⚠️ Requires code changes to support page ranges

#### Option C: Incremental Scraping (Most Efficient)
```python
# Only scrape pages until we see X% known listings
if listings_seen_before / total_listings > 0.8:
    logger.info("Reached mostly known listings, stopping early")
    break
```
- ✅ Efficient (stops when reaching old listings)
- ✅ Focuses on new/updated listings
- ⚠️ Requires implementing early-stop logic
- ⚠️ May miss updates to older listings

**Recommendation:** Start with Option A (increase timeout to 6 hours), then implement Option C for optimization.

---

### Priority 2: Increase Scraping Frequency

**Current:** Weekly (Sunday 3am)
**Recommended:** 2-3 times per week

```yaml
schedule:
  # Monday, Wednesday, Saturday at 3am UTC
  - cron: '0 3 * * 1,3,6'
```

**Benefits:**
- ✅ Fresher data (max 3-4 days old vs 7 days)
- ✅ Faster detection of sold properties
- ✅ Better user experience
- ✅ Catches mid-week new listings

**Costs:**
- 💰 3x Firecrawl API usage (~$15-30/month depending on volume)
- 💰 3x GitHub Actions minutes (still within free tier if < 6 hours/run)

---

### Priority 3: Add Listing Change Detection

Track when key fields change to show "Price Reduced" or "Just Updated" badges:

```sql
-- Migration: Add change tracking
ALTER TABLE listings ADD COLUMN price_history JSONB;
ALTER TABLE listings ADD COLUMN last_price_change TIMESTAMP;
ALTER TABLE listings ADD COLUMN last_updated TIMESTAMP;

-- Example price history
price_history: [
  {"date": "2026-01-01", "price": 150000},
  {"date": "2026-01-15", "price": 135000}  -- $15k reduction!
]
```

**User-Facing Features:**
- 🔻 "Price Reduced 10%" badge
- ⭐ "Just Updated" for recent changes
- 📊 Price history chart in listing detail

---

### Priority 4: Source Monitoring

Add health checks to detect source website changes:

```python
def validate_scrape_health(listings_count: int, source: str):
    """Alert if scrape results seem anomalous."""

    # Get average from last 4 weeks
    avg_count = get_avg_listing_count(source, weeks=4)

    # Alert if dramatic drop
    if listings_count < avg_count * 0.5:
        send_alert(f"⚠️ {source} scrape only found {listings_count} listings "
                   f"vs avg {avg_count}. Possible site structure change.")
```

---

## Database Query Best Practices

### For Website Frontend

**Main Listings Page:**
```sql
-- Optimized for performance
SELECT
    id, title, price, currency, city, state,
    bedrooms, bathrooms, area_sqm, thumbnail_url,
    last_seen_at, scraped_at
FROM listings
WHERE active = true
  AND transaction_type = 'sale'
  AND property_type NOT IN ('commercial', 'office', 'building')
ORDER BY last_seen_at DESC
LIMIT 50 OFFSET 0;

-- Uses indexes on: active, transaction_type, property_type, last_seen_at
```

**Search Filters:**
```sql
WHERE active = true
  AND transaction_type = 'sale'
  AND price BETWEEN $1 AND $2
  AND city = $3
  AND bedrooms >= $4
  AND bathrooms >= $5
ORDER BY
  CASE WHEN $sort = 'newest' THEN last_seen_at END DESC,
  CASE WHEN $sort = 'price_asc' THEN price END ASC,
  CASE WHEN $sort = 'price_desc' THEN price END DESC;
```

**Ensure Indexes Exist:**
```sql
-- Already created in migrations
CREATE INDEX idx_listings_active ON listings(active);
CREATE INDEX idx_listings_transaction_type ON listings(transaction_type);
CREATE INDEX idx_listings_city ON listings(city);
CREATE INDEX idx_listings_price ON listings(price);
```

---

## Monitoring & Analytics

### Key Metrics to Track

**Database Health:**
```sql
-- Total active listings by source
SELECT source, COUNT(*) as active_count
FROM listings
WHERE active = true
GROUP BY source;

-- Freshness distribution
SELECT
  CASE
    WHEN last_seen_at > NOW() - INTERVAL '7 days' THEN 'Fresh (< 7d)'
    WHEN last_seen_at > NOW() - INTERVAL '14 days' THEN 'Recent (7-14d)'
    ELSE 'Stale (> 14d)'
  END as freshness,
  COUNT(*) as count
FROM listings
WHERE active = true
GROUP BY freshness;

-- Transaction type distribution
SELECT transaction_type, COUNT(*) as count
FROM listings
WHERE active = true
GROUP BY transaction_type;
```

**Scraper Performance:**
```sql
-- Listings added per scrape
SELECT
  DATE(scraped_at) as scrape_date,
  COUNT(*) as new_listings,
  AVG(price) as avg_price
FROM listings
WHERE scraped_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(scraped_at)
ORDER BY scrape_date DESC;
```

---

## Summary

### Current State ✅
- ✅ Weekly scraping (Sundays 3am UTC)
- ✅ Automatic stale listing detection (14-day grace period)
- ✅ Upsert-based updates (no duplicates)
- ✅ Filters commercial properties
- ✅ **NEW:** Filters rental properties
- ✅ Soft delete (maintains history)

### Known Limitations ⚠️
- ⚠️ 60-minute timeout only scrapes ~29% of listings
- ⚠️ Weekly frequency may show older listings
- ⚠️ No change detection/price history

### Recommended Next Steps 📋

1. **Immediate (This Week)**
   - Increase timeout to 6 hours in workflow
   - Test full scrape completion

2. **Short-term (This Month)**
   - Increase frequency to 3x per week
   - Add scrape health monitoring
   - Implement frontend freshness indicators

3. **Medium-term (Next Quarter)**
   - Add price change detection
   - Implement incremental scraping
   - Add admin dashboard for monitoring

---

## FAQ

**Q: Why 14-day grace period for stale listings?**
A: Two full scrape cycles (with weekly scraping) ensures we don't prematurely mark listings as sold due to temporary scraper failures or website issues.

**Q: What happens to rental listings that were previously scraped?**
A: They remain in the database with `active = true` until marked stale. To immediately hide them, run:
```sql
UPDATE listings SET active = false
WHERE transaction_type = 'rent';
```

**Q: Can we scrape more frequently without higher costs?**
A: Yes, with incremental scraping (Option C above). Stop scraping when reaching mostly known listings.

**Q: How do I manually mark a listing as inactive?**
A: Via Supabase dashboard or API:
```sql
UPDATE listings SET active = false
WHERE source_url = 'https://...';
```

**Q: What if a sold property gets re-listed?**
A: The upsert logic will reactivate it automatically on next scrape (sets `active = true`, updates `last_seen_at`).

---

*This strategy ensures Property.com.ve shows fresh, relevant listings while maintaining data integrity and controlling costs.*
