/**
 * Computes monthly and quarterly market statistics by calling the
 * compute_market_stats RPC function in Supabase.
 *
 * Run on the 1st of each month (via GitHub Actions) or manually:
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/compute-market-stats.ts
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/compute-market-stats.ts --month 2026-03
 *   SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/compute-market-stats.ts --quarter 2026-Q1
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });
config();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL env var required');
  process.exit(1);
}

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
if (!serviceRoleKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY or SUPABASE_KEY env var required');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, serviceRoleKey);

function padMonth(month: number) {
  return String(month).padStart(2, '0');
}

function parseArgs(): { months: string[]; quarters: string[] } {
  const args = process.argv.slice(2);
  const months: string[] = [];
  const quarters: string[] = [];

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--month' && args[i + 1]) {
      months.push(args[++i]);
    } else if (args[i] === '--quarter' && args[i + 1]) {
      quarters.push(args[++i]);
    }
  }

  // Default: compute previous month
  if (months.length === 0 && quarters.length === 0) {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    const prevMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const label = `${prevMonthYear}-${padMonth(prevMonth + 1)}`;
    months.push(label);

    // Also compute quarterly if we're at the start of a new quarter
    if (currentMonth % 3 === 0) {
      const quarterYear = currentMonth === 0 ? currentYear - 1 : currentYear;
      const quarterNumber = currentMonth === 0 ? 4 : currentMonth / 3;
      const quarterLabel = `${quarterYear}-Q${quarterNumber}`;
      quarters.push(quarterLabel);
    }
  }

  return { months, quarters };
}

function monthToDateRange(label: string): { start: string; end: string } {
  const match = label.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error(`Invalid month format: ${label}. Expected: 2026-03`);
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month in label: ${label}. Expected month 01-12.`);
  }

  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return {
    start: `${year}-${padMonth(month)}-01`,
    end: `${nextYear}-${padMonth(nextMonth)}-01`,
  };
}

function quarterToDateRange(label: string): { start: string; end: string } {
  const match = label.match(/^(\d{4})-Q(\d)$/);
  if (!match) throw new Error(`Invalid quarter format: ${label}. Expected: 2026-Q1`);
  const year = parseInt(match[1], 10);
  const quarter = parseInt(match[2], 10);
  if (quarter < 1 || quarter > 4) {
    throw new Error(`Invalid quarter in label: ${label}. Expected Q1-Q4.`);
  }
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 3;
  const endYear = endMonth > 12 ? year + 1 : year;
  return {
    start: `${year}-${padMonth(startMonth)}-01`,
    end: `${endYear}-${padMonth(endMonth > 12 ? endMonth - 12 : endMonth)}-01`,
  };
}

async function computeStats(
  periodType: 'monthly' | 'quarterly',
  periodLabel: string,
  periodStart: string,
  periodEnd: string
) {
  console.log(`\n📊 Computing ${periodType} stats: ${periodLabel}`);
  console.log(`   Period: ${periodStart} → ${periodEnd}`);

  const { error } = await supabase.rpc('compute_market_stats', {
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_period_type: periodType,
    p_period_label: periodLabel,
  });

  if (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return false;
  }

  // Verify results
  const { data: stats, error: verifyError } = await supabase
    .from('market_stats')
    .select('city, state, property_type, bedrooms_bucket, sample_confidence, listing_count, median_price_per_sqm, median_price, price_change_pct')
    .eq('period_type', periodType)
    .eq('period_start', periodStart)
    .order('listing_count', { ascending: false })
    .limit(10);

  if (verifyError) {
    console.error(`   ⚠️  Verification query failed: ${verifyError.message}`);
    return true; // Stats were computed, just couldn't verify
  }

  console.log(`   ✅ Generated ${stats?.length || 0} stat rows (top 10 shown):`);
  stats?.forEach((s) => {
    const location =
      s.city && s.state
        ? `${s.city}, ${s.state}`
        : s.state || s.city || 'National';
    const type = s.property_type || 'All types';
    const beds = s.bedrooms_bucket ? `${s.bedrooms_bucket}-bed` : 'All beds';
    const conf = s.sample_confidence;
    const psqm = s.median_price_per_sqm ? `$${Math.round(s.median_price_per_sqm)}/sqm` : 'n/a';
    const change = s.price_change_pct !== null ? ` (${s.price_change_pct > 0 ? '+' : ''}${s.price_change_pct}%)` : '';
    console.log(
      `      [${conf}] ${location} | ${type} | ${beds} | ${s.listing_count} listings | ${psqm}${change}`
    );
  });

  return true;
}

async function main() {
  const { months, quarters } = parseArgs();
  let success = true;

  console.log('🏠 Property.com.ve Market Stats Computation');
  console.log('='.repeat(50));

  for (const month of months) {
    const { start, end } = monthToDateRange(month);
    const ok = await computeStats('monthly', month, start, end);
    if (!ok) success = false;
  }

  for (const quarter of quarters) {
    const { start, end } = quarterToDateRange(quarter);
    const ok = await computeStats('quarterly', quarter, start, end);
    if (!ok) success = false;
  }

  // Run repeat-listing analysis for the most recent monthly period
  if (months.length > 0) {
    const latestMonth = months[months.length - 1];
    const { start, end } = monthToDateRange(latestMonth);
    const [prevYear, prevMonth] = latestMonth.split('-').map(Number);
    const pStart = new Date(prevYear, prevMonth - 2, 1);
    const prevStartStr = `${pStart.getFullYear()}-${padMonth(pStart.getMonth() + 1)}-01`;

    console.log(`\n📈 Repeat-listing analysis: ${latestMonth}`);
    const { data: repeatData, error: repeatError } = await supabase.rpc(
      'compute_repeat_listing_stats',
      {
        p_period_start: start,
        p_period_end: end,
        p_prev_start: prevStartStr,
        p_prev_end: start,
      }
    );

    if (repeatError) {
      console.error(`   ⚠️  Repeat-listing stats failed: ${repeatError.message}`);
    } else if (repeatData && repeatData.length > 0) {
      console.log(`   Found ${repeatData.length} location groups with repeat listings:`);
      repeatData.forEach((r: any) => {
        const loc = r.city && r.state ? `${r.city}, ${r.state}` : r.state || 'National';
        const type = r.property_type || 'All types';
        console.log(
          `      ${loc} | ${type} | ${r.repeat_count} repeats | median change: ${r.median_pct_change > 0 ? '+' : ''}${r.median_pct_change}% | ↑${r.pct_increased}% ↓${r.pct_decreased}% =${r.pct_unchanged}%`
        );
      });
    } else {
      console.log('   No repeat listings found (need 2+ months of data)');
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(success ? '✅ All stats computed successfully' : '⚠️  Some computations failed');

  if (!success) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
