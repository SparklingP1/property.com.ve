-- Property.com.ve Initial Schema
-- Run this in Supabase SQL Editor

-- Listings table
create table if not exists listings (
  id uuid default gen_random_uuid() primary key,
  source text not null, -- 'green-acres', 'bienesonline'
  source_url text not null unique,
  title text not null,
  price numeric,
  currency text default 'USD',
  location text,
  region text,
  bedrooms integer,
  bathrooms integer,
  area_sqm numeric,
  thumbnail_url text,
  description_short text, -- truncated to 200 chars
  property_type text, -- apartment, house, land, commercial
  scraped_at timestamp with time zone default now(),
  last_seen_at timestamp with time zone default now(),
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- Indexes for common queries
create index if not exists idx_listings_location on listings(location);
create index if not exists idx_listings_price on listings(price);
create index if not exists idx_listings_source on listings(source);
create index if not exists idx_listings_active on listings(active);
create index if not exists idx_listings_property_type on listings(property_type);
create index if not exists idx_listings_region on listings(region);

-- Buyer leads table
create table if not exists buyer_leads (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  budget_min numeric,
  budget_max numeric,
  location_preference text,
  property_type text,
  notes text,
  created_at timestamp with time zone default now()
);

-- Agent signups table
create table if not exists agent_signups (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  email text not null,
  phone text,
  agency text,
  message text,
  created_at timestamp with time zone default now()
);

-- Email subscribers table
create table if not exists subscribers (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  created_at timestamp with time zone default now()
);

-- Takedown requests table
create table if not exists takedown_requests (
  id uuid default gen_random_uuid() primary key,
  email text not null,
  listing_url text not null,
  reason text,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS)
alter table listings enable row level security;
alter table buyer_leads enable row level security;
alter table agent_signups enable row level security;
alter table subscribers enable row level security;
alter table takedown_requests enable row level security;

-- Public read access for listings (active only)
create policy "Public can read active listings"
  on listings for select
  using (active = true);

-- Allow anonymous inserts for lead forms
create policy "Anyone can submit buyer leads"
  on buyer_leads for insert
  with check (true);

create policy "Anyone can submit agent signups"
  on agent_signups for insert
  with check (true);

create policy "Anyone can subscribe"
  on subscribers for insert
  with check (true);

create policy "Anyone can submit takedown requests"
  on takedown_requests for insert
  with check (true);
