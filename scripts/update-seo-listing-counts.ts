/**
 * Update all SEO page listing counts to reflect current database state
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

// Use anon key (RLS is disabled on seo_page_content table)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseKey) {
  console.error('❌ SUPABASE_KEY not found in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateCounts() {
  console.log('🔄 Updating SEO page listing counts...\n');

  // Fetch all SEO pages
  const { data: seoPages, error: fetchError } = await supabase
    .from('seo_page_content')
    .select('*');

  if (fetchError) {
    console.error('❌ Error fetching SEO pages:', fetchError);
    process.exit(1);
  }

  console.log(`📄 Found ${seoPages?.length} SEO pages to update\n`);

  let updated = 0;
  let unchanged = 0;
  let errors = 0;

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

    const { count: actualCount, error: countError } = await query;

    if (countError) {
      console.error(`❌ Error counting ${page.page_slug}:`, countError);
      errors++;
      continue;
    }

    // Update if count changed
    if (actualCount !== page.listing_count) {
      const { error: updateError } = await supabase
        .from('seo_page_content')
        .update({
          listing_count: actualCount || 0,
          updated_at: new Date().toISOString(),
        })
        .eq('id', page.id);

      if (updateError) {
        console.error(`❌ Error updating ${page.page_slug}:`, updateError);
        errors++;
      } else {
        console.log(`✅ ${page.page_slug}: ${page.listing_count} → ${actualCount}`);
        updated++;
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated} pages`);
  console.log(`   ⏭️  Unchanged: ${unchanged} pages`);
  console.log(`   ❌ Errors: ${errors} pages`);

  // Calculate new total
  const { data: updatedPages } = await supabase
    .from('seo_page_content')
    .select('listing_count');

  const total = updatedPages?.reduce((sum, p) => sum + p.listing_count, 0) || 0;

  console.log(`\n🎯 New total (with duplicates): ${total.toLocaleString()}`);
  console.log(`💡 Note: This counts duplicates. Unique listings accessible: ~7,700+`);
}

updateCounts().catch(console.error);
