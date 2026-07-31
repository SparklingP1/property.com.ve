import { cache } from 'react';
import { createClient, createPrivilegedClient } from './server';
import type { Listing } from '@/types/listing';

type ListingClient =
  | Awaited<ReturnType<typeof createClient>>
  | ReturnType<typeof createPrivilegedClient>;

async function fetchListingById(client: ListingClient, id: string) {
  return client
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();
}

async function fetchListingBySlug(client: ListingClient, slug: string) {
  const [{ data: byEnSlug, error: enError }, { data: byEsSlug, error: esError }] =
    await Promise.all([
      client.from('listings').select('*').eq('url_slug', slug).single(),
      client.from('listings').select('*').eq('url_slug_es', slug).single(),
    ]);

  return {
    listing: (byEnSlug || byEsSlug) as Listing | null,
    error: enError || esError,
  };
}

function getOptionalPrivilegedClient() {
  try {
    return createPrivilegedClient();
  } catch {
    return null;
  }
}

/**
 * Cached query to get featured listings for homepage
 * React cache() deduplicates requests during a single render
 */
export const getFeaturedListings = cache(async (params: {
  region?: string;
  type?: string;
  search?: string;
  price?: string;
}) => {
  const supabase = await createClient();

  let query = supabase
    .from('listings')
    .select('id, title, title_en, thumbnail_url, price, currency, property_type, city, location, neighborhood, state, region, bedrooms, bathrooms, area_sqm, parking_spaces, url_slug, url_slug_es, transaction_type', { count: 'planned' })
    .eq('active', true)
    .order('scraped_at', { ascending: false })
    .limit(12);

  const escapeLike = (v: string) => v.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
  if (params.region) {
    query = query.ilike('region', `%${escapeLike(params.region)}%`);
  }
  if (params.type) {
    query = query.eq('property_type', params.type);
  }
  if (params.search) {
    const escaped = escapeLike(params.search);
    query = query.or(
      `title.ilike.%${escaped}%,location.ilike.%${escaped}%`
    );
  }
  if (params.price) {
    const [min, max] = params.price.split('-');
    if (min) query = query.gte('price', Number(min));
    if (max) query = query.lte('price', Number(max));
  }

  const { data: listings, count } = await query;
  return { listings: (listings as Listing[]) || [], count: count || 0 };
});

/**
 * Cached query to get a single listing by ID
 * Used in listing detail pages
 */
export const getListingById = cache(async (id: string) => {
  const supabase = await createClient();

  const { data: listing, error } = await fetchListingById(supabase, id);

  if (listing) {
    return { listing: listing as Listing, error: null };
  }

  const privilegedClient = getOptionalPrivilegedClient();
  if (!privilegedClient) {
    return { listing: null, error };
  }

  const {
    data: privilegedListing,
    error: privilegedError,
  } = await fetchListingById(privilegedClient, id);

  return { listing: (privilegedListing as Listing | null) || null, error: privilegedError };
});

/**
 * Cached query to get a single listing by slug, including inactive listings
 * for server-rendered redirects and "no longer available" pages.
 */
export const getListingBySlug = cache(async (slug: string) => {
  const supabase = await createClient();
  const { listing, error } = await fetchListingBySlug(supabase, slug);

  if (listing) {
    return { listing, error: null };
  }

  const privilegedClient = getOptionalPrivilegedClient();
  if (!privilegedClient) {
    return { listing: null, error };
  }

  return fetchListingBySlug(privilegedClient, slug);
});

/**
 * Cached query to get related listings
 */
export const getRelatedListings = cache(async (params: {
  excludeId: string;
  region?: string | null;
  propertyType?: string | null;
  limit?: number;
}) => {
  const supabase = await createClient();

  let query = supabase
    .from('listings')
    .select('id, title, title_en, thumbnail_url, price, currency, property_type, city, location, neighborhood, state, region, bedrooms, bathrooms, area_sqm, parking_spaces, url_slug, url_slug_es, transaction_type')
    .eq('active', true)
    .neq('id', params.excludeId)
    .limit(params.limit || 6);

  if (params.region) {
    query = query.eq('region', params.region);
  }
  if (params.propertyType) {
    query = query.eq('property_type', params.propertyType);
  }

  const { data: listings } = await query;
  return (listings as Listing[]) || [];
});
