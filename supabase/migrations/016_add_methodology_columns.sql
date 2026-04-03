-- Follow-up migration: adds columns introduced by methodology changes
-- and tightens the public RLS policy to hide low-confidence rows.
-- Safe to run even if 013/014 were applied with the original schemas.
-- Uses IF NOT EXISTS / exception handling so it's idempotent.

-- 1. Add bedrooms to price_history (for bedroom-bucket stratification)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'price_history' and column_name = 'bedrooms'
  ) then
    alter table price_history add column bedrooms integer;
  end if;
end $$;

-- 2. Add bedrooms_bucket and sample_confidence to market_stats
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_name = 'market_stats' and column_name = 'bedrooms_bucket'
  ) then
    alter table market_stats add column bedrooms_bucket text not null default '';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_name = 'market_stats' and column_name = 'sample_confidence'
  ) then
    alter table market_stats add column sample_confidence text not null default 'low';
  end if;
end $$;

-- 3. Replace the old unique constraint with the new one that includes bedrooms_bucket.
-- The old constraint was (period_type, period_start, city, state, property_type).
-- Drop it first if it exists, then create the new one.
do $$
declare
  v_constraint_name text;
begin
  -- Find the existing unique constraint on market_stats that does NOT include bedrooms_bucket
  select tc.constraint_name into v_constraint_name
  from information_schema.table_constraints tc
  join information_schema.constraint_column_usage ccu
    on tc.constraint_name = ccu.constraint_name
  where tc.table_name = 'market_stats'
    and tc.constraint_type = 'UNIQUE'
  group by tc.constraint_name
  having count(*) = 5  -- old constraint had 5 columns
    and bool_or(ccu.column_name = 'period_type')
    and bool_or(ccu.column_name = 'period_start')
    and not bool_or(ccu.column_name = 'bedrooms_bucket');

  if v_constraint_name is not null then
    execute format('alter table market_stats drop constraint %I', v_constraint_name);
  end if;
end $$;

-- Add the new constraint if it doesn't exist
do $$
begin
  -- Check if the 6-column constraint already exists
  if not exists (
    select 1
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu
      on tc.constraint_name = ccu.constraint_name
    where tc.table_name = 'market_stats'
      and tc.constraint_type = 'UNIQUE'
    group by tc.constraint_name
    having count(*) = 6
      and bool_or(ccu.column_name = 'bedrooms_bucket')
  ) then
    alter table market_stats
      add constraint market_stats_period_type_period_start_city_state_proper_key
      unique (period_type, period_start, city, state, property_type, bedrooms_bucket);
  end if;
end $$;

-- 4. Tighten public RLS: only expose medium/high confidence rows.
-- Low-confidence rows (N < 20) remain queryable by the service role
-- but are hidden from the anon key (frontend, public API).
drop policy if exists "Public can read market stats" on market_stats;
create policy "Public can read market stats"
  on market_stats for select
  using (sample_confidence in ('medium', 'high'));
