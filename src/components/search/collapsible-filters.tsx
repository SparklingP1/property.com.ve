'use client';

import { ReactNode, useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdvancedSearchFilters } from './advanced-search-filters';
import { Button } from '@/components/ui/button';
import { SlidersHorizontal, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CollapsibleFiltersProps {
  children: ReactNode;
}

export function CollapsibleFilters({ children }: CollapsibleFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(true); // Open by default
  const searchParams = useSearchParams();

  // Close filters on mobile by default
  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    setFiltersOpen(!isMobile);
  }, []);

  // Auto-close filters when search params change (after applying filters)
  useEffect(() => {
    // Close filters after user applies filters (on both mobile and desktop)
    // This allows them to see the results immediately
    const hasFilters = searchParams.toString().length > 0;
    if (hasFilters) {
      setFiltersOpen(false);
    }
  }, [searchParams]);

  // Count active filters
  const activeFilterCount = () => {
    let count = 0;
    const params = ['q', 'type', 'city', 'state', 'minPrice', 'maxPrice', 'bedrooms', 'bathrooms', 'parking', 'furnished', 'minArea', 'maxArea'];

    params.forEach(param => {
      const value = searchParams.get(param);
      if (value && value !== 'all' && value !== '') {
        count++;
      }
    });

    return count;
  };

  const filterCount = activeFilterCount();

  return (
    <>
      {/* Filter Toggle Button - Mobile & Desktop */}
      <div className="mb-6 flex items-center justify-between">
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
              {filterCount > 0 && (
                <Badge className="ml-2 bg-amber-600 hover:bg-amber-600 text-white">
                  {filterCount}
                </Badge>
              )}
            </>
          )}
        </Button>
        {filterCount > 0 && !filtersOpen && (
          <span className="text-sm text-stone-600">
            {filterCount} {filterCount === 1 ? 'filter' : 'filters'} active
          </span>
        )}
      </div>

      <div className="grid lg:grid-cols-[480px,1fr] gap-8">
        {/* Filters Sidebar - Collapsible */}
        {filtersOpen && (
          <aside className="lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto z-10">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-stone-900">
                  Refine Your Search
                </h2>
                {filterCount > 0 && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                    {filterCount} active
                  </Badge>
                )}
              </div>
              <AdvancedSearchFilters />
            </div>
          </aside>
        )}

        {/* Results */}
        <main className={filtersOpen ? '' : 'lg:col-span-2'}>
          {children}
        </main>
      </div>
    </>
  );
}
