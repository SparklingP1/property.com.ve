-- Add enhanced fields for Rent-A-House and future scrapers

-- Enhanced property details
alter table listings add column if not exists parking_spaces integer;
alter table listings add column if not exists condition text; -- 'usado', 'nuevo', etc.
alter table listings add column if not exists furnished boolean;
alter table listings add column if not exists transaction_type text; -- 'sale', 'rent'
alter table listings add column if not exists property_style text; -- '1 nivel', '2 pisos', etc.

-- Location breakdown (more granular than region/location)
alter table listings add column if not exists city text;
alter table listings add column if not exists neighborhood text;
alter table listings add column if not exists state text;

-- Size variations
alter table listings add column if not exists total_area_sqm numeric; -- vs area_sqm (private area)
alter table listings add column if not exists land_area_sqm numeric;

-- Features & amenities (JSON arrays)
alter table listings add column if not exists amenities jsonb; -- ["pool", "gym", "security"]
alter table listings add column if not exists features jsonb; -- property-specific features

-- Agent information
alter table listings add column if not exists agent_name text;
alter table listings add column if not exists agent_office text;
alter table listings add column if not exists reference_code text; -- RAH code, etc.

-- Image metadata
alter table listings add column if not exists photo_count integer;

-- Description (full text, not just short)
alter table listings add column if not exists description_full text;

-- Add indexes for new searchable fields
create index if not exists idx_listings_city on listings(city);
create index if not exists idx_listings_neighborhood on listings(neighborhood);
create index if not exists idx_listings_state on listings(state);
create index if not exists idx_listings_parking on listings(parking_spaces);
create index if not exists idx_listings_transaction_type on listings(transaction_type);
create index if not exists idx_listings_reference_code on listings(reference_code);
create index if not exists idx_listings_amenities on listings using gin(amenities);
