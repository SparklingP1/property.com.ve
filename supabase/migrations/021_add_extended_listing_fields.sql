-- Migration 021: Add extended listing fields for multi-source scraping
-- Captures additional data available from RE/MAX and future sources

-- Geo coordinates (enables map view)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Building age (more granular than binary condition new/used)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS construction_years INTEGER;

-- Price per square meter (pre-computed by some sources)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_sqm NUMERIC;

-- Street-level address (more specific than neighborhood)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS street_address TEXT;

-- Postal code
ALTER TABLE listings ADD COLUMN IF NOT EXISTS postal_code TEXT;

-- Media flags
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_360_tour BOOLEAN DEFAULT FALSE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS has_video BOOLEAN DEFAULT FALSE;

-- Agent contact details
ALTER TABLE listings ADD COLUMN IF NOT EXISTS agent_phone TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS agent_email TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS agent_whatsapp TEXT;

-- Index for geo queries (if we add map-based search later)
CREATE INDEX IF NOT EXISTS idx_listings_geo
ON listings (latitude, longitude)
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
