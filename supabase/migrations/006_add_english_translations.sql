-- Add English translation fields for international buyers
-- Spanish originals preserved for reference/debugging

-- Add English content fields
ALTER TABLE listings ADD COLUMN IF NOT EXISTS title_en TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_short_en TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_full_en TEXT;

-- Add Spanish original fields (preserve source data)
ALTER TABLE listings ADD COLUMN IF NOT EXISTS title_es TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_short_es TEXT;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS description_full_es TEXT;

-- Add translation metadata
ALTER TABLE listings ADD COLUMN IF NOT EXISTS translated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS translation_model TEXT; -- 'gpt-4', 'claude-3', etc.

-- Create indexes for English search
CREATE INDEX IF NOT EXISTS idx_listings_title_en ON listings USING gin(to_tsvector('english', title_en));
CREATE INDEX IF NOT EXISTS idx_listings_description_en ON listings USING gin(to_tsvector('english', description_full_en));

-- Add comments
COMMENT ON COLUMN listings.title_en IS 'AI-translated and rewritten title for English-speaking buyers';
COMMENT ON COLUMN listings.description_short_en IS 'AI-translated short description (200 chars)';
COMMENT ON COLUMN listings.description_full_en IS 'AI-translated and naturally rewritten full description';
COMMENT ON COLUMN listings.title_es IS 'Original Spanish title from source website';
COMMENT ON COLUMN listings.description_short_es IS 'Original Spanish short description from source website';
COMMENT ON COLUMN listings.description_full_es IS 'Original Spanish full description from source website';

-- Migration strategy:
-- 1. New listings: Translate during scraping, store both ES and EN
-- 2. Existing listings: Batch translate via background job (optional)
-- 3. Website: Display *_en fields by default, fallback to original if null
