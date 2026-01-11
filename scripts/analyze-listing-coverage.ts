/**
 * Analyze which listings are covered by SEO pages
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
  console.log('🔍 Analyzing listing coverage...\n');

  // Total active listings
  const { count: totalActive } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('active', true);

  console.log('📊 Total active listings:', totalActive);

  // Listings with city
  const { count: withCity } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .not('city', 'is', null)
    .neq('city', '');

  console.log('📍 Listings with city:', withCity);

  // Listings with state
  const { count: withState } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .not('state', 'is', null)
    .neq('state', '');

  console.log('🏛️  Listings with state:', withState);

  // Listings with property_type
  const { count: withType } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .not('property_type', 'is', null)
    .neq('property_type', '');

  console.log('🏠 Listings with property_type:', withType);

  // Property type distribution
  const { data: typeData } = await supabase
    .from('listings')
    .select('property_type')
    .eq('active', true);

  const typeCount = typeData?.reduce((acc, l) => {
    const type = l.property_type || 'null';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n📋 Property type distribution:');
  Object.entries(typeCount || {}).sort((a, b) => b[1] - a[1]).forEach(([type, count]) => {
    console.log(`  ${type}: ${count}`);
  });

  // City distribution (top 20)
  const { data: cityData } = await supabase
    .from('listings')
    .select('city')
    .eq('active', true)
    .not('city', 'is', null)
    .neq('city', '');

  const cityCount = cityData?.reduce((acc, l) => {
    const city = l.city || 'null';
    acc[city] = (acc[city] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  console.log('\n🌆 Top 20 cities:');
  Object.entries(cityCount || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .forEach(([city, count]) => {
      console.log(`  ${city}: ${count}`);
    });

  // Total covered by SEO pages
  const { data: seoPages } = await supabase
    .from('seo_page_content')
    .select('listing_count');

  const totalCovered = seoPages?.reduce((sum, page) => sum + page.listing_count, 0) || 0;

  console.log('\n📄 SEO pages coverage:');
  console.log(`  Total listings in SEO pages: ${totalCovered}`);
  console.log(`  Total active listings: ${totalActive}`);
  console.log(`  Missing: ${(totalActive || 0) - totalCovered} (${Math.round(((totalActive || 0) - totalCovered) / (totalActive || 1) * 100)}%)`);

  // Check for listings with incomplete data
  const { data: incompleteListings } = await supabase
    .from('listings')
    .select('id, city, state, property_type, title')
    .eq('active', true)
    .or('city.is.null,city.eq.,state.is.null,state.eq.,property_type.is.null,property_type.eq.')
    .limit(10);

  console.log('\n🔍 Sample of listings with incomplete location/type data:');
  incompleteListings?.forEach(l => {
    console.log(`  ${l.title?.substring(0, 60)}... | city: ${l.city || 'null'} | state: ${l.state || 'null'} | type: ${l.property_type || 'null'}`);
  });
}

analyze().catch(console.error);
