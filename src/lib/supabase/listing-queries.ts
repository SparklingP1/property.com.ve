/**
 * Cached, lean listing queries for public pages (server only).
 *
 * Every function is wrapped in `unstable_cache`, so a page view only reaches
 * Supabase when the cached entry is older than its revalidate window. The
 * scraper runs daily, so 6 hours keeps pages fresh enough while cutting the
 * per-visit queries that starved the Micro instance in July 2026.
 *
 * Only the anon key is used here, except `getListingBySlugCached`, which needs
 * the service-role key (server side only) to read inactive rows hidden by RLS.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import { createServiceClient, createPrivilegedClient } from './server';
import { CARD_COLUMNS, isSafeSlug, toPublicListing, type PublicListing } from '@/lib/listing-public';
import type { Listing } from '@/types/listing';

/** 6 hours. Type × town pages, hubs, grids and listing pages. */
export const LISTINGS_REVALIDATE_SECONDS = 21600;

export const LISTINGS_CACHE_TAG = 'listings';

/** Prices outside this range are treated as errors for the median. */
const MEDIAN_MIN_PRICE = 1000;
const MEDIAN_MAX_PRICE = 20_000_000;

export interface LocationFilters {
  city?: string | null;
  state?: string | null;
  property_type?: string | null;
  bedrooms?: number | string | null;
  transaction_type?: 'sale' | 'rent';
}

type Client = ReturnType<typeof createServiceClient>;

function getPrivilegedClientOrNull() {
  try {
    return createPrivilegedClient();
  } catch {
    return null;
  }
}

// Supabase query builders are awkward to type generically; keep it local.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyFilters<Q extends { eq: any; ilike: any }>(query: Q, filters: LocationFilters): Q {
  let q = query.eq('active', true);
  if (filters.transaction_type) q = q.eq('transaction_type', filters.transaction_type);
  if (filters.city) q = q.ilike('city', filters.city);
  if (filters.state) q = q.ilike('state', filters.state);
  if (filters.property_type) q = q.eq('property_type', filters.property_type);
  if (filters.bedrooms) q = q.eq('bedrooms', Number(filters.bedrooms));
  return q;
}

function filterKey(filters: LocationFilters): string {
  return JSON.stringify([
    filters.transaction_type || '',
    (filters.city || '').toLowerCase(),
    (filters.state || '').toLowerCase(),
    filters.property_type || '',
    filters.bedrooms ? String(filters.bedrooms) : '',
  ]);
}

async function exactCount(client: Client, filters: LocationFilters, priced = false): Promise<number | null> {
  let query = applyFilters(client.from('listings').select('id', { count: 'exact', head: true }), filters);
  if (priced) {
    query = query.eq('currency', 'USD').gte('price', MEDIAN_MIN_PRICE).lte('price', MEDIAN_MAX_PRICE);
  }
  const { count, error } = await query;
  if (error) {
    console.error('listing-queries: count failed', error.message);
    return null;
  }
  return count ?? 0;
}

/** Exact median USD price with two small queries (a count, then one row at the middle offset). */
async function medianPrice(client: Client, filters: LocationFilters): Promise<{ median: number | null; sample: number }> {
  const sample = await exactCount(client, filters, true);
  if (!sample) return { median: null, sample: sample ?? 0 };
  const mid = Math.floor((sample - 1) / 2);
  const take = sample % 2 === 0 ? 2 : 1;
  const { data, error } = await applyFilters(client.from('listings').select('price'), filters)
    .eq('currency', 'USD')
    .gte('price', MEDIAN_MIN_PRICE)
    .lte('price', MEDIAN_MAX_PRICE)
    .order('price', { ascending: true })
    .range(mid, mid + take - 1);
  if (error || !data || data.length === 0) return { median: null, sample };
  const prices = data.map((row) => Number(row.price));
  return { median: prices.reduce((a, b) => a + b, 0) / prices.length, sample };
}

export interface LocationStats {
  /** Exact number of active listings matching the filters (null if the count failed). */
  total: number | null;
  medianPrice: number | null;
  medianSample: number;
  /** Counts per property type, from a lean sample of up to 1,000 rows. */
  propertyTypes: Record<string, number>;
  bedroomOptions: number[];
  neighborhoods: string[];
  cities: string[];
}

/**
 * Stats for a type × town page or a hub: exact count, median price and facet
 * values. Lean selects only; no full rows.
 */
export function getLocationStats(filters: LocationFilters): Promise<LocationStats> {
  return unstable_cache(
    async (): Promise<LocationStats> => {
      const client = createServiceClient();
      const [total, median, facets] = await Promise.all([
        exactCount(client, filters),
        medianPrice(client, filters),
        applyFilters(client.from('listings').select('property_type, bedrooms, neighborhood, city'), filters)
          .order('last_seen_at', { ascending: false })
          .limit(1000),
      ]);

      const propertyTypes: Record<string, number> = {};
      const bedrooms = new Set<number>();
      const neighborhoods = new Map<string, number>();
      const cities = new Map<string, number>();
      for (const row of facets.data || []) {
        if (row.property_type) propertyTypes[row.property_type] = (propertyTypes[row.property_type] || 0) + 1;
        if (row.bedrooms) bedrooms.add(row.bedrooms);
        if (row.neighborhood) neighborhoods.set(row.neighborhood, (neighborhoods.get(row.neighborhood) || 0) + 1);
        if (row.city) cities.set(row.city, (cities.get(row.city) || 0) + 1);
      }
      const byCount = (m: Map<string, number>) =>
        [...m.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);

      return {
        total,
        medianPrice: median.median,
        medianSample: median.sample,
        propertyTypes,
        bedroomOptions: [...bedrooms].sort((a, b) => a - b),
        neighborhoods: byCount(neighborhoods),
        cities: byCount(cities),
      };
    },
    ['location-stats-v1', filterKey(filters)],
    { revalidate: LISTINGS_REVALIDATE_SECONDS, tags: [LISTINGS_CACHE_TAG] }
  )();
}

/** Newest active listings for a grid, card columns only. */
export function getLocationListings(filters: LocationFilters, limit = 50): Promise<Listing[]> {
  return unstable_cache(
    async () => {
      const client = createServiceClient();
      const { data, error } = await applyFilters(client.from('listings').select(CARD_COLUMNS), filters)
        .order('last_seen_at', { ascending: false })
        .limit(limit);
      if (error) console.error('listing-queries: grid failed', error.message);
      return (data as unknown as Listing[]) || [];
    },
    ['location-listings-v1', filterKey(filters), String(limit)],
    { revalidate: LISTINGS_REVALIDATE_SECONDS, tags: [LISTINGS_CACHE_TAG] }
  )();
}

/**
 * Up to `limit` active listings like this one: same town and type first, then
 * the same state and type to fill the grid.
 */
export function getSimilarActiveListings(params: {
  excludeId: string;
  city?: string | null;
  state?: string | null;
  propertyType?: string | null;
  transactionType?: 'sale' | 'rent' | null;
  limit?: number;
}): Promise<Listing[]> {
  const limit = params.limit ?? 6;
  return unstable_cache(
    async () => {
      const client = createServiceClient();
      const base = {
        property_type: params.propertyType || null,
        transaction_type: params.transactionType || 'sale',
      } as LocationFilters;

      const results: Listing[] = [];
      const seen = new Set<string>([params.excludeId]);
      const passes: LocationFilters[] = [];
      if (params.city) passes.push({ ...base, city: params.city, state: params.state || null });
      if (params.state) passes.push({ ...base, state: params.state });

      for (const filters of passes) {
        if (results.length >= limit) break;
        const { data } = await applyFilters(client.from('listings').select(CARD_COLUMNS), filters)
          .neq('id', params.excludeId)
          .order('last_seen_at', { ascending: false })
          .limit(limit + 6);
        for (const row of (data as unknown as Listing[]) || []) {
          if (results.length >= limit) break;
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          results.push(row);
        }
      }
      return results;
    },
    [
      'similar-listings-v1',
      params.excludeId,
      (params.city || '').toLowerCase(),
      (params.state || '').toLowerCase(),
      params.propertyType || '',
      params.transactionType || '',
      String(limit),
    ],
    { revalidate: LISTINGS_REVALIDATE_SECONDS, tags: [LISTINGS_CACHE_TAG] }
  )();
}

/**
 * One listing by English or Spanish slug, active or not, already stripped of
 * copied text and agent contacts (see toPublicListing).
 */
export function getListingBySlugCached(slug: string): Promise<PublicListing | null> {
  if (!isSafeSlug(slug)) return Promise.resolve(null);
  return unstable_cache(
    async () => {
      // Inactive rows are hidden from the anon key by RLS, so prefer the
      // service-role client (server side only) and fall back to anon.
      const client = getPrivilegedClientOrNull() || createServiceClient();
      const { data, error } = await client
        .from('listings')
        .select('*')
        .or(`url_slug.eq.${slug},url_slug_es.eq.${slug}`)
        .limit(1);
      if (error) {
        console.error('listing-queries: listing lookup failed', error.message);
        return null;
      }
      const row = data?.[0];
      return row ? toPublicListing(row) : null;
    },
    ['listing-by-slug-v1', slug],
    { revalidate: LISTINGS_REVALIDATE_SECONDS, tags: [LISTINGS_CACHE_TAG] }
  )();
}

/** Row from seo_page_content for a type × town page (by English or Spanish slug). */
export function getSeoPageContent(slug: string) {
  if (!isSafeSlug(slug)) return Promise.resolve(null);
  return unstable_cache(
    async () => {
      const client = createServiceClient();
      const { data } = await client
        .from('seo_page_content')
        .select('*')
        .or(`page_slug.eq."/${slug}",page_slug_es.eq."/${slug}"`)
        .limit(1);
      return data?.[0] ?? null;
    },
    ['seo-page-content-v1', slug],
    { revalidate: LISTINGS_REVALIDATE_SECONDS, tags: [LISTINGS_CACHE_TAG] }
  )();
}
