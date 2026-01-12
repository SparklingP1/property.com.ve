/**
 * Find SEO page opportunities we're missing
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function findMissing() {
  console.log('🔍 Finding missing SEO page opportunities...\n');

  // Fetch all active listings
  let allListings: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data } = await supabase
      .from('listings')
      .select('city, state, property_type, bedrooms')
      .eq('active', true)
      .range(from, from + pageSize - 1);

    if (!data || data.length === 0) break;
    allListings = allListings.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`Total listings: ${allListings.length}\n`);

  // Count all combinations with 3+ listings
  const cityTypeCombos = new Map<string, number>();
  const cityTypeBedroomsCombos = new Map<string, number>();
  const stateTypeCombos = new Map<string, number>();

  allListings.forEach(l => {
    if (l.city && l.property_type) {
      const key = `${l.city}|${l.property_type}`;
      cityTypeCombos.set(key, (cityTypeCombos.get(key) || 0) + 1);

      if (l.bedrooms && l.bedrooms > 0) {
        const bedsKey = `${l.city}|${l.property_type}|${l.bedrooms}`;
        cityTypeBedroomsCombos.set(bedsKey, (cityTypeBedroomsCombos.get(bedsKey) || 0) + 1);
      }
    }

    if (l.state && l.property_type) {
      const stateKey = `${l.state}|${l.property_type}`;
      stateTypeCombos.set(stateKey, (stateTypeCombos.get(stateKey) || 0) + 1);
    }
  });

  // Filter to 3+ listings
  const cityType3Plus = Array.from(cityTypeCombos.entries()).filter(([, count]) => count >= 3);
  const cityTypeBeds3Plus = Array.from(cityTypeBedroomsCombos.entries()).filter(([, count]) => count >= 3);
  const stateType3Plus = Array.from(stateTypeCombos.entries()).filter(([, count]) => count >= 3);

  console.log('📊 Potential pages with 3+ listings:');
  console.log(`   City + Type: ${cityType3Plus.length}`);
  console.log(`   City + Type + Bedrooms: ${cityTypeBeds3Plus.length}`);
  console.log(`   State + Type: ${stateType3Plus.length}`);
  console.log(`   TOTAL POTENTIAL: ${cityType3Plus.length + cityTypeBeds3Plus.length + stateType3Plus.length}\n`);

  // Fetch existing pages
  const { data: existingPages } = await supabase
    .from('seo_page_content')
    .select('filters');

  console.log(`📄 Current pages in database: ${existingPages?.length}\n`);

  // Find what we're missing
  let missingCityType = 0;
  let missingCityTypeBeds = 0;
  let missingStateType = 0;

  // Check city+type
  cityType3Plus.forEach(([combo, count]) => {
    const [city, type] = combo.split('|');
    const exists = existingPages?.some(p =>
      p.filters.city?.toLowerCase() === city.toLowerCase() &&
      p.filters.property_type === type &&
      !p.filters.bedrooms
    );
    if (!exists) missingCityType++;
  });

  // Check city+type+bedrooms
  cityTypeBeds3Plus.forEach(([combo, count]) => {
    const [city, type, beds] = combo.split('|');
    const exists = existingPages?.some(p =>
      p.filters.city?.toLowerCase() === city.toLowerCase() &&
      p.filters.property_type === type &&
      p.filters.bedrooms === parseInt(beds)
    );
    if (!exists) missingCityTypeBeds++;
  });

  // Check state+type
  stateType3Plus.forEach(([combo, count]) => {
    const [state, type] = combo.split('|');
    const exists = existingPages?.some(p =>
      p.filters.state?.toLowerCase() === state.toLowerCase() &&
      p.filters.property_type === type &&
      !p.filters.city &&
      !p.filters.bedrooms
    );
    if (!exists) missingStateType++;
  });

  console.log('❌ Missing pages:');
  console.log(`   City + Type: ${missingCityType}`);
  console.log(`   City + Type + Bedrooms: ${missingCityTypeBeds}`);
  console.log(`   State + Type: ${missingStateType}`);
  console.log(`   TOTAL MISSING: ${missingCityType + missingCityTypeBeds + missingStateType}`);
}

findMissing().catch(console.error);
