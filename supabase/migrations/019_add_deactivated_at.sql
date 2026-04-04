-- Migration 019: Add deactivated_at timestamp to listings
-- Enables tracking when listings were marked inactive for daily summary reports

ALTER TABLE listings ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- Backfill: approximate deactivation time for existing inactive listings
UPDATE listings
SET deactivated_at = last_seen_at + interval '14 days'
WHERE active = false AND deactivated_at IS NULL;

-- Index for efficient daily summary queries
CREATE INDEX IF NOT EXISTS idx_listings_deactivated_at
ON listings (deactivated_at)
WHERE deactivated_at IS NOT NULL;
