/**
 * Generate Spanish translations for all SEO page content
 * Reads existing English content from seo_page_content and populates
 * h1_es, description_es, meta_title_es, meta_description_es, keywords_es
 *
 * Usage:
 *   npx tsx scripts/generate-spanish-seo-content.ts
 *   npx tsx scripts/generate-spanish-seo-content.ts --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BATCH_SIZE = 5; // Process 5 rows per API call to reduce costs
const DELAY_MS = 1500; // Delay between API calls

interface SEORow {
  id: string;
  page_slug: string;
  page_slug_es: string | null;
  h1: string;
  description: string;
  meta_title: string;
  meta_description: string;
  keywords: string[];
}

interface SpanishContent {
  h1_es: string;
  description_es: string;
  meta_title_es: string;
  meta_description_es: string;
  keywords_es: string[];
}

async function translateBatch(
  rows: SEORow[],
  anthropic: Anthropic
): Promise<Map<string, SpanishContent>> {
  const entries = rows.map((r, i) => `
--- Entry ${i + 1} (id: ${r.id}) ---
h1: ${r.h1}
description: ${r.description}
meta_title: ${r.meta_title}
meta_description: ${r.meta_description}
keywords: ${r.keywords.join(', ')}
`).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `You are translating real estate SEO content to Venezuelan Spanish for property.com.ve.

Translate the following ${rows.length} entries to Venezuelan Spanish. Use natural Venezuelan Spanish — not neutral or peninsular Spanish.

Key translation rules:
- "Apartments" → "Apartamentos" (not "Pisos")
- "Houses" → "Casas"
- "Land" → "Terrenos"
- "Bedrooms" → "Habitaciones"
- "for sale" → "en venta"
- "for rent" → "en alquiler"
- "listings" → "inmuebles" or "listados"
- Keep city/state names unchanged (Caracas, Maracaibo, etc.)
- meta_title must be 50-60 characters
- meta_description must be 140-155 characters
- Do NOT include " | Property.com.ve" in meta_title_es — the template adds it

${entries}

Return a JSON array with exactly ${rows.length} objects, in the same order as the entries above. Each object must have these fields:
{
  "id": "the id from the entry",
  "h1_es": "...",
  "description_es": "...",
  "meta_title_es": "...",
  "meta_description_es": "...",
  "keywords_es": ["...", "...", "..."]
}

Return ONLY the JSON array, no other text.`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse JSON response from Claude');
  }

  const results: Array<SpanishContent & { id: string }> = JSON.parse(jsonMatch[0]);
  const map = new Map<string, SpanishContent>();
  for (const result of results) {
    map.set(result.id, {
      h1_es: result.h1_es,
      description_es: result.description_es,
      meta_title_es: result.meta_title_es?.replace(/ \| Property\.com\.ve$/i, ''),
      meta_description_es: result.meta_description_es,
      keywords_es: result.keywords_es,
    });
  }
  return map;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`🇪🇸 Spanish SEO Content Generation${dryRun ? ' (DRY RUN)' : ''}\n`);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anthropicKey) {
    console.error('❌ ANTHROPIC_API_KEY is required');
    process.exit(1);
  }
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Supabase credentials not found');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Fetch all rows missing Spanish content
  const { data: rows, error } = await supabase
    .from('seo_page_content')
    .select('id, page_slug, page_slug_es, h1, description, meta_title, meta_description, keywords')
    .is('h1_es', null)
    .order('listing_count', { ascending: false });

  if (error) {
    console.error(`❌ Database error: ${error.message}`);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('✅ All rows already have Spanish content!');
    return;
  }

  console.log(`📊 Found ${rows.length} rows missing Spanish content`);
  console.log(`   Batches of ${BATCH_SIZE}: ${Math.ceil(rows.length / BATCH_SIZE)} API calls`);
  console.log(`   Estimated cost: ~$${(Math.ceil(rows.length / BATCH_SIZE) * 0.01).toFixed(2)} USD`);
  console.log(`   Estimated time: ~${Math.ceil(rows.length / BATCH_SIZE * DELAY_MS / 60000)} minutes\n`);

  if (dryRun) {
    console.log('🏃 Dry run — showing first batch only\n');
    const testBatch = rows.slice(0, BATCH_SIZE);
    const results = await translateBatch(testBatch as SEORow[], anthropic);
    for (const [id, content] of results) {
      const row = testBatch.find(r => r.id === id);
      console.log(`  ${row?.page_slug} → ${row?.page_slug_es}`);
      console.log(`    h1_es: ${content.h1_es}`);
      console.log(`    meta_title_es: ${content.meta_title_es}`);
      console.log(`    description_es: ${content.description_es.substring(0, 80)}...`);
      console.log();
    }
    return;
  }

  console.log('Starting in 3 seconds... (Ctrl+C to cancel)\n');
  await new Promise((resolve) => setTimeout(resolve, 3000));

  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE) as SEORow[];
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

    console.log(`[Batch ${batchNum}/${totalBatches}] Processing ${batch.length} rows...`);

    try {
      const results = await translateBatch(batch, anthropic);

      for (const row of batch) {
        const content = results.get(row.id);
        if (!content) {
          console.log(`   ⚠️  No result for ${row.page_slug}`);
          errorCount++;
          continue;
        }

        const { error: updateError } = await supabase
          .from('seo_page_content')
          .update({
            h1_es: content.h1_es,
            description_es: content.description_es,
            meta_title_es: content.meta_title_es,
            meta_description_es: content.meta_description_es,
            keywords_es: content.keywords_es,
          })
          .eq('id', row.id);

        if (updateError) {
          console.log(`   ❌ DB error for ${row.page_slug}: ${updateError.message}`);
          errorCount++;
        } else {
          console.log(`   ✅ ${row.page_slug_es || row.page_slug}: "${content.h1_es}"`);
          successCount++;
        }
      }
    } catch (err) {
      console.log(`   ❌ Batch error: ${err instanceof Error ? err.message : 'Unknown'}`);
      errorCount += batch.length;

      if (err instanceof Error && err.message.includes('rate')) {
        console.log('   ⏸️  Rate limited, waiting 60 seconds...');
        await new Promise((resolve) => setTimeout(resolve, 60000));
        i -= BATCH_SIZE; // Retry this batch
        continue;
      }
    }

    // Delay between batches
    if (i + BATCH_SIZE < rows.length) {
      await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
    }
  }

  console.log('\n📊 COMPLETE\n');
  console.log(`   ✅ Updated: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);

  // Verify
  const { count } = await supabase
    .from('seo_page_content')
    .select('*', { count: 'exact', head: true })
    .not('h1_es', 'is', null);

  console.log(`   📈 Rows with Spanish content: ${count}/459\n`);
}

main().catch(console.error);
