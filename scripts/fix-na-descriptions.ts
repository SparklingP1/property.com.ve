/**
 * Fix listings where description_short_en is "N/A" by translating
 * the Spanish description_short to English using Claude API.
 *
 * Processes in batches of 10 listings per API call for efficiency.
 *
 * Usage:
 *   npx tsx scripts/fix-na-descriptions.ts
 *   npx tsx scripts/fix-na-descriptions.ts --dry-run
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });

const BATCH_SIZE = 10;
const DELAY_MS = 1500;

interface ListingRow {
  id: string;
  title: string;
  description_short: string;
  city: string | null;
  state: string | null;
  property_type: string | null;
  bedrooms: number | null;
}

async function translateBatch(
  rows: ListingRow[],
  anthropic: Anthropic
): Promise<Map<string, string>> {
  const entries = rows.map((r, i) =>
    `${i + 1}. [id:${r.id}] ${r.description_short}`
  ).join('\n');

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: `Translate these ${rows.length} Venezuelan real estate listing descriptions from Spanish to English. Keep them concise (under 200 characters each). Use natural real estate English. Keep location names unchanged.

${entries}

Return a JSON array of objects with "id" and "description_short_en" fields. Return ONLY the JSON array.`,
      },
    ],
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error('Failed to parse JSON response');

  const results: Array<{ id: string; description_short_en: string }> = JSON.parse(jsonMatch[0]);
  const map = new Map<string, string>();
  for (const r of results) {
    if (r.description_short_en && r.description_short_en !== 'N/A') {
      map.set(r.id, r.description_short_en);
    }
  }
  return map;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`🔧 Fix N/A Descriptions${dryRun ? ' (DRY RUN)' : ''}\n`);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!anthropicKey || !supabaseUrl || !supabaseKey) {
    console.error('❌ Missing ANTHROPIC_API_KEY or Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Fetch all listings with N/A description_short_en that have a Spanish description
  // Paginate since Supabase default limit is 1000
  let rows: typeof allRows = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  while (true) {
    const { data, error: fetchErr } = await supabase
      .from('listings')
      .select('id, title, description_short, city, state, property_type, bedrooms')
      .eq('active', true)
      .eq('description_short_en', 'N/A')
      .not('description_short', 'is', null)
      .order('last_seen_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (fetchErr || !data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < PAGE_SIZE) break;
    page++;
  }
  rows = allRows;

  // Filter out rows where description_short is also empty/N/A
  const validRows = (rows || []).filter(r =>
    r.description_short && r.description_short !== 'N/A' && r.description_short.length > 10
  ) as ListingRow[];

  console.log(`📊 Found ${validRows.length} listings to translate`);
  console.log(`   Batches of ${BATCH_SIZE}: ${Math.ceil(validRows.length / BATCH_SIZE)} API calls`);
  console.log(`   Using Haiku 3.5 for cost efficiency\n`);

  if (dryRun) {
    console.log('🏃 Dry run — showing first batch:\n');
    const batch = validRows.slice(0, BATCH_SIZE);
    const results = await translateBatch(batch, anthropic);
    for (const row of batch) {
      const en = results.get(row.id);
      console.log(`  ES: ${row.description_short.substring(0, 80)}...`);
      console.log(`  EN: ${en?.substring(0, 80) || '(no result)'}...`);
      console.log();
    }
    return;
  }

  console.log('Starting in 3 seconds...\n');
  await new Promise(r => setTimeout(r, 3000));

  let success = 0, errors = 0;

  for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
    const batch = validRows.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const total = Math.ceil(validRows.length / BATCH_SIZE);

    process.stdout.write(`[${batchNum}/${total}] `);

    try {
      const results = await translateBatch(batch, anthropic);

      for (const row of batch) {
        const en = results.get(row.id);
        if (!en) { errors++; continue; }

        const { error: updateErr } = await supabase
          .from('listings')
          .update({ description_short_en: en })
          .eq('id', row.id);

        if (updateErr) { errors++; } else { success++; }
      }
      console.log(`✅ ${results.size} translated`);
    } catch (err) {
      console.log(`❌ ${err instanceof Error ? err.message : 'Unknown'}`);
      errors += batch.length;

      if (err instanceof Error && err.message.includes('rate')) {
        console.log('⏸️  Rate limited, waiting 60s...');
        await new Promise(r => setTimeout(r, 60000));
        i -= BATCH_SIZE;
        continue;
      }
    }

    if (i + BATCH_SIZE < validRows.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }

  console.log(`\n📊 COMPLETE: ✅ ${success} updated, ❌ ${errors} errors`);

  const { count } = await supabase
    .from('listings')
    .select('*', { count: 'exact', head: true })
    .eq('active', true)
    .eq('description_short_en', 'N/A');

  console.log(`📈 Remaining N/A descriptions: ${count}\n`);
}

main().catch(console.error);
