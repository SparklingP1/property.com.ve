/**
 * Check how many UNIQUE listings are accessible via SEO pages
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function analyze() {
  console.log('🔍 Checking unique listing coverage...\n');

  // Fetch ALL listings with pagination
  let allListings: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('listings')
      .select('id, city, state, property_type, bedrooms')
      .eq('active', true)
      .range(from, from + pageSize - 1);

    if (!data || data.length === 0) break;
    allListings = allListings.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`📊 Total active listings: ${allListings.length}`);

  // Fetch all SEO pages
  const { data: seoPages } = await supabase
    .from('seo_page_content')
    .select('*');

  console.log(`📄 Total SEO pages: ${seoPages?.length}\n`);

  // Find unique listings that match at least one SEO page
  const coveredListingIds = new Set<string>();

  allListings.forEach(listing => {
    const matchesAnyPage = seoPages?.some(page => {
      const filters = page.filters;

      // Check if listing matches this page's filters
      if (filters.city && listing.city?.toLowerCase() !== filters.city?.toLowerCase()) return false;
      if (filters.state && listing.state?.toLowerCase() !== filters.state?.toLowerCase()) return false;
      if (filters.property_type && listing.property_type !== filters.property_type) return false;
      if (filters.bedrooms && listing.bedrooms !== filters.bedrooms) return false;

      return true;
    });

    if (matchesAnyPage) {
      coveredListingIds.add(listing.id);
    }
  });

  console.log(`✅ Unique listings accessible via SEO pages: ${coveredListingIds.size}`);
  console.log(`📊 Total active listings: ${allListings.length}`);
  console.log(`❌ Not accessible via SEO pages: ${allListings.length - coveredListingIds.size}`);
  console.log(`📈 Coverage: ${Math.round((coveredListingIds.size / allListings.length) * 100)}%\n`);

  // Breakdown of non-covered listings
  const notCovered = allListings.filter(l => !coveredListingIds.has(l.id));

  const reasons: Record<string, number> = {
    'Missing city': 0,
    'Missing property_type': 0,
    'Valid but < 3 threshold': 0,
  };

  notCovered.forEach(l => {
    if (!l.city) {
      reasons['Missing city']++;
    } else if (!l.property_type) {
      reasons['Missing property_type']++;
    } else {
      reasons['Valid but < 3 threshold']++;
    }
  });

  console.log('📋 Why listings aren\'t covered:');
  Object.entries(reasons).forEach(([reason, count]) => {
    console.log(`  ${reason}: ${count}`);
  });

  // Show sample of "valid but not covered" listings
  const validButNotCovered = notCovered.filter(l => l.city && l.property_type);
  console.log(`\n💡 Sample of valid listings NOT covered (small cities/combinations):`);
  validButNotCovered.slice(0, 10).forEach(l => {
    console.log(`  ${l.city} - ${l.property_type}${l.bedrooms ? ` - ${l.bedrooms} bed` : ''}`);
  });
}

analyze().catch(console.error);
