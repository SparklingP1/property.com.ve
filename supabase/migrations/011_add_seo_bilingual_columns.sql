-- Add Spanish SEO page content columns for bilingual support
-- The page_slug column keeps the English slug; page_slug_es stores the Spanish equivalent

ALTER TABLE seo_page_content
ADD COLUMN IF NOT EXISTS page_slug_es TEXT,
ADD COLUMN IF NOT EXISTS h1_es TEXT,
ADD COLUMN IF NOT EXISTS description_es TEXT,
ADD COLUMN IF NOT EXISTS meta_title_es TEXT,
ADD COLUMN IF NOT EXISTS meta_description_es TEXT,
ADD COLUMN IF NOT EXISTS keywords_es TEXT[];

-- Create index on Spanish slug for lookups
CREATE INDEX IF NOT EXISTS idx_seo_page_content_slug_es ON seo_page_content(page_slug_es);

-- Generate Spanish slugs from English slugs
-- Maps: apartments → apartamentos, houses → casas, land → terrenos, bedroom → habitaciones, state → estado
UPDATE seo_page_content
SET page_slug_es =
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(page_slug, 'apartments', 'apartamentos'),
          'houses', 'casas'),
        'land', 'terrenos'),
      'commercial', 'comercial'),
    'office', 'oficinas'),
  'bedroom', 'habitaciones')
WHERE page_slug_es IS NULL;

-- Also handle the '-state' suffix → '-estado'
UPDATE seo_page_content
SET page_slug_es = REPLACE(page_slug_es, '-state', '-estado')
WHERE page_slug_es LIKE '%-state';
