'use client';

import { Suspense, useState } from 'react';
import { AdvancedSearchFilters } from './advanced-search-filters';
import { SearchResults } from './search-results';
import { ListingSkeleton } from '@/components/listings/listing-skeleton';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, X } from 'lucide-react';

interface CollapsibleFiltersProps {
  searchParams: { [key: string]: string | undefined };
}

export function CollapsibleFilters({ searchParams }: CollapsibleFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);

  return (
    <>
      {/* Filter Toggle Button - Mobile & Desktop */}
      <div className="mb-6">
        <Button
          onClick={() => setFiltersOpen(!filtersOpen)}
          variant="outline"
          className="border-stone-300 text-stone-700 hover:bg-stone-50"
        >
          {filtersOpen ? (
            <>
              <X className="h-4 w-4 mr-2" />
              Hide Filters
            </>
          ) : (
            <>
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              Show Filters
            </>
          )}
        </Button>
      </div>

      <div className="grid lg:grid-cols-[320px,1fr] gap-8">
        {/* Filters Sidebar - Collapsible */}
        {filtersOpen && (
          <aside className="lg:sticky lg:top-8 h-fit">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
              <h2 className="text-lg font-semibold mb-6 text-stone-900">
                Refine Your Search
              </h2>
              <AdvancedSearchFilters />
            </div>
          </aside>
        )}

        {/* Results */}
        <main className={filtersOpen ? '' : 'lg:col-span-2'}>
          <Suspense fallback={<ListingSkeleton count={12} />}>
            <SearchResults searchParams={searchParams} />
          </Suspense>
        </main>
      </div>
    </>
  );
}
