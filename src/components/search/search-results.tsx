import { createClient } from '@/lib/supabase/server';
import { SearchResultsClient } from './search-results-client';
import { SortSelect } from './sort-select';
import { parseSearchQuery } from '@/lib/search-parser';
import type { Listing } from '@/types/listing';

interface SearchResultsProps {
  searchParams: { [key: string]: string | undefined };
}

const RESULTS_PER_PAGE = 24;

export async function SearchResults({ searchParams }: SearchResultsProps) {
  const supabase = await createClient();

  // Get sort parameter (default: newest first)
  const sortBy = searchParams.sort || 'scraped_at-desc';
  const [sortField, sortDirection] = sortBy.split('-');

  // Parse smart search from query string if present
  let parsedQuery = searchParams.q || '';
  let effectiveParams = { ...searchParams };

  // If there's a query string and no explicit filters are set, try smart parsing
  if (searchParams.q && !searchParams.bedrooms && !searchParams.type && !searchParams.transaction) {
    const parsed = parseSearchQuery(searchParams.q);

    // Apply parsed filters only if they were detected
    if (parsed.bedrooms) {
      effectiveParams.bedrooms = parsed.bedrooms.toString();
    }
    if (parsed.bathrooms) {
      effectiveParams.bathrooms = parsed.bathrooms.toString();
    }
    if (parsed.propertyType) {
      effectiveParams.type = parsed.propertyType;
    }
    if (parsed.transactionType) {
      effectiveParams.transaction = parsed.transactionType;
    }
    if (parsed.furnished !== undefined) {
      effectiveParams.furnished = parsed.furnished.toString();
    }

    // Use remaining keywords for text search
    parsedQuery = parsed.remainingKeywords || searchParams.q;
  }

  // Build query
  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('active', true);

  // Keyword search (title, location, city, neighborhood)
  if (parsedQuery) {
    query = query.or(
      `title.ilike.%${parsedQuery}%,location.ilike.%${parsedQuery}%,city.ilike.%${parsedQuery}%,neighborhood.ilike.%${parsedQuery}%`
    );
  }

  // Transaction type
  if (effectiveParams.transaction && effectiveParams.transaction !== 'all') {
    query = query.eq('transaction_type', effectiveParams.transaction);
  }

  // Property type
  if (effectiveParams.type && effectiveParams.type !== 'all') {
    query = query.eq('property_type', effectiveParams.type);
  }

  // State
  if (searchParams.state && searchParams.state !== 'all') {
    query = query.eq('state', searchParams.state);
  }

  // City
  if (searchParams.city && searchParams.city !== 'all') {
    query = query.eq('city', searchParams.city);
  }

  // Price range
  if (searchParams.minPrice) {
    query = query.gte('price', Number(searchParams.minPrice));
  }
  if (searchParams.maxPrice) {
    query = query.lte('price', Number(searchParams.maxPrice));
  }

  // Bedrooms (minimum)
  if (effectiveParams.bedrooms && effectiveParams.bedrooms !== 'all') {
    query = query.gte('bedrooms', Number(effectiveParams.bedrooms));
  }

  // Bathrooms (minimum)
  if (effectiveParams.bathrooms && effectiveParams.bathrooms !== 'all') {
    query = query.gte('bathrooms', Number(effectiveParams.bathrooms));
  }

  // Parking (minimum)
  if (searchParams.parking && searchParams.parking !== 'all') {
    query = query.gte('parking_spaces', Number(searchParams.parking));
  }

  // Area range
  if (searchParams.minArea) {
    query = query.gte('area_sqm', Number(searchParams.minArea));
  }
  if (searchParams.maxArea) {
    query = query.lte('area_sqm', Number(searchParams.maxArea));
  }

  // Furnished
  if (effectiveParams.furnished && effectiveParams.furnished !== 'all') {
    query = query.eq('furnished', effectiveParams.furnished === 'true');
  }

  // Apply sorting (nulls last for bedrooms and area)
  query = query.order(sortField, {
    ascending: sortDirection === 'asc',
    nullsFirst: false // Always put NULL values at the end
  });

  // Apply pagination - get first batch + count
  const { data: listings, count } = await query.range(0, RESULTS_PER_PAGE - 1);

  const typedListings = (listings as Listing[]) || [];

  return (
    <div>
      {/* Results Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-stone-900">
          {count?.toLocaleString() || 0} {count === 1 ? 'Property' : 'Properties'}{' '}
          Found
        </h2>
        <SortSelect currentSort={sortBy} />
      </div>

      {/* Results with Load More */}
      <SearchResultsClient
        initialListings={typedListings}
        totalCount={count || 0}
        searchParams={searchParams}
        sortBy={sortBy}
      />
    </div>
  );
}
