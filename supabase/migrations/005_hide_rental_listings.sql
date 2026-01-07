-- Hide rental listings from website display
-- This migration marks all rental properties as inactive
-- Only for-sale residential properties should be visible

-- Mark rental listings as inactive
UPDATE listings
SET active = false
WHERE transaction_type = 'rent'
  AND active = true;

-- Add comment explaining the change
COMMENT ON COLUMN listings.transaction_type IS
  'sale or rent - only sale properties are shown on website (active=true)';

-- Create a view for website queries (optional - for convenience)
CREATE OR REPLACE VIEW active_sale_listings AS
SELECT *
FROM listings
WHERE active = true
  AND transaction_type = 'sale'
  AND property_type NOT IN ('commercial', 'office', 'building')
ORDER BY last_seen_at DESC;

COMMENT ON VIEW active_sale_listings IS
  'Filtered view showing only active for-sale residential properties for website display';
