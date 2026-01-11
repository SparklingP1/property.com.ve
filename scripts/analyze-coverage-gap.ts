/**
 * Analyze why 6000 listings aren't covered by SEO pages
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
  console.log('🔍 Analyzing why listings aren\'t in SEO pages...\n');

  // Fetch ALL listings with pagination
  let allListings: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('city, property_type, bedrooms')
      .eq('active', true)
      .range(from, from + pageSize - 1);

    if (error || !data || data.length === 0) break;
    allListings = allListings.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`📊 Total listings: ${allListings.length}`);

  // Count unique city + property_type combinations
  const cityTypeCombos = new Map<string, number>();
  const cityTypeBedroomsCombos = new Map<string, number>();

  allListings.forEach(l => {
    if (l.city && l.property_type) {
      const key = `${l.city}|${l.property_type}`;
      cityTypeCombos.set(key, (cityTypeCombos.get(key) || 0) + 1);

      if (l.bedrooms && l.bedrooms > 0) {
        const bedsKey = `${l.city}|${l.property_type}|${l.bedrooms}`;
        cityTypeBedroomsCombos.set(bedsKey, (cityTypeBedroomsCombos.get(bedsKey) || 0) + 1);
      }
    }
  });

  console.log(`\n📍 Unique city + property_type combinations: ${cityTypeCombos.size}`);
  console.log(`🛏️  Unique city + property_type + bedrooms combinations: ${cityTypeBedroomsCombos.size}`);

  // Count how many meet the 3+ threshold
  const cityTypeMeeting3 = Array.from(cityTypeCombos.values()).filter(count => count >= 3).length;
  const cityTypeBedroomsMeeting3 = Array.from(cityTypeBedroomsCombos.values()).filter(count => count >= 3).length;

  console.log(`\n✅ City+Type combos with 3+ listings: ${cityTypeMeeting3}`);
  console.log(`✅ City+Type+Bedrooms combos with 3+ listings: ${cityTypeBedroomsMeeting3}`);

  // How many SEO pages do we have?
  const { data: seoPages } = await supabase
    .from('seo_page_content')
    .select('*');

  console.log(`\n📄 SEO pages created: ${seoPages?.length || 0}`);

  // Count listings covered
  let coveredListings = 0;
  seoPages?.forEach(page => {
    const filters = page.filters;
    const matching = allListings.filter(l => {
      if (filters.city && l.city !== filters.city) return false;
      if (filters.state && l.state !== filters.state) return false;
      if (filters.property_type && l.property_type !== filters.property_type) return false;
      if (filters.bedrooms && l.bedrooms !== filters.bedrooms) return false;
      return true;
    });
    coveredListings += matching.length;
  });

  // Find listings with city+type but NOT covered
  const listingsWithValidData = allListings.filter(l => l.city && l.property_type);
  console.log(`\n📊 Listings with city AND property_type: ${listingsWithValidData.length}`);
  console.log(`📄 Listings covered by SEO pages: ${coveredListings}`);
  console.log(`❌ Gap: ${listingsWithValidData.length - coveredListings}`);

  // Sample of combinations with only 1-2 listings
  console.log(`\n💡 Sample of city+type combinations with < 3 listings (why they\'re excluded):`);
  Array.from(cityTypeCombos.entries())
    .filter(([, count]) => count < 3)
    .slice(0, 20)
    .forEach(([key, count]) => {
      const [city, type] = key.split('|');
      console.log(`  ${city} - ${type}: ${count} listing(s)`);
    });

  console.log(`\n💡 Total combinations with < 3 listings: ${Array.from(cityTypeCombos.values()).filter(c => c < 3).length}`);
}

analyze().catch(console.error);
