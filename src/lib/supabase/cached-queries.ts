import { cache } from 'react';
import { createClient } from './server';
import { hasDuplicateOfColumn, saleStock } from './sale-stock';
import { CARD_COLUMNS } from '@/lib/listing-public';
import type { Listing } from '@/types/listing';

/**
 * Cached query to get featured listings for homepage (sale stock only).
 * React cache() deduplicates requests during a single render
 */
export const getFeaturedListings = cache(async (params: {
  region?: string;
  type?: string;
  search?: string;
  price?: string;
}) => {
  const supabase = await createClient();
  const excludeDuplicates = await hasDuplicateOfColumn();

  let query = saleStock(
    supabase.from('listings').select(CARD_COLUMNS, { count: 'planned' }),
    { excludeDuplicates }
  )
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
  return { listings: (listings as unknown as Listing[]) || [], count: count || 0 };
});

/**
 * URL fields of a listing by id, for legacy /listing/{id} redirects.
 * Anon key: live rows, and expired rows once migration 024 is applied.
 */
export const getListingById = cache(async (id: string) => {
  const supabase = await createClient();
  const { data: listing, error } = await supabase
    .from('listings')
    .select('id, state, city, bedrooms, property_type, neighborhood, transaction_type, url_slug, url_slug_es')
    .eq('id', id)
    .maybeSingle();
  return { listing: (listing as Listing | null) || null, error };
});
