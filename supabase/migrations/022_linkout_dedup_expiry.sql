-- Migration 022: link-out scraper — duplicate marking and expiry reasons.
-- Additive only (new nullable columns + indexes). Safe to apply while the
-- site is live; the scraper detects these columns and starts using them.
--
-- duplicate_of   : set on a row that is the same property as another (newer)
--                  row; points at the canonical row. NULL = canonical/unique.
-- fingerprint    : the dedup key (town|neighbourhood|type|sale-rent|area|beds,
--                  hashed); price is compared separately (within 3%).
-- expired_reason : why the row was marked inactive: 'missing_from_source'
--                  (absent from the source's index on two consecutive runs),
--                  'source_404' (the source answered 404/410),
--                  'backlog_missing' (one-off clean-up, Nov 2026).
--                  NULL while live.

ALTER TABLE listings ADD COLUMN IF NOT EXISTS duplicate_of uuid REFERENCES listings(id) ON DELETE SET NULL;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS fingerprint text;
ALTER TABLE listings ADD COLUMN IF NOT EXISTS expired_reason text;

CREATE INDEX IF NOT EXISTS idx_listings_duplicate_of ON listings (duplicate_of) WHERE duplicate_of IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_fingerprint ON listings (fingerprint) WHERE fingerprint IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listings_source_last_seen ON listings (source, last_seen_at);

COMMENT ON COLUMN listings.duplicate_of IS 'Same property as the referenced (canonical, newest) listing. Set by the scraper dedup pass.';
COMMENT ON COLUMN listings.expired_reason IS 'missing_from_source | source_404 | backlog_missing; NULL while live.';
COMMENT ON COLUMN listings.transaction_type IS
  'sale or rent. Rentals are stored; while the site does not filter by transaction_type they are kept active=false with deactivated_at NULL (hidden, not expired).';
