import { createClient } from '@/lib/supabase/server';
import { SearchResultsClient } from './search-results-client';
import { SortSelect } from './sort-select';
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

  // Build query
  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('active', true);

  // Keyword search (title, location, city, neighborhood)
  if (searchParams.q) {
    query = query.or(
      `title.ilike.%${searchParams.q}%,location.ilike.%${searchParams.q}%,city.ilike.%${searchParams.q}%,neighborhood.ilike.%${searchParams.q}%`
    );
  }

  // Transaction type
  if (searchParams.transaction && searchParams.transaction !== 'all') {
    query = query.eq('transaction_type', searchParams.transaction);
  }

  // Property type
  if (searchParams.type && searchParams.type !== 'all') {
    query = query.eq('property_type', searchParams.type);
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
  if (searchParams.bedrooms && searchParams.bedrooms !== 'all') {
    query = query.gte('bedrooms', Number(searchParams.bedrooms));
  }

  // Bathrooms (minimum)
  if (searchParams.bathrooms && searchParams.bathrooms !== 'all') {
    query = query.gte('bathrooms', Number(searchParams.bathrooms));
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
  if (searchParams.furnished && searchParams.furnished !== 'all') {
    query = query.eq('furnished', searchParams.furnished === 'true');
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
