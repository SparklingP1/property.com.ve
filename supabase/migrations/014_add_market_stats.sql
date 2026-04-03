-- Aggregated market statistics — computed monthly from price_history
-- This table IS public (unlike price_history) — these are the stats we want cited

create table if not exists public.market_stats (
  id bigint generated always as identity primary key,
  period_type text not null,         -- 'monthly' | 'quarterly'
  period_label text not null,        -- '2026-04' | '2026-Q2'
  period_start date not null,
  city text not null default '',     -- '' = all cities (NULL breaks unique constraints)
  state text not null default '',
  property_type text not null default '',
  bedrooms_bucket text not null default '',  -- '1', '2', '3', '4+', '' = all
  listing_count integer not null,
  sample_confidence text not null default 'low',  -- 'high' (N>=50), 'medium' (N>=20), 'low' (N>=5)
  median_price numeric,
  avg_price numeric,
  min_price numeric,
  max_price numeric,
  median_price_per_sqm numeric,
  avg_price_per_sqm numeric,
  price_change_pct numeric,          -- vs previous period
  computed_at timestamp with time zone default now(),
  unique(period_type, period_start, city, state, property_type, bedrooms_bucket)
);

-- Index for frontend queries (lookup by period + location)
create index idx_ms_lookup
  on market_stats(period_type, state, city, property_type, period_start);

-- Enable RLS with public read access
alter table market_stats enable row level security;

drop policy if exists "Public can read market stats" on market_stats;
create policy "Public can read market stats"
  on market_stats for select
  using (sample_confidence in ('medium', 'high'));

-- No explicit write policies: only the service role should write here,
-- and it bypasses RLS automatically.
drop policy if exists "Service role can insert market stats" on market_stats;
drop policy if exists "Service role can update market stats" on market_stats;
