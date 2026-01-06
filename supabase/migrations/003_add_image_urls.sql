-- Add image_urls column to store property photos
alter table listings
add column if not exists image_urls jsonb;

-- Add index for faster queries
create index if not exists idx_listings_image_urls on listings using gin(image_urls);
