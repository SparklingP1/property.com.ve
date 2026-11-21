import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { hasDuplicateOfColumn, saleStock } from '@/lib/supabase/sale-stock';
import { SearchResultsClient } from './search-results-client';
import { SortSelect } from './sort-select';
import type { Listing } from '@/types/listing';
import {
  getSearchParamsKey,
  normalizeSearchParams,
  type SearchParamRecord,
} from '@/lib/search-params';

interface SearchResultsProps {
  searchParams: SearchParamRecord;
}

const RESULTS_PER_PAGE = 24;

export async function SearchResults({ searchParams }: SearchResultsProps) {
  const supabase = await createClient();
  const excludeDuplicates = await hasDuplicateOfColumn();
  const t = await getTranslations('results');
  const normalizedSearchParams = normalizeSearchParams(searchParams);

  // Get sort parameter (default: newest first)
  const sortBy = normalizedSearchParams.sort || 'scraped_at-desc';
  const [sortField, sortDirection] = sortBy.split('-');

  // Build query - only select fields used in ListingCard
  let query = supabase
    .from('listings')
    .select('id, title, title_en, thumbnail_url, image_urls, price, currency, property_type, city, location, neighborhood, state, region, bedrooms, bathrooms, area_sqm, parking_spaces, url_slug, url_slug_es, transaction_type', { count: 'planned' });
  // Sale stock by default; rentals only when explicitly asked for (and once
  // they are active). Duplicates excluded once migration 022 exists.
  query = saleStock(query, {
    excludeDuplicates,
    transactionType: normalizedSearchParams.transaction === 'rent' ? 'rent' : 'sale',
  });

  // Keyword search (title, location, city, neighborhood)
  if (normalizedSearchParams.q) {
    const escapedQ = normalizedSearchParams.q
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');
    query = query.or(
      `title.ilike.%${escapedQ}%,location.ilike.%${escapedQ}%,city.ilike.%${escapedQ}%,neighborhood.ilike.%${escapedQ}%`
    );
  }

  // Property type
  if (normalizedSearchParams.type) {
    query = query.eq('property_type', normalizedSearchParams.type);
  }

  // State
  if (normalizedSearchParams.state) {
    query = query.eq('state', normalizedSearchParams.state);
  }

  // City
  if (normalizedSearchParams.city) {
    query = query.eq('city', normalizedSearchParams.city);
  }

  if (normalizedSearchParams.neighborhood) {
    query = query.eq('neighborhood', normalizedSearchParams.neighborhood);
  }

  // Price range
  if (normalizedSearchParams.minPrice) {
    query = query.gte('price', Number(normalizedSearchParams.minPrice));
  }
  if (normalizedSearchParams.maxPrice) {
    query = query.lte('price', Number(normalizedSearchParams.maxPrice));
  }

  // Bedrooms (minimum)
  if (normalizedSearchParams.bedrooms) {
    query = query.gte('bedrooms', Number(normalizedSearchParams.bedrooms));
  }

  // Bathrooms (minimum)
  if (normalizedSearchParams.bathrooms) {
    query = query.gte('bathrooms', Number(normalizedSearchParams.bathrooms));
  }

  // Parking (minimum)
  if (normalizedSearchParams.parking) {
    query = query.gte('parking_spaces', Number(normalizedSearchParams.parking));
  }

  // Area range
  if (normalizedSearchParams.minArea) {
    query = query.gte('area_sqm', Number(normalizedSearchParams.minArea));
  }
  if (normalizedSearchParams.maxArea) {
    query = query.lte('area_sqm', Number(normalizedSearchParams.maxArea));
  }

  // Furnished
  if (normalizedSearchParams.furnished) {
    query = query.eq('furnished', normalizedSearchParams.furnished === 'true');
  }

  // Apply sorting. nullslast prevents Postgres from using the btree index
  // (a DESC index scan yields nulls first), forcing a full sort that hits the
  // statement timeout — so only use it for nullable fields, where it matters.
  query = query.order(sortField, {
    ascending: sortDirection === 'asc',
    ...(sortField === 'bedrooms' || sortField === 'area_sqm'
      ? { nullsFirst: false }
      : {}),
  });

  // Apply pagination - get first batch + count
  const { data: listings, count } = await query.range(0, RESULTS_PER_PAGE - 1);

  const typedListings = (listings as Listing[]) || [];

  // Planned counts are estimates: never claim results when the page has none.
  const resultCount = typedListings.length === 0 ? 0 : count || 0;
  const headerText = resultCount === 1
    ? t('onePropertyFound')
    : t('propertiesFound', { count: resultCount.toLocaleString() });

  return (
    <div>
      {/* Results Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-stone-900">
          {headerText}
        </h2>
        <SortSelect currentSort={sortBy} />
      </div>

      {/* Results with Load More */}
      <SearchResultsClient
        key={`${getSearchParamsKey(normalizedSearchParams)}|${sortBy}`}
        initialListings={typedListings}
        totalCount={count || 0}
        searchParams={normalizedSearchParams}
        sortBy={sortBy}
        excludeDuplicates={excludeDuplicates}
      />
    </div>
  );
}
