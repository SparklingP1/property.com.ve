'use client';

import { useState, useTransition, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ListingCard } from '@/components/listings/listing-card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { Listing } from '@/types/listing';

interface SearchResultsClientProps {
  initialListings: Listing[];
  totalCount: number;
  searchParams: { [key: string]: string | undefined };
  sortBy: string;
}

const RESULTS_PER_PAGE = 24;

export function SearchResultsClient({
  initialListings,
  totalCount,
  searchParams,
  sortBy,
}: SearchResultsClientProps) {
  const [listings, setListings] = useState<Listing[]>(initialListings);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  // Reset listings when search params or sort changes
  useEffect(() => {
    setListings(initialListings);
  }, [initialListings, searchParams, sortBy]);

  const hasMore = listings.length < totalCount;

  const loadMore = async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Build the same query as server-side
    let query = supabase
      .from('listings')
      .select('*')
      .eq('active', true);

    // Apply all the same filters
    if (searchParams.q) {
      query = query.or(
        `title.ilike.%${searchParams.q}%,location.ilike.%${searchParams.q}%,city.ilike.%${searchParams.q}%,neighborhood.ilike.%${searchParams.q}%`
      );
    }

    if (searchParams.transaction && searchParams.transaction !== 'all') {
      query = query.eq('transaction_type', searchParams.transaction);
    }

    if (searchParams.type && searchParams.type !== 'all') {
      query = query.eq('property_type', searchParams.type);
    }

    if (searchParams.state && searchParams.state !== 'all') {
      query = query.eq('state', searchParams.state);
    }

    if (searchParams.city && searchParams.city !== 'all') {
      query = query.eq('city', searchParams.city);
    }

    if (searchParams.minPrice) {
      query = query.gte('price', Number(searchParams.minPrice));
    }

    if (searchParams.maxPrice) {
      query = query.lte('price', Number(searchParams.maxPrice));
    }

    if (searchParams.bedrooms && searchParams.bedrooms !== 'all') {
      query = query.gte('bedrooms', Number(searchParams.bedrooms));
    }

    if (searchParams.bathrooms && searchParams.bathrooms !== 'all') {
      query = query.gte('bathrooms', Number(searchParams.bathrooms));
    }

    if (searchParams.parking && searchParams.parking !== 'all') {
      query = query.gte('parking_spaces', Number(searchParams.parking));
    }

    if (searchParams.minArea) {
      query = query.gte('area_sqm', Number(searchParams.minArea));
    }

    if (searchParams.maxArea) {
      query = query.lte('area_sqm', Number(searchParams.maxArea));
    }

    if (searchParams.furnished && searchParams.furnished !== 'all') {
      query = query.eq('furnished', searchParams.furnished === 'true');
    }

    // Apply sorting (nulls last for bedrooms and area)
    const [field, direction] = sortBy.split('-');
    query = query.order(field, {
      ascending: direction === 'asc',
      nullsFirst: false // Always put NULL values at the end
    });

    // Fetch next batch
    const { data } = await query.range(
      listings.length,
      listings.length + RESULTS_PER_PAGE - 1
    );

    if (data) {
      startTransition(() => {
        setListings((prev) => [...prev, ...(data as Listing[])]);
      });
    }

    setIsLoading(false);
  };

  if (listings.length === 0) {
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
      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {/* Load More / Count */}
      <div className="text-center py-8">
        <p className="text-stone-600 mb-4">
          Showing {listings.length} of {totalCount.toLocaleString()}{' '}
          {totalCount === 1 ? 'property' : 'properties'}
        </p>

        {hasMore && (
          <Button
            onClick={loadMore}
            disabled={isLoading || isPending}
            className="bg-stone-900 hover:bg-stone-800 text-white px-8"
          >
            {isLoading || isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Loading...
              </>
            ) : (
              'Load More Properties'
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
