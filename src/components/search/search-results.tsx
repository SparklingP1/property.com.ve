import { createClient } from '@/lib/supabase/server';
import { ListingCard } from '@/components/listings/listing-card';
import type { Listing } from '@/types/listing';

interface SearchResultsProps {
  searchParams: { [key: string]: string | undefined };
}

export async function SearchResults({ searchParams }: SearchResultsProps) {
  const supabase = await createClient();

  // Build query
  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('active', true)
    .order('scraped_at', { ascending: false });

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

  const { data: listings, count } = await query;

  const typedListings = (listings as Listing[]) || [];

  if (typedListings.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="bg-stone-100 rounded-2xl p-12 max-w-lg mx-auto">
          <h3 className="text-2xl font-bold text-stone-900 mb-3">
            No properties found
          </h3>
          <p className="text-stone-600 mb-6">
            Try adjusting your filters to see more results.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Results Header */}
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-2xl font-bold text-stone-900">
          {count?.toLocaleString() || 0} {count === 1 ? 'Property' : 'Properties'}{' '}
          Found
        </h2>
      </div>

      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {typedListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}
