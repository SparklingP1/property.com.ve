import { cache } from 'react';
import { createClient } from './server';

export interface MarketStat {
  id: number;
  period_type: string;
  period_label: string;
  period_start: string;
  city: string;
  state: string;
  property_type: string;
  bedrooms_bucket: string;
  listing_count: number;
  sample_confidence: string;
  median_price: number | null;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  median_price_per_sqm: number | null;
  avg_price_per_sqm: number | null;
  price_change_pct: number | null;
  computed_at: string;
}

/**
 * Get the most recent period that has market_stats data.
 * Uses anon key — RLS auto-filters to medium/high confidence.
 */
export const getLatestPeriod = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('market_stats')
    .select('period_start')
    .eq('period_type', 'monthly')
    .order('period_start', { ascending: false })
    .limit(1);

  return data?.[0]?.period_start ?? null;
});

/**
 * National overview: rollup rows (city='', state='') for the latest period.
 */
export const getMarketOverview = cache(async (periodStart: string): Promise<MarketStat[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('market_stats')
    .select('*')
    .eq('period_type', 'monthly')
    .eq('period_start', periodStart)
    .eq('city', '')
    .eq('state', '')
    .order('listing_count', { ascending: false });

  return (data ?? []) as MarketStat[];
});

/**
 * City comparison: one row per city (all property types, all bedrooms).
 */
export const getCityComparison = cache(async (periodStart: string): Promise<MarketStat[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('market_stats')
    .select('*')
    .eq('period_type', 'monthly')
    .eq('period_start', periodStart)
    .neq('city', '')
    .eq('property_type', '')
    .eq('bedrooms_bucket', '')
    .order('listing_count', { ascending: false });

  return (data ?? []) as MarketStat[];
});

/**
 * All stats for a specific city (by type, by bedrooms, rollups).
 */
export const getCityStats = cache(async (city: string, periodStart: string): Promise<MarketStat[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('market_stats')
    .select('*')
    .eq('period_type', 'monthly')
    .eq('period_start', periodStart)
    .eq('city', city)
    .order('listing_count', { ascending: false });

  return (data ?? []) as MarketStat[];
});

/**
 * Time series: multiple periods for a city (for charts).
 */
export const getTimeSeries = cache(async (city: string, months: number = 12): Promise<MarketStat[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('market_stats')
    .select('*')
    .eq('period_type', 'monthly')
    .eq('city', city)
    .eq('property_type', '')
    .eq('bedrooms_bucket', '')
    .order('period_start', { ascending: true })
    .limit(months);

  return (data ?? []) as MarketStat[];
});

/**
 * Cities with medium+ confidence data (for route validation and sitemap).
 * Returns unique city names with their state.
 */
export const getValidCities = cache(async (): Promise<Array<{ city: string; state: string; listing_count: number }>> => {
  const supabase = await createClient();

  // Get latest period first
  const { data: latest } = await supabase
    .from('market_stats')
    .select('period_start')
    .eq('period_type', 'monthly')
    .order('period_start', { ascending: false })
    .limit(1);

  if (!latest?.[0]) return [];

  const { data } = await supabase
    .from('market_stats')
    .select('city, state, listing_count')
    .eq('period_type', 'monthly')
    .eq('period_start', latest[0].period_start)
    .neq('city', '')
    .eq('property_type', '')
    .eq('bedrooms_bucket', '')
    .order('listing_count', { ascending: false });

  return (data ?? []) as Array<{ city: string; state: string; listing_count: number }>;
});

/**
 * Sample listings from a city for display on market data pages.
 */
export const getSampleListings = cache(async (city: string, limit: number = 6) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from('listings')
    .select('id, title, title_en, thumbnail_url, price, currency, property_type, city, state, bedrooms, bathrooms, area_sqm, url_slug, url_slug_es')
    .eq('active', true)
    .ilike('city', city)
    .gt('price', 0)
    .not('thumbnail_url', 'is', null)
    .order('scraped_at', { ascending: false })
    .limit(limit);

  return data ?? [];
});
