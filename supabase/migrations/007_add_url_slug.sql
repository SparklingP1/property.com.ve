-- Add URL slug field for SEO-friendly URLs
-- Migration 007: Add url_slug field

-- Add url_slug column
ALTER TABLE listings ADD COLUMN IF NOT EXISTS url_slug TEXT;

-- Create unique index on url_slug for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_listings_url_slug ON listings(url_slug);

-- Add index on state and city for URL generation
CREATE INDEX IF NOT EXISTS idx_listings_state_city ON listings(state, city);

-- Comment
COMMENT ON COLUMN listings.url_slug IS 'SEO-friendly URL slug: {bedrooms}-bed-{property_type}-{neighborhood}-for-sale-{short_id}';
