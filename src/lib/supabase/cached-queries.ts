import { cache } from 'react';
import { createClient } from './server';
import type { Listing } from '@/types/listing';

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
    .select('id, title, title_en, thumbnail_url, image_urls, price, currency, property_type, city, location, neighborhood, state, region, bedrooms, bathrooms, area_sqm, parking_spaces', { count: 'exact' })
    .eq('active', true)
    .order('scraped_at', { ascending: false })
    .limit(12);

  if (params.region) {
    query = query.ilike('region', `%${params.region}%`);
  }
  if (params.type) {
    query = query.eq('property_type', params.type);
  }
  if (params.search) {
    query = query.or(
      `title.ilike.%${params.search}%,location.ilike.%${params.search}%`
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

  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();

  return { listing: listing as Listing | null, error };
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
    .select('id, title, title_en, thumbnail_url, image_urls, price, currency, property_type, city, location, neighborhood, state, region, bedrooms, bathrooms, area_sqm, parking_spaces')
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
