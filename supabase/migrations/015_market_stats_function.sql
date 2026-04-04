-- Aggregation function for computing market statistics from price_history.
--
-- Methodology: Stratified Median (Rightmove-style)
--   - Primary metric: median price per sqm (controls for size variation)
--   - Stratified by: city, state, property_type, bedrooms_bucket
--   - Only full-scrape snapshots (excludes daily partial runs)
--   - Deduplicates to one row per listing per period (latest snapshot wins)
--   - Outlier filtering via 2nd-98th percentile trimming
--   - USD-denominated prices only
--   - Supplementary: repeat-listing price change (same listing across periods)
--
-- Called by: scripts/compute-market-stats.ts via supabase.rpc()
--
-- NOTE: Uses GROUPING() to distinguish data NULLs from rollup NULLs.
-- Data NULLs (e.g., listing with no city) → 'unknown'
-- Rollup NULLs (aggregated away by GROUPING SETS) → ''

create or replace function compute_market_stats(
  p_period_start date,
  p_period_end date,
  p_period_type text,
  p_period_label text
)
returns void
language plpgsql
as $$
declare
  v_prev_start date;
  v_prev_end date;
begin
  if p_period_type = 'monthly' then
    v_prev_start := p_period_start - interval '1 month';
    v_prev_end := p_period_start;
  else
    v_prev_start := p_period_start - interval '3 months';
    v_prev_end := p_period_start;
  end if;

  -- =========================================================================
  -- Step 1: Deduplicate, bucket bedrooms, filter outliers
  -- =========================================================================
  with
  deduped as (
    select distinct on (listing_id)
      listing_id, price, city, state, property_type, bedrooms,
      area_sqm, price_per_sqm,
      case
        when bedrooms is null then 'unknown'
        when bedrooms <= 1 then '1'
        when bedrooms = 2 then '2'
        when bedrooms = 3 then '3'
        else '4+'
      end as bedrooms_bucket
    from price_history
    where recorded_at >= p_period_start
      and recorded_at < p_period_end
      and run_type = 'full'
      and price > 0
      and currency = 'USD'
    order by listing_id, recorded_at desc
  ),
  bounds as (
    select
      percentile_cont(0.02) within group (order by price) as p2,
      percentile_cont(0.98) within group (order by price) as p98
    from deduped
  ),
  filtered as (
    select d.*
    from deduped d, bounds b
    where d.price >= b.p2
      and d.price <= b.p98
  ),

  -- =========================================================================
  -- Step 2: Aggregate with GROUPING() to distinguish data NULLs from rollups
  -- =========================================================================
  aggregated as (
    select
      -- Use GROUPING() to detect rollup NULLs (=1) vs data NULLs (=0)
      case when grouping(city) = 1 then '' else coalesce(city, 'unknown') end as city,
      case when grouping(state) = 1 then '' else coalesce(state, 'unknown') end as state,
      case when grouping(property_type) = 1 then '' else coalesce(property_type, 'unknown') end as property_type,
      case when grouping(bedrooms_bucket) = 1 then '' else coalesce(bedrooms_bucket, 'unknown') end as bedrooms_bucket,
      count(*)::integer as listing_count,
      percentile_cont(0.5) within group (order by price_per_sqm)
        filter (where price_per_sqm is not null and price_per_sqm > 0) as median_price_per_sqm,
      avg(price_per_sqm)
        filter (where price_per_sqm is not null and price_per_sqm > 0) as avg_price_per_sqm,
      percentile_cont(0.5) within group (order by price) as median_price,
      avg(price) as avg_price,
      min(price) as min_price,
      max(price) as max_price,
      case
        when count(*) >= 50 then 'high'
        when count(*) >= 20 then 'medium'
        else 'low'
      end as sample_confidence
    from filtered
    group by grouping sets (
      (city, state, property_type, bedrooms_bucket),
      (city, state, bedrooms_bucket),
      (city, state, property_type),
      (city, state),
      (state, property_type),
      (state),
      (property_type),
      ()
    )
    having count(*) >= 5
  ),

  -- =========================================================================
  -- Step 3: Previous period (same GROUPING() logic)
  -- =========================================================================
  prev_deduped as (
    select distinct on (listing_id)
      listing_id, price, city, state, property_type, bedrooms,
      price_per_sqm,
      case
        when bedrooms is null then 'unknown'
        when bedrooms <= 1 then '1'
        when bedrooms = 2 then '2'
        when bedrooms = 3 then '3'
        else '4+'
      end as bedrooms_bucket
    from price_history
    where recorded_at >= v_prev_start
      and recorded_at < v_prev_end
      and run_type = 'full'
      and price > 0
      and currency = 'USD'
    order by listing_id, recorded_at desc
  ),
  prev_bounds as (
    select
      percentile_cont(0.02) within group (order by price) as p2,
      percentile_cont(0.98) within group (order by price) as p98
    from prev_deduped
  ),
  prev_filtered as (
    select d.*
    from prev_deduped d, prev_bounds b
    where d.price >= b.p2
      and d.price <= b.p98
  ),
  prev_stats as (
    select
      case when grouping(city) = 1 then '' else coalesce(city, 'unknown') end as city,
      case when grouping(state) = 1 then '' else coalesce(state, 'unknown') end as state,
      case when grouping(property_type) = 1 then '' else coalesce(property_type, 'unknown') end as property_type,
      case when grouping(bedrooms_bucket) = 1 then '' else coalesce(bedrooms_bucket, 'unknown') end as bedrooms_bucket,
      percentile_cont(0.5) within group (order by price_per_sqm)
        filter (where price_per_sqm is not null and price_per_sqm > 0) as prev_median_psqm,
      percentile_cont(0.5) within group (order by price) as prev_median
    from prev_filtered
    group by grouping sets (
      (city, state, property_type, bedrooms_bucket),
      (city, state, bedrooms_bucket),
      (city, state, property_type),
      (city, state),
      (state, property_type),
      (state),
      (property_type),
      ()
    )
    having count(*) >= 5
  )

  -- =========================================================================
  -- Step 4: Upsert into market_stats
  -- =========================================================================
  insert into market_stats (
    period_type, period_label, period_start,
    city, state, property_type, bedrooms_bucket,
    listing_count, sample_confidence,
    median_price, avg_price, min_price, max_price,
    median_price_per_sqm, avg_price_per_sqm,
    price_change_pct, computed_at
  )
  select
    p_period_type,
    p_period_label,
    p_period_start,
    a.city,
    a.state,
    a.property_type,
    a.bedrooms_bucket,
    a.listing_count,
    a.sample_confidence,
    round(a.median_price::numeric, 2),
    round(a.avg_price::numeric, 2),
    round(a.min_price::numeric, 2),
    round(a.max_price::numeric, 2),
    round(a.median_price_per_sqm::numeric, 2),
    round(a.avg_price_per_sqm::numeric, 2),
    case
      when p.prev_median_psqm is not null and p.prev_median_psqm > 0
        and a.median_price_per_sqm is not null
      then round(((a.median_price_per_sqm - p.prev_median_psqm) / p.prev_median_psqm * 100)::numeric, 2)
      when p.prev_median is not null and p.prev_median > 0
      then round(((a.median_price - p.prev_median) / p.prev_median * 100)::numeric, 2)
      else null
    end,
    now()
  from aggregated a
  left join prev_stats p
    on a.city = p.city
    and a.state = p.state
    and a.property_type = p.property_type
    and a.bedrooms_bucket = p.bedrooms_bucket
  on conflict (period_type, period_start, city, state, property_type, bedrooms_bucket)
  do update set
    period_label = excluded.period_label,
    listing_count = excluded.listing_count,
    sample_confidence = excluded.sample_confidence,
    median_price = excluded.median_price,
    avg_price = excluded.avg_price,
    min_price = excluded.min_price,
    max_price = excluded.max_price,
    median_price_per_sqm = excluded.median_price_per_sqm,
    avg_price_per_sqm = excluded.avg_price_per_sqm,
    price_change_pct = excluded.price_change_pct,
    computed_at = now();
end;
$$;


-- =========================================================================
-- Supplementary: Repeat-listing price change
-- =========================================================================

create or replace function compute_repeat_listing_stats(
  p_period_start date,
  p_period_end date,
  p_prev_start date,
  p_prev_end date
)
returns table (
  city text,
  state text,
  property_type text,
  repeat_count integer,
  median_pct_change numeric,
  avg_pct_change numeric,
  pct_increased numeric,
  pct_decreased numeric,
  pct_unchanged numeric
)
language sql
stable
as $$
  with
  current_snap as (
    select distinct on (listing_id)
      listing_id, price, price_per_sqm, city, state, property_type
    from price_history
    where recorded_at >= p_period_start
      and recorded_at < p_period_end
      and run_type = 'full'
      and price > 0 and currency = 'USD'
    order by listing_id, recorded_at desc
  ),
  prev_snap as (
    select distinct on (listing_id)
      listing_id, price, price_per_sqm
    from price_history
    where recorded_at >= p_prev_start
      and recorded_at < p_prev_end
      and run_type = 'full'
      and price > 0 and currency = 'USD'
    order by listing_id, recorded_at desc
  ),
  paired as (
    select
      c.listing_id,
      c.city, c.state, c.property_type,
      c.price as current_price,
      p.price as prev_price,
      case when p.price > 0
        then ((c.price - p.price) / p.price * 100)
        else null
      end as pct_change
    from current_snap c
    inner join prev_snap p on c.listing_id = p.listing_id
  )
  select
    coalesce(paired.city, '') as city,
    coalesce(paired.state, '') as state,
    coalesce(paired.property_type, '') as property_type,
    count(*)::integer as repeat_count,
    round(percentile_cont(0.5) within group (order by pct_change)::numeric, 2) as median_pct_change,
    round(avg(pct_change)::numeric, 2) as avg_pct_change,
    round((count(*) filter (where pct_change > 0.5)::numeric / nullif(count(*), 0) * 100)::numeric, 1) as pct_increased,
    round((count(*) filter (where pct_change < -0.5)::numeric / nullif(count(*), 0) * 100)::numeric, 1) as pct_decreased,
    round((count(*) filter (where pct_change between -0.5 and 0.5)::numeric / nullif(count(*), 0) * 100)::numeric, 1) as pct_unchanged
  from paired
  where pct_change is not null
  group by grouping sets (
    (paired.city, paired.state, paired.property_type),
    (paired.city, paired.state),
    (paired.state),
    ()
  )
  having count(*) >= 5;
$$;
