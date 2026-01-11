/**
 * Pre-generate SEO content for all programmatic landing pages
 * This script should be run once to populate the seo_page_content table
 *
 * Requirements:
 * 1. Database migration 010_create_seo_page_content.sql must be applied
 * 2. ANTHROPIC_API_KEY environment variable must be set
 * 3. SUPABASE_SERVICE_KEY environment variable must be set (for write access)
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... SUPABASE_SERVICE_KEY=... npx tsx scripts/generate-all-seo-content.ts
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { generateSEOContent, type GeneratedSEOContent } from '../src/lib/seo-content-generator';
import { parseSEOUrl, type SEOPageFilters } from '../src/lib/seo-url-parser';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

interface PageOpportunity {
  city: string;
  state: string;
  property_type: string;
  bedrooms: number | null;
  listing_count: number;
  suggested_url: string;
}

interface AnalysisOutput {
  generated_at: string;
  total_pages: number;
  breakdown: {
    city_type: number;
    city_type_bedrooms: number;
    state_type: number;
  };
  pages: PageOpportunity[];
}

async function main() {
  console.log('🚀 SEO Content Pre-Generation Script\n');

  // Validate environment variables
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anthropicKey) {
    console.error('❌ Error: ANTHROPIC_API_KEY environment variable is required');
    console.error('   Get your API key from: https://console.anthropic.com/');
    console.error('   Set it with: export ANTHROPIC_API_KEY=sk-...');
    process.exit(1);
  }

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Error: Supabase credentials not found');
    process.exit(1);
  }

  // Load analysis file
  const analysisPath = path.join(__dirname, 'seo-pages-analysis.json');
  if (!fs.existsSync(analysisPath)) {
    console.error(`❌ Error: Analysis file not found at ${analysisPath}`);
    console.error('   Run: npx tsx scripts/analyze-seo-opportunities.ts first');
    process.exit(1);
  }

  const analysis: AnalysisOutput = JSON.parse(fs.readFileSync(analysisPath, 'utf-8'));

  console.log(`📊 Found ${analysis.total_pages} pages to generate content for\n`);
  console.log(`   City + Type: ${analysis.breakdown.city_type}`);
  console.log(`   City + Type + Bedrooms: ${analysis.breakdown.city_type_bedrooms}`);
  console.log(`   State + Type: ${analysis.breakdown.state_type}\n`);

  // Connect to Supabase
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Check if table exists and is accessible
  const { error: tableError } = await supabase
    .from('seo_page_content')
    .select('id')
    .limit(1);

  if (tableError) {
    console.error('❌ Error: Cannot access seo_page_content table');
    console.error('   Make sure migration 010_create_seo_page_content.sql has been applied');
    console.error(`   Error details: ${tableError.message}`);
    process.exit(1);
  }

  console.log('✅ Connected to Supabase\n');

  // Ask for confirmation
  console.log('⚠️  This will generate content using Claude API (costs apply)');
  console.log(`   Estimated API calls: ${analysis.total_pages}`);
  console.log(`   Estimated cost: ~$${(analysis.total_pages * 0.005).toFixed(2)} USD`);
  console.log(`   Time estimate: ~${Math.ceil(analysis.total_pages / 60)} minutes\n`);

  // For now, proceed automatically (user can Ctrl+C to cancel)
  console.log('Starting content generation in 3 seconds... (Ctrl+C to cancel)\n');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (let i = 0; i < analysis.pages.length; i++) {
    const page = analysis.pages[i];
    const progress = `[${i + 1}/${analysis.total_pages}]`;

    console.log(`${progress} Processing: ${page.suggested_url}`);

    // Parse URL to get filters
    const parsed = parseSEOUrl(page.suggested_url);

    if (!parsed.isValid) {
      console.log(`   ⚠️  Skipping: Invalid URL format - ${parsed.error}`);
      skipCount++;
      continue;
    }

    // Check if content already exists
    const { data: existing } = await supabase
      .from('seo_page_content')
      .select('id, generated_at')
      .eq('page_slug', page.suggested_url)
      .single();

    if (existing) {
      console.log(`   ⏭️  Already exists (generated ${new Date(existing.generated_at).toLocaleDateString()})`);
      skipCount++;
      continue;
    }

    try {
      // Generate content using Claude API
      const content: GeneratedSEOContent = await generateSEOContent(
        parsed.filters,
        page.listing_count,
        anthropicKey
      );

      // Insert into database
      const { error: insertError } = await supabase
        .from('seo_page_content')
        .insert({
          page_slug: page.suggested_url,
          h1: content.h1,
          description: content.description,
          meta_title: content.meta_title,
          meta_description: content.meta_description,
          keywords: content.keywords,
          filters: parsed.filters,
          listing_count: page.listing_count,
        });

      if (insertError) {
        console.log(`   ❌ Database error: ${insertError.message}`);
        errorCount++;
        continue;
      }

      console.log(`   ✅ Generated and saved`);
      console.log(`      "${content.description.substring(0, 80)}..."`);
      successCount++;

      // Rate limiting: Wait 1 second between API calls
      if (i < analysis.total_pages - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      errorCount++;

      // If we hit rate limits, wait longer
      if (error instanceof Error && error.message.includes('rate')) {
        console.log('   ⏸️  Rate limited, waiting 60 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }
  }

  console.log('\n📊 GENERATION COMPLETE\n');
  console.log(`   ✅ Successfully generated: ${successCount}`);
  console.log(`   ⏭️  Skipped (already exists): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log(`   📈 Total pages in database: ${successCount + skipCount}\n`);

  // Verify database
  const { count } = await supabase
    .from('seo_page_content')
    .select('*', { count: 'exact', head: true });

  console.log(`✅ Database verification: ${count} total records in seo_page_content table\n`);
}

main()
  .then(() => {
    console.log('✅ Script complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
