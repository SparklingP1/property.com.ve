import { Metadata } from 'next';
import { Suspense } from 'react';
import { CollapsibleFilters } from '@/components/search/collapsible-filters';
import { SearchResults } from '@/components/search/search-results';
import { ListingSkeleton } from '@/components/listings/listing-skeleton';

export const metadata: Metadata = {
  title: 'Search Properties | Property.com.ve',
  description:
    'Advanced property search in Venezuela. Filter by location, price, bedrooms, amenities and more.',
};

interface SearchPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-stone-900 text-stone-50 py-12">
        <div className="container">
          <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
            Find Your Space
          </h1>
          <p className="text-stone-300 text-lg max-w-2xl">
            Search across 1,000+ properties with precision. Filter by what
            matters.
          </p>
        </div>
      </div>

      {/* Search Interface */}
      <div className="container py-8">
        <CollapsibleFilters>
          <Suspense fallback={<ListingSkeleton count={12} />}>
            <SearchResults searchParams={params} />
          </Suspense>
        </CollapsibleFilters>
      </div>
    </div>
  );
}
