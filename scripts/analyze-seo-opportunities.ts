/**
 * Analyze database to find all viable SEO page combinations
 * Minimum threshold: 3+ active listings per combination
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

interface PageOpportunity {
  city: string;
  state: string;
  property_type: string;
  bedrooms: number | null;
  listing_count: number;
  suggested_url: string;
}

function generateFlatUrl(
  city: string,
  propertyType: string,
  bedrooms: number | null
): string {
  const citySlug = city.toLowerCase().replace(/\s+/g, '-');
  const typeSlug = propertyType === 'apartment' ? 'apartments' :
                   propertyType === 'house' ? 'houses' :
                   propertyType === 'land' ? 'land' : propertyType;

  if (bedrooms && bedrooms > 0) {
    return `/${bedrooms}-bedroom-${typeSlug}-${citySlug}`;
  }

  return `/${typeSlug}-${citySlug}`;
}

async function analyzeOpportunities() {
  console.log('🔍 Analyzing SEO page opportunities...\n');

  // Query 1: City + Property Type combinations
  const { data: cityTypeData, error: cityTypeError } = await supabase
    .from('listings')
    .select('city, state, property_type')
    .eq('active', true)
    .not('city', 'is', null)
    .not('state', 'is', null)
    .not('property_type', 'is', null)
    .in('property_type', ['apartment', 'house', 'land']);

  if (cityTypeError) {
    console.error('Error fetching city+type data:', cityTypeError);
    return;
  }

  // Count combinations
  const cityTypeCounts = new Map<string, { count: number; state: string; city: string; type: string }>();

  cityTypeData?.forEach((listing) => {
    const key = `${listing.city}|${listing.property_type}`;
    const existing = cityTypeCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      cityTypeCounts.set(key, {
        count: 1,
        state: listing.state,
        city: listing.city,
        type: listing.property_type
      });
    }
  });

  // Filter for 3+ listings
  const viableCityTypePages: PageOpportunity[] = [];
  cityTypeCounts.forEach((data, key) => {
    if (data.count >= 3) {
      viableCityTypePages.push({
        city: data.city,
        state: data.state,
        property_type: data.type,
        bedrooms: null,
        listing_count: data.count,
        suggested_url: generateFlatUrl(data.city, data.type, null)
      });
    }
  });

  // Query 2: City + Property Type + Bedrooms combinations
  const { data: fullData, error: fullError } = await supabase
    .from('listings')
    .select('city, state, property_type, bedrooms')
    .eq('active', true)
    .not('city', 'is', null)
    .not('state', 'is', null)
    .not('property_type', 'is', null)
    .not('bedrooms', 'is', null)
    .in('property_type', ['apartment', 'house']);

  if (fullError) {
    console.error('Error fetching full data:', fullError);
    return;
  }

  // Count combinations
  const fullCounts = new Map<string, { count: number; state: string; city: string; type: string; beds: number }>();

  fullData?.forEach((listing) => {
    const key = `${listing.city}|${listing.property_type}|${listing.bedrooms}`;
    const existing = fullCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      fullCounts.set(key, {
        count: 1,
        state: listing.state,
        city: listing.city,
        type: listing.property_type,
        beds: listing.bedrooms
      });
    }
  });

  // Filter for 3+ listings
  const viableFullPages: PageOpportunity[] = [];
  fullCounts.forEach((data, key) => {
    if (data.count >= 3) {
      viableFullPages.push({
        city: data.city,
        state: data.state,
        property_type: data.type,
        bedrooms: data.beds,
        listing_count: data.count,
        suggested_url: generateFlatUrl(data.city, data.type, data.beds)
      });
    }
  });

  // Query 3: State + Property Type combinations
  const { data: stateTypeData, error: stateTypeError } = await supabase
    .from('listings')
    .select('state, property_type')
    .eq('active', true)
    .not('state', 'is', null)
    .not('property_type', 'is', null)
    .in('property_type', ['apartment', 'house', 'land']);

  if (stateTypeError) {
    console.error('Error fetching state+type data:', stateTypeError);
    return;
  }

  const stateTypeCounts = new Map<string, { count: number; state: string; type: string }>();

  stateTypeData?.forEach((listing) => {
    const key = `${listing.state}|${listing.property_type}`;
    const existing = stateTypeCounts.get(key);
    if (existing) {
      existing.count++;
    } else {
      stateTypeCounts.set(key, {
        count: 1,
        state: listing.state,
        type: listing.property_type
      });
    }
  });

  const viableStateTypePages: PageOpportunity[] = [];
  stateTypeCounts.forEach((data, key) => {
    if (data.count >= 3) {
      const stateSlug = data.state.toLowerCase().replace(/\s+/g, '-');
      const typeSlug = data.type === 'apartment' ? 'apartments' :
                       data.type === 'house' ? 'houses' : data.type;

      viableStateTypePages.push({
        city: '',
        state: data.state,
        property_type: data.type,
        bedrooms: null,
        listing_count: data.count,
        suggested_url: `/${typeSlug}-${stateSlug}-state`
      });
    }
  });

  // Print results
  console.log('📊 ANALYSIS RESULTS\n');
  console.log(`✅ Viable City + Property Type pages: ${viableCityTypePages.length}`);
  console.log(`✅ Viable City + Type + Bedrooms pages: ${viableFullPages.length}`);
  console.log(`✅ Viable State + Property Type pages: ${viableStateTypePages.length}`);
  console.log(`📈 TOTAL PAGES: ${viableCityTypePages.length + viableFullPages.length + viableStateTypePages.length}\n`);

  // Show top 20 by listing count
  const allPages = [...viableCityTypePages, ...viableFullPages, ...viableStateTypePages]
    .sort((a, b) => b.listing_count - a.listing_count);

  console.log('🏆 TOP 20 OPPORTUNITIES (by listing count):\n');
  allPages.slice(0, 20).forEach((page, i) => {
    const bedroomText = page.bedrooms ? ` | ${page.bedrooms} bed` : '';
    console.log(`${i + 1}. ${page.suggested_url}`);
    console.log(`   📍 ${page.city || page.state} | ${page.property_type}${bedroomText} | ${page.listing_count} listings\n`);
  });

  // Save full list to JSON
  const output = {
    generated_at: new Date().toISOString(),
    total_pages: allPages.length,
    breakdown: {
      city_type: viableCityTypePages.length,
      city_type_bedrooms: viableFullPages.length,
      state_type: viableStateTypePages.length
    },
    pages: allPages
  };

  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(__dirname, 'seo-pages-analysis.json');

  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Full analysis saved to: ${outputPath}`);

  // Distribution by city
  const cityDistribution = new Map<string, number>();
  allPages.forEach(page => {
    if (page.city) {
      cityDistribution.set(page.city, (cityDistribution.get(page.city) || 0) + 1);
    }
  });

  console.log('\n🌆 PAGES PER CITY (Top 10):\n');
  Array.from(cityDistribution.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .forEach(([city, count], i) => {
      console.log(`${i + 1}. ${city}: ${count} pages`);
    });
}

analyzeOpportunities()
  .then(() => {
    console.log('\n✅ Analysis complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
