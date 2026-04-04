-- Migration 018: Saved properties and recently viewed tracking
-- Enables heart/save functionality and recently viewed history for registered users

-- ============================================================
-- 1. SAVED PROPERTIES TABLE
-- ============================================================
create table if not exists saved_properties (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  listing_id uuid references listings(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  unique(user_id, listing_id)
);

create index idx_saved_properties_user on saved_properties(user_id);
create index idx_saved_properties_listing on saved_properties(listing_id);

alter table saved_properties enable row level security;

create policy "Users can read own saved properties"
  on saved_properties for select
  using (auth.uid() = user_id);

create policy "Users can save properties"
  on saved_properties for insert
  with check (auth.uid() = user_id);

create policy "Users can unsave properties"
  on saved_properties for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 2. RECENTLY VIEWED TABLE
-- ============================================================
create table if not exists recently_viewed (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  listing_id uuid references listings(id) on delete cascade not null,
  viewed_at timestamp with time zone default now(),
  unique(user_id, listing_id)
);

create index idx_recently_viewed_user on recently_viewed(user_id, viewed_at desc);

alter table recently_viewed enable row level security;

create policy "Users can read own recently viewed"
  on recently_viewed for select
  using (auth.uid() = user_id);

create policy "Users can insert recently viewed"
  on recently_viewed for insert
  with check (auth.uid() = user_id);

create policy "Users can update recently viewed"
  on recently_viewed for update
  using (auth.uid() = user_id);
