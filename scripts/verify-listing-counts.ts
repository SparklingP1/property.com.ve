/**
 * Verify the listing counts are accurate
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function verify() {
  console.log('🔍 Verifying listing counts in SEO pages...\n');

  // Fetch all SEO pages
  const { data: seoPages } = await supabase
    .from('seo_page_content')
    .select('*');

  console.log(`📄 Total SEO pages: ${seoPages?.length}\n`);

  let totalFromDB = 0;
  let totalRecalculated = 0;
  let discrepancies = 0;

  // For each page, recalculate the actual count
  for (const page of seoPages || []) {
    const filters = page.filters;

    // Build query matching the page filters
    let query = supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    if (filters.city) {
      query = query.ilike('city', filters.city);
    }
    if (filters.state) {
      query = query.ilike('state', filters.state);
    }
    if (filters.property_type) {
      query = query.eq('property_type', filters.property_type);
    }
    if (filters.bedrooms) {
      query = query.eq('bedrooms', filters.bedrooms);
    }

    const { count: actualCount } = await query;

    totalFromDB += page.listing_count;
    totalRecalculated += actualCount || 0;

    if (actualCount !== page.listing_count) {
      discrepancies++;
      console.log(`❌ ${page.page_slug}`);
      console.log(`   DB says: ${page.listing_count}, Actually: ${actualCount}`);
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   Total from database listing_count: ${totalFromDB}`);
  console.log(`   Total recalculated (with duplicates): ${totalRecalculated}`);
  console.log(`   Pages with discrepancies: ${discrepancies} / ${seoPages?.length}`);

  // Now calculate UNIQUE listings
  console.log(`\n🔍 Calculating unique listings...`);

  const uniqueListingIds = new Set<string>();

  for (const page of seoPages || []) {
    const filters = page.filters;

    // Build query matching the page filters
    let query = supabase
      .from('listings')
      .select('id')
      .eq('active', true);

    if (filters.city) {
      query = query.ilike('city', filters.city);
    }
    if (filters.state) {
      query = query.ilike('state', filters.state);
    }
    if (filters.property_type) {
      query = query.eq('property_type', filters.property_type);
    }
    if (filters.bedrooms) {
      query = query.eq('bedrooms', filters.bedrooms);
    }

    const { data: listings } = await query;

    listings?.forEach(l => uniqueListingIds.add(l.id));
  }

  console.log(`✅ Unique listings accessible via SEO pages: ${uniqueListingIds.size}`);
}

verify().catch(console.error);
