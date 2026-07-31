'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { ListingCard } from '@/components/listings/listing-card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { Listing } from '@/types/listing';
import type { NormalizedSearchParams } from '@/lib/search-params';

interface SearchResultsClientProps {
  initialListings: Listing[];
  totalCount: number;
  searchParams: NormalizedSearchParams;
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
  const t = useTranslations('results');

  const hasMore = listings.length < totalCount;

  const loadMore = async () => {
    setIsLoading(true);
    const supabase = createClient();

    // Build the same query as server-side
    let query = supabase
      .from('listings')
      .select('id, title, title_en, thumbnail_url, image_urls, price, currency, property_type, city, location, neighborhood, state, region, bedrooms, bathrooms, area_sqm, parking_spaces, url_slug, url_slug_es, transaction_type')
      .eq('active', true);

    // Apply all the same filters
    if (searchParams.q) {
      const escapedQ = searchParams.q
        .replace(/\\/g, '\\\\')
        .replace(/%/g, '\\%')
        .replace(/_/g, '\\_');
      query = query.or(
        `title.ilike.%${escapedQ}%,location.ilike.%${escapedQ}%,city.ilike.%${escapedQ}%,neighborhood.ilike.%${escapedQ}%`
      );
    }

    if (searchParams.transaction) {
      query = query.eq('transaction_type', searchParams.transaction);
    }

    if (searchParams.type) {
      query = query.eq('property_type', searchParams.type);
    }

    if (searchParams.state) {
      query = query.eq('state', searchParams.state);
    }

    if (searchParams.city) {
      query = query.eq('city', searchParams.city);
    }

    if (searchParams.neighborhood) {
      query = query.eq('neighborhood', searchParams.neighborhood);
    }

    if (searchParams.minPrice) {
      query = query.gte('price', Number(searchParams.minPrice));
    }

    if (searchParams.maxPrice) {
      query = query.lte('price', Number(searchParams.maxPrice));
    }

    if (searchParams.bedrooms) {
      query = query.gte('bedrooms', Number(searchParams.bedrooms));
    }

    if (searchParams.bathrooms) {
      query = query.gte('bathrooms', Number(searchParams.bathrooms));
    }

    if (searchParams.parking) {
      query = query.gte('parking_spaces', Number(searchParams.parking));
    }

    if (searchParams.minArea) {
      query = query.gte('area_sqm', Number(searchParams.minArea));
    }

    if (searchParams.maxArea) {
      query = query.lte('area_sqm', Number(searchParams.maxArea));
    }

    if (searchParams.furnished) {
      query = query.eq('furnished', searchParams.furnished === 'true');
    }

    // Apply sorting. nullslast prevents Postgres from using the btree index
    // (a DESC index scan yields nulls first), forcing a full sort that hits
    // the statement timeout — so only use it for nullable fields.
    const [field, direction] = sortBy.split('-');
    query = query.order(field, {
      ascending: direction === 'asc',
      ...(field === 'bedrooms' || field === 'area_sqm'
        ? { nullsFirst: false }
        : {}),
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
            {t('noPropertiesFound')}
          </h3>
          <p className="text-stone-600 mb-6">
            {t('tryAdjusting')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Results Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>

      {/* Load More / Count */}
      <div className="text-center py-8 bg-stone-50 rounded-lg">
        <p className="text-stone-600 mb-4">
          {t('showing', { current: listings.length, total: totalCount.toLocaleString() })}
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
                {t('loading')}
              </>
            ) : (
              t('loadMore')
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
