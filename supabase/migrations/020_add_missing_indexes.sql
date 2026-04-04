-- Migration 020: Add missing indexes for common query patterns
-- Improves performance for daily summary, alert matching, and market stats queries

-- Composite index for finding new listings (used by send_alerts.py)
CREATE INDEX IF NOT EXISTS idx_listings_active_scraped_at
ON listings (active, scraped_at DESC);

-- Index for active alert lookups (used by send_alerts.py)
CREATE INDEX IF NOT EXISTS idx_property_alerts_user_active
ON property_alerts (user_id, is_active);

-- Index for price history aggregation (used by market stats)
CREATE INDEX IF NOT EXISTS idx_price_history_type_city_date
ON price_history (property_type, city, recorded_at DESC);

-- Index for saved properties user lookups
CREATE INDEX IF NOT EXISTS idx_saved_properties_user
ON saved_properties (user_id);

-- Index for recently viewed user lookups
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user
ON recently_viewed (user_id, viewed_at DESC);
