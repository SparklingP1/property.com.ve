/**
 * Integration test for the market stats aggregation pipeline.
 *
 * Tests the stratified median methodology:
 * - Bedroom bucket stratification
 * - $/sqm as primary metric
 * - Sample confidence levels
 * - Daily-run exclusion
 * - Deduplication (latest snapshot wins)
 * - Outlier trimming
 * - Period-over-period change % (based on $/sqm)
 * - Repeat-listing price change function
 *
 * Seeds price_history with known fixture data, runs compute_market_stats,
 * and verifies the results. Cleans up after itself.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/test-market-stats.ts
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL env var required');
  process.exit(1);
}

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, serviceRoleKey);

// Test period: far-future dates that won't collide with real data
const TEST_PERIOD_START = '2099-01-01';
const TEST_PERIOD_END = '2099-02-01';
const TEST_PERIOD_LABEL = '2099-01';
const TEST_PREV_START = '2098-12-01';
const TEST_PREV_END = '2099-01-01';
const TEST_PREV_LABEL = '2098-12';

let testListingIds: string[] = [];
let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

function approxEqual(a: number | null, b: number, tolerance = 1) {
  if (a === null) return false;
  return Math.abs(a - b) <= tolerance;
}

async function setup() {
  console.log('🔧 Setup: fetching real listing IDs for FK references...');

  const { data: listings, error } = await supabase
    .from('listings')
    .select('id')
    .eq('active', true)
    .gt('price', 0)
    .limit(20);

  if (error || !listings || listings.length < 20) {
    console.error('Need at least 20 active listings for test fixtures');
    console.error(error);
    process.exit(1);
  }

  testListingIds = listings.map((l) => l.id);
  console.log(`  Using ${testListingIds.length} listing IDs\n`);
}

async function seedFixtures() {
  console.log('🌱 Seeding test fixtures...\n');

  // --- Current period fixtures ---

  // 6 x 2-bed apartments in Caracas at ~$700/sqm
  // Prices: 56k, 63k, 70k, 70k, 77k, 84k on 80-130sqm
  const caracas2bed = [56000, 63000, 70000, 70000, 77000, 84000].map((price, i) => ({
    listing_id: testListingIds[i],
    price,
    currency: 'USD',
    city: 'Caracas',
    state: 'Miranda',
    property_type: 'apartment',
    bedrooms: 2,
    area_sqm: 80 + i * 10,
    price_per_sqm: Math.round((price / (80 + i * 10)) * 100) / 100,
    recorded_at: '2099-01-15',
    run_type: 'full',
  }));

  // 6 x 3-bed apartments in Caracas at ~$600/sqm (cheaper per sqm — bigger units)
  const caracas3bed = [72000, 78000, 84000, 84000, 90000, 96000].map((price, i) => ({
    listing_id: testListingIds[6 + i],
    price,
    currency: 'USD',
    city: 'Caracas',
    state: 'Miranda',
    property_type: 'apartment',
    bedrooms: 3,
    area_sqm: 120 + i * 10,
    price_per_sqm: Math.round((price / (120 + i * 10)) * 100) / 100,
    recorded_at: '2099-01-15',
    run_type: 'full',
  }));

  // 5 x houses in Valencia — no bedrooms data (tests '' bucket)
  const valenciaHouses = [60000, 60000, 60000, 60000, 60000].map((price, i) => ({
    listing_id: testListingIds[12 + i],
    price,
    currency: 'USD',
    city: 'Valencia',
    state: 'Carabobo',
    property_type: 'house',
    bedrooms: null,
    area_sqm: 150 + i * 50,
    price_per_sqm: Math.round((price / (150 + i * 50)) * 100) / 100,
    recorded_at: '2099-01-15',
    run_type: 'full',
  }));

  // Daily-run listing that should be EXCLUDED
  const dailyListing = {
    listing_id: testListingIds[17],
    price: 999999,
    currency: 'USD',
    city: 'Caracas',
    state: 'Miranda',
    property_type: 'apartment',
    bedrooms: 2,
    area_sqm: 50,
    price_per_sqm: 19999.98,
    recorded_at: '2099-01-20',
    run_type: 'daily',
  };

  // Full-run outlier that should be trimmed by percentile filtering
  const fullRunOutlier = {
    listing_id: testListingIds[18],
    price: 999999,
    currency: 'USD',
    city: 'Caracas',
    state: 'Miranda',
    property_type: 'apartment',
    bedrooms: 2,
    area_sqm: 50,
    price_per_sqm: 19999.98,
    recorded_at: '2099-01-18',
    run_type: 'full',
  };

  // Duplicate: same listing_id as caracas2bed[0] but later date, different price
  const duplicateListing = {
    listing_id: testListingIds[0],
    price: 64000, // was 56k — tests dedup (latest wins)
    currency: 'USD',
    city: 'Caracas',
    state: 'Miranda',
    property_type: 'apartment',
    bedrooms: 2,
    area_sqm: 80,
    price_per_sqm: 800,
    recorded_at: '2099-01-25',
    run_type: 'full',
  };

  // --- Previous period fixtures (for change % and repeat-listing tests) ---

  // Same 6 listing IDs as caracas2bed but at lower $/sqm last month
  const prevCaracas2bed = [48000, 54000, 60000, 60000, 66000, 72000].map((price, i) => ({
    listing_id: testListingIds[i],
    price,
    currency: 'USD',
    city: 'Caracas',
    state: 'Miranda',
    property_type: 'apartment',
    bedrooms: 2,
    area_sqm: 80 + i * 10,
    price_per_sqm: Math.round((price / (80 + i * 10)) * 100) / 100,
    recorded_at: '2098-12-15',
    run_type: 'full',
  }));

  // Previous period outlier
  const prevOutlier = {
    listing_id: testListingIds[19],
    price: 999999,
    currency: 'USD',
    city: 'Caracas',
    state: 'Miranda',
    property_type: 'apartment',
    bedrooms: 2,
    area_sqm: 50,
    price_per_sqm: 19999.98,
    recorded_at: '2098-12-20',
    run_type: 'full',
  };

  const allFixtures = [
    ...caracas2bed,
    ...caracas3bed,
    ...valenciaHouses,
    dailyListing,
    fullRunOutlier,
    duplicateListing,
    ...prevCaracas2bed,
    prevOutlier,
  ];

  const { error } = await supabase
    .from('price_history')
    .upsert(allFixtures, { onConflict: 'listing_id,recorded_at' });

  if (error) {
    console.error('Failed to seed fixtures:', error);
    process.exit(1);
  }

  console.log(`  Seeded ${allFixtures.length} price_history rows\n`);
}

async function runAggregation() {
  console.log('⚙️  Running compute_market_stats RPC...');

  // Previous period first (needed for change %)
  const { error: prevError } = await supabase.rpc('compute_market_stats', {
    p_period_start: TEST_PREV_START,
    p_period_end: TEST_PREV_END,
    p_period_type: 'monthly',
    p_period_label: TEST_PREV_LABEL,
  });
  if (prevError) {
    console.error('Previous period RPC failed:', prevError);
    process.exit(1);
  }

  // Current period
  const { error } = await supabase.rpc('compute_market_stats', {
    p_period_start: TEST_PERIOD_START,
    p_period_end: TEST_PERIOD_END,
    p_period_type: 'monthly',
    p_period_label: TEST_PERIOD_LABEL,
  });
  if (error) {
    console.error('RPC failed:', error);
    process.exit(1);
  }

  console.log('  Done\n');
}

async function verifyResults() {
  console.log('🔍 Verifying results...\n');

  const { data: stats, error } = await supabase
    .from('market_stats')
    .select('*')
    .eq('period_type', 'monthly')
    .eq('period_start', TEST_PERIOD_START);

  if (error || !stats) {
    console.error('Failed to fetch results:', error);
    process.exit(1);
  }

  const find = (city: string, state: string, type: string, beds: string) =>
    stats.find(
      (s) =>
        s.city === city &&
        s.state === state &&
        s.property_type === type &&
        s.bedrooms_bucket === beds
    );

  // --- Test 1: Bedroom stratification ---
  console.log('Test 1: Bedroom stratification');
  const ccs2bed = find('Caracas', 'Miranda', 'apartment', '2');
  assert(ccs2bed !== undefined, 'Caracas/Miranda/apartment/2-bed row exists');
  if (ccs2bed) {
    // 6 listings, dedup replaces listing[0] 56k→64k.
    // Prices after dedup: 64k, 63k, 70k, 70k, 77k, 84k (outlier trimming may not remove any)
    assert(ccs2bed.listing_count === 6, `2-bed count = 6 (got ${ccs2bed.listing_count})`);
  }

  const ccs3bed = find('Caracas', 'Miranda', 'apartment', '3');
  assert(ccs3bed !== undefined, 'Caracas/Miranda/apartment/3-bed row exists');
  if (ccs3bed) {
    assert(ccs3bed.listing_count === 6, `3-bed count = 6 (got ${ccs3bed.listing_count})`);
  }

  // --- Test 2: $/sqm is the primary metric ---
  console.log('\nTest 2: Price per sqm computed');
  if (ccs2bed) {
    assert(
      ccs2bed.median_price_per_sqm !== null && ccs2bed.median_price_per_sqm > 0,
      `2-bed median_price_per_sqm > 0 (got ${ccs2bed.median_price_per_sqm})`
    );
  }
  if (ccs3bed) {
    assert(
      ccs3bed.median_price_per_sqm !== null && ccs3bed.median_price_per_sqm > 0,
      `3-bed median_price_per_sqm > 0 (got ${ccs3bed.median_price_per_sqm})`
    );
    // 3-bed should have lower $/sqm than 2-bed (bigger units, proportionally cheaper)
    if (ccs2bed && ccs3bed.median_price_per_sqm && ccs2bed.median_price_per_sqm) {
      assert(
        ccs3bed.median_price_per_sqm < ccs2bed.median_price_per_sqm,
        `3-bed $/sqm (${ccs3bed.median_price_per_sqm}) < 2-bed $/sqm (${ccs2bed.median_price_per_sqm})`
      );
    }
  }

  // --- Test 3: Sample confidence ---
  console.log('\nTest 3: Sample confidence');
  if (ccs2bed) {
    // 6 listings → 'low' (< 20)
    assert(ccs2bed.sample_confidence === 'low', `2-bed confidence = 'low' (got '${ccs2bed.sample_confidence}')`);
    // Note: low-confidence rows are hidden from the anon key via RLS.
    // This test uses the service role which bypasses RLS, so we can see them.
  }

  // National total should have more listings
  const national = find('', '', '', '');
  if (national) {
    assert(
      national.listing_count >= 17,
      `National count >= 17 (got ${national.listing_count})`
    );
    // With 17+ listings, still 'low' (< 20). Real data will produce medium/high.
    assert(
      national.sample_confidence === 'low',
      `National confidence = 'low' for test data (got '${national.sample_confidence}')`
    );
  }

  // --- Test 4: Daily exclusion ---
  console.log('\nTest 4: Daily-run exclusion');
  if (ccs2bed) {
    assert(
      ccs2bed.median_price < 200000,
      `Daily $999k listing excluded (median=${ccs2bed.median_price})`
    );
  }

  // --- Test 5: Null bedrooms → 'unknown' bucket (not '' which is rollups) ---
  console.log('\nTest 5: Null bedrooms → unknown bucket');
  const valHouseUnknown = find('Valencia', 'Carabobo', 'house', 'unknown');
  assert(valHouseUnknown !== undefined, "Valencia/Carabobo/house/'unknown' row exists");
  if (valHouseUnknown) {
    assert(valHouseUnknown.listing_count === 5, `Valencia house unknown-beds count = 5 (got ${valHouseUnknown.listing_count})`);
  }
  // The rollup row (all bedrooms) should also exist with '' bucket
  const valHouseRollup = find('Valencia', 'Carabobo', 'house', '');
  assert(valHouseRollup !== undefined, "Valencia/Carabobo/house/'' rollup row also exists");
  if (valHouseRollup && valHouseUnknown) {
    // Both should have the same count here since all Valencia houses have null bedrooms
    assert(
      valHouseRollup.listing_count === valHouseUnknown.listing_count,
      `Rollup count (${valHouseRollup.listing_count}) = unknown count (${valHouseUnknown.listing_count}) when all beds are null`
    );
  }

  // --- Test 6: Period-over-period change (based on $/sqm) ---
  console.log('\nTest 6: Period-over-period change %');
  if (ccs2bed) {
    assert(
      ccs2bed.price_change_pct !== null,
      `price_change_pct is not null (got ${ccs2bed.price_change_pct})`
    );
    if (ccs2bed.price_change_pct !== null) {
      assert(
        ccs2bed.price_change_pct > 0,
        `price_change_pct > 0 (prices increased) (got ${ccs2bed.price_change_pct}%)`
      );
    }
  }

  // --- Test 7: Grouping sets produce expected rows ---
  console.log('\nTest 7: Grouping sets');
  const mirandaAll = find('', 'Miranda', '', '');
  assert(mirandaAll !== undefined, 'Miranda state-level (all types, all beds) row exists');
  const aptAll = find('', '', 'apartment', '');
  assert(aptAll !== undefined, 'National apartment (all beds) row exists');
  const ccsAllType = find('Caracas', 'Miranda', '', '');
  assert(ccsAllType !== undefined, 'Caracas city-level (all types, all beds) row exists');

  // --- Test 8: Deduplication ---
  console.log('\nTest 8: Deduplication');
  // listing[0] was 56k on Jan 15, 64k on Jan 25. Latest should win.
  // If 56k was used, the 2-bed set would have a lower median.
  // We check the count is correct (no double-counting)
  if (ccs2bed) {
    assert(
      ccs2bed.listing_count === 6,
      `Deduped: 2-bed count still 6, not 7 (got ${ccs2bed.listing_count})`
    );
  }
}

async function verifyRepeatListings() {
  console.log('\nTest 9: Repeat-listing price change');

  const { data, error } = await supabase.rpc('compute_repeat_listing_stats', {
    p_period_start: TEST_PERIOD_START,
    p_period_end: TEST_PERIOD_END,
    p_prev_start: TEST_PREV_START,
    p_prev_end: TEST_PREV_END,
  });

  if (error) {
    console.error('  Repeat-listing RPC failed:', error);
    failed++;
    return;
  }

  assert(data !== null && data.length > 0, 'Repeat-listing stats returned rows');

  if (data && data.length > 0) {
    // The 6 caracas2bed listings exist in both periods → 6 repeats
    const national = data.find(
      (r: any) => r.city === '' && r.state === '' && r.property_type === ''
    );
    if (national) {
      assert(
        national.repeat_count >= 6,
        `National repeat count >= 6 (got ${national.repeat_count})`
      );
      assert(
        national.median_pct_change > 0,
        `Median price change > 0% (prices increased) (got ${national.median_pct_change}%)`
      );
      assert(
        national.pct_increased !== null,
        `pct_increased is computed (got ${national.pct_increased}%)`
      );
    } else {
      assert(false, 'National repeat-listing row exists');
    }
  }
}

async function cleanup() {
  console.log('\n🧹 Cleaning up test data...');

  await supabase
    .from('market_stats')
    .delete()
    .in('period_start', [TEST_PERIOD_START, TEST_PREV_START]);

  await supabase
    .from('price_history')
    .delete()
    .gte('recorded_at', '2098-01-01');

  console.log('  Done\n');
}

async function main() {
  console.log('🧪 Market Stats Aggregation Test Suite');
  console.log('   Methodology: Stratified Median $/sqm');
  console.log('='.repeat(50) + '\n');

  try {
    await setup();
    await seedFixtures();
    await runAggregation();
    await verifyResults();
    await verifyRepeatListings();
  } finally {
    await cleanup();
  }

  console.log('='.repeat(50));
  console.log(`Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.error('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
