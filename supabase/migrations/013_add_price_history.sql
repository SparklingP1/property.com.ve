-- Price history tracking for market statistics
-- Records one price snapshot per listing per day from scraper runs
-- Raw data is PRIVATE (no public read) — only aggregated market_stats is public

create table if not exists public.price_history (
  id bigint generated always as identity primary key,
  listing_id uuid not null references listings(id) on delete cascade,
  price numeric not null,
  currency text not null default 'USD',
  city text,
  state text,
  property_type text,
  bedrooms integer,
  area_sqm numeric,
  price_per_sqm numeric,
  recorded_at date not null default current_date,
  run_type text not null default 'full',  -- 'full' = weekly complete scrape, 'daily' = pages 1-50 only
  unique(listing_id, recorded_at)
);

-- Indexes for aggregation queries
create index idx_ph_city_date on price_history(city, recorded_at);
create index idx_ph_state_date on price_history(state, recorded_at);
create index idx_ph_listing on price_history(listing_id);
create index idx_ph_run_type on price_history(run_type, recorded_at);

-- Enable RLS — NO public read policy
-- Raw per-listing price history stays private to prevent competitor harvesting
-- Only service role (scraper, aggregation scripts) should read/write.
-- We intentionally create NO write policies here: the service role bypasses RLS,
-- while anon/authenticated clients remain blocked.
alter table price_history enable row level security;

drop policy if exists "Service role can insert price history" on price_history;
drop policy if exists "Service role can update price history" on price_history;
