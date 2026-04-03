/**
 * One-time backfill: creates a Day 0 price_history snapshot for all active listings.
 *
 * Run AFTER applying migration 013_add_price_history.sql to Supabase.
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/backfill-price-history.ts
 *
 * Or set SUPABASE_SERVICE_ROLE_KEY in .env.local and:
 *   source .env.local && npx tsx scripts/backfill-price-history.ts
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
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY env var required');
  console.error('   price_history has no public insert policy — anon key will not work');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, serviceRoleKey);

const BATCH_SIZE = 500;

async function backfill() {
  console.log('📊 Backfilling price_history with current active listings...\n');

  // Count total active listings
  const { count, error: countError } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  if (countError) {
    console.error('Error counting listings:', countError);
    process.exit(1);
  }

  console.log(`Total active listings: ${count}\n`);

  let inserted = 0;
  let skipped = 0;
  let errors = 0;
  let offset = 0;

  while (true) {
    const { data: listings, error } = await supabase
      .from('listings')
      .select('id, price, currency, city, state, property_type, bedrooms, area_sqm')
      .eq('active', true)
      .gt('price', 0)
      .order('id')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error(`Error fetching listings at offset ${offset}:`, error);
      errors++;
      offset += BATCH_SIZE;
      continue;
    }

    if (!listings || listings.length === 0) break;

    const snapshots = listings
      .filter((l) => l.price && l.price > 0)
      .map((l) => ({
        listing_id: l.id,
        price: l.price,
        currency: l.currency || 'USD',
        city: l.city,
        state: l.state,
        property_type: l.property_type,
        bedrooms: l.bedrooms,
        area_sqm: l.area_sqm,
        price_per_sqm:
          l.area_sqm && l.area_sqm > 0
            ? Math.round((l.price / l.area_sqm) * 100) / 100
            : null,
        run_type: 'full',
      }));

    if (snapshots.length > 0) {
      const { error: insertError, data } = await supabase
        .from('price_history')
        .upsert(snapshots, { onConflict: 'listing_id,recorded_at' })
        .select('id');

      if (insertError) {
        console.error(`Batch insert error at offset ${offset}:`, insertError);
        errors++;
      } else {
        const count = data?.length || snapshots.length;
        inserted += count;
        console.log(
          `  ✅ Batch ${Math.floor(offset / BATCH_SIZE) + 1}: ${count} snapshots inserted`
        );
      }
    }

    skipped += listings.length - snapshots.length;
    offset += BATCH_SIZE;

    if (listings.length < BATCH_SIZE) break;
  }

  console.log('\n' + '='.repeat(50));
  console.log('📊 BACKFILL COMPLETE');
  console.log(`   Inserted: ${inserted} price snapshots`);
  console.log(`   Skipped:  ${skipped} (no valid price)`);
  console.log(`   Errors:   ${errors}`);
  console.log('='.repeat(50));
}

backfill().catch((error) => {
  console.error(error);
  process.exit(1);
});
