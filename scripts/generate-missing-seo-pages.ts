/**
 * Generate SEO content for all missing pages with 3+ listings
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { generateSEOContent } from '../src/lib/seo-content-generator';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

if (!anthropicApiKey) {
  console.error('❌ ANTHROPIC_API_KEY not found in .env.local');
  process.exit(1);
}

interface PageOpportunity {
  city?: string;
  state?: string;
  property_type: 'apartment' | 'house' | 'land' | 'commercial' | 'office';
  bedrooms?: number;
  listing_count: number;
  slug: string;
}

function generateSlug(city: string | undefined, state: string | undefined, type: 'apartment' | 'house' | 'land' | 'commercial' | 'office', bedrooms: number | undefined): string {
  const typeSlug = type === 'apartment' ? 'apartments' :
                   type === 'house' ? 'houses' :
                   type === 'land' ? 'land' : type;

  if (bedrooms) {
    if (city) {
      const citySlug = city.toLowerCase().replace(/\s+/g, '-');
      return `/${bedrooms}-bedroom-${typeSlug}-${citySlug}`;
    }
  }

  if (city) {
    const citySlug = city.toLowerCase().replace(/\s+/g, '-');
    return `/${typeSlug}-${citySlug}`;
  }

  if (state) {
    const stateSlug = state.toLowerCase().replace(/\s+/g, '-');
    return `/${typeSlug}-${stateSlug}-state`;
  }

  return `/${typeSlug}`;
}

async function findAllOpportunities(): Promise<PageOpportunity[]> {
  console.log('🔍 Analyzing database for all page opportunities...\n');

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
    console.log(`Fetched ${allListings.length} listings...`);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  console.log(`\n📊 Total active listings: ${allListings.length}\n`);

  // Count all combinations
  const combinations = new Map<string, PageOpportunity>();

  allListings.forEach(l => {
    // City + Type
    if (l.city && l.property_type) {
      const key = `city:${l.city}|type:${l.property_type}`;
      const existing = combinations.get(key);
      if (existing) {
        existing.listing_count++;
      } else {
        combinations.set(key, {
          city: l.city,
          property_type: l.property_type,
          listing_count: 1,
          slug: generateSlug(l.city, undefined, l.property_type, undefined),
        });
      }

      // City + Type + Bedrooms
      if (l.bedrooms && l.bedrooms > 0) {
        const bedsKey = `city:${l.city}|type:${l.property_type}|beds:${l.bedrooms}`;
        const existingBeds = combinations.get(bedsKey);
        if (existingBeds) {
          existingBeds.listing_count++;
        } else {
          combinations.set(bedsKey, {
            city: l.city,
            property_type: l.property_type,
            bedrooms: l.bedrooms,
            listing_count: 1,
            slug: generateSlug(l.city, undefined, l.property_type, l.bedrooms),
          });
        }
      }
    }

    // State + Type
    if (l.state && l.property_type) {
      const stateKey = `state:${l.state}|type:${l.property_type}`;
      const existingState = combinations.get(stateKey);
      if (existingState) {
        existingState.listing_count++;
      } else {
        combinations.set(stateKey, {
          state: l.state,
          property_type: l.property_type,
          listing_count: 1,
          slug: generateSlug(undefined, l.state, l.property_type, undefined),
        });
      }
    }
  });

  // Filter to 3+ listings
  const opportunities = Array.from(combinations.values())
    .filter(p => p.listing_count >= 3)
    .sort((a, b) => b.listing_count - a.listing_count);

  console.log(`✅ Found ${opportunities.length} page opportunities with 3+ listings\n`);

  return opportunities;
}

async function generateMissingPages() {
  // Find all opportunities
  const allOpportunities = await findAllOpportunities();

  // Fetch existing pages
  const { data: existingPages } = await supabase
    .from('seo_page_content')
    .select('page_slug');

  const existingSlugs = new Set(existingPages?.map(p => p.page_slug) || []);

  console.log(`📄 Existing pages: ${existingSlugs.size}\n`);

  // Find missing pages
  const missingPages = allOpportunities.filter(p => !existingSlugs.has(p.slug));

  console.log(`❌ Missing pages: ${missingPages.length}\n`);

  if (missingPages.length === 0) {
    console.log('✅ All pages already exist!');
    return;
  }

  console.log(`🚀 Starting generation for ${missingPages.length} pages...\n`);
  console.log(`💰 Estimated cost: $${(missingPages.length * 0.005).toFixed(2)}\n`);

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < missingPages.length; i++) {
    const page = missingPages[i];
    const progress = `[${i + 1}/${missingPages.length}]`;

    console.log(`${progress} Generating: ${page.slug}`);

    try {
      // Generate SEO content
      const filters = {
        city: page.city,
        state: page.state,
        property_type: page.property_type,
        bedrooms: page.bedrooms,
      };

      const content = await generateSEOContent(
        filters,
        page.listing_count,
        anthropicApiKey!
      );

      // Insert into database
      const { error } = await supabase
        .from('seo_page_content')
        .insert({
          page_slug: page.slug,
          h1: content.h1,
          description: content.description,
          meta_title: content.meta_title,
          meta_description: content.meta_description,
          keywords: content.keywords,
          filters: filters,
          listing_count: page.listing_count,
        });

      if (error) {
        console.error(`   ❌ Database error: ${error.message}`);
        errorCount++;
      } else {
        console.log(`   ✅ Success (${page.listing_count} listings)`);
        successCount++;
      }

      // Rate limiting
      if (i < missingPages.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error: any) {
      console.error(`   ❌ Error: ${error.message}`);
      errorCount++;
    }
  }

  console.log(`\n📊 Generation Summary:`);
  console.log(`   ✅ Successfully generated: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📈 Total pages now: ${existingSlugs.size + successCount}`);
}

generateMissingPages().catch(console.error);
