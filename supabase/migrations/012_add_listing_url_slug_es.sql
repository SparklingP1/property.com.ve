-- Add Spanish URL slug for locale-aware listing URLs
-- English: /property/{state}/{city}/3-bed-apartment-cumbres-for-sale-abc123
-- Spanish: /property/{state}/{city}/3-hab-apartamento-cumbres-en-venta-abc123

ALTER TABLE listings ADD COLUMN IF NOT EXISTS url_slug_es TEXT;
CREATE INDEX IF NOT EXISTS idx_listings_url_slug_es ON listings(url_slug_es);

-- Populate Spanish slugs from English slugs
-- Translation mappings:
--   bed → hab (short for habitaciones)
--   apartment → apartamento
--   house → casa
--   land → terreno
--   commercial → comercial
--   office → oficina
--   for-sale → en-venta
--   for-rent → en-alquiler

-- Order matters: replace longer strings first to avoid partial matches
UPDATE listings
SET url_slug_es =
  REPLACE(
    REPLACE(
      REPLACE(
        REPLACE(
          REPLACE(
            REPLACE(
              REPLACE(
                REPLACE(url_slug, 'for-sale', 'en-venta'),
              'for-rent', 'en-alquiler'),
            'apartment', 'apartamento'),
          'house', 'casa'),
        'commercial', 'comercial'),
      'office', 'oficina'),
    'land', 'terreno'),
  '-bed-', '-hab-')
WHERE url_slug IS NOT NULL AND url_slug_es IS NULL;
