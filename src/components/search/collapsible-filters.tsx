'use client';

import { ReactNode, useState, useEffect, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTranslations } from 'next-intl';
import { AdvancedSearchFilters } from './advanced-search-filters';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidersHorizontal, X } from 'lucide-react';

// Human-readable labels for active filter chips
const FILTER_LABELS: Record<string, Record<string, string>> = {
  type: {
    apartment: 'Apartment',
    house: 'House',
    land: 'Land',
    commercial: 'Commercial',
    office: 'Office',
  },
  furnished: {
    true: 'Furnished',
    false: 'Unfurnished',
  },
};

interface CollapsibleFiltersProps {
  children: ReactNode;
}

export function CollapsibleFilters({ children }: CollapsibleFiltersProps) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const t = useTranslations('search');
  const tListing = useTranslations('listing');

  // Build active filters list
  const activeFilters: { key: string; label: string; value: string }[] = [];
  const paramConfig: { key: string; labelFn: (v: string) => string }[] = [
    { key: 'q', labelFn: (v) => `"${v}"` },
    { key: 'type', labelFn: (v) => tListing(v as 'apartment' | 'house' | 'land' | 'commercial' | 'office') || FILTER_LABELS.type[v] || v },
    { key: 'state', labelFn: (v) => v },
    { key: 'city', labelFn: (v) => v },
    { key: 'bedrooms', labelFn: (v) => `${v}+ ${t('bedrooms')}` },
    { key: 'bathrooms', labelFn: (v) => `${v}+ ${t('bathrooms')}` },
    { key: 'minPrice', labelFn: (v) => `$${Number(v).toLocaleString()}+` },
    { key: 'maxPrice', labelFn: (v) => `≤ $${Number(v).toLocaleString()}` },
    { key: 'parking', labelFn: (v) => `${v}+ ${t('parkingSpaces')}` },
    { key: 'minArea', labelFn: (v) => `${v}+ m²` },
    { key: 'maxArea', labelFn: (v) => `≤ ${v} m²` },
    { key: 'furnished', labelFn: (v) => v === 'true' ? t('furnished') : t('unfurnished') },
  ];

  for (const { key, labelFn } of paramConfig) {
    const value = searchParams.get(key);
    if (value && value !== 'all') {
      activeFilters.push({ key, label: labelFn(value), value });
    }
  }

  const removeFilter = (key: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(key);
    // If removing state, also remove city
    if (key === 'state') {
      params.delete('city');
    }
    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  };

  const clearAllFilters = () => {
    startTransition(() => {
      router.push('/search');
    });
  };

  return (
    <>
      {/* Filter Toggle Button */}
      <div className="mb-4 flex items-center justify-between">
        <Button
          onClick={() => setFiltersOpen(!filtersOpen)}
          variant="outline"
          className="border-stone-300 text-stone-700 hover:bg-stone-50"
        >
          {filtersOpen ? (
            <>
              <X className="h-4 w-4 mr-2" />
              {t('hideFilters')}
            </>
          ) : (
            <>
              <SlidersHorizontal className="h-4 w-4 mr-2" />
              {t('showFilters')}
              {activeFilters.length > 0 && (
                <Badge className="ml-2 bg-amber-600 hover:bg-amber-600 text-white">
                  {activeFilters.length}
                </Badge>
              )}
            </>
          )}
        </Button>
      </div>

      {/* Active Filter Chips */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {activeFilters.map(({ key, label }) => (
            <Badge
              key={key}
              variant="secondary"
              className="bg-stone-100 text-stone-700 border border-stone-200 pl-2.5 pr-1 py-1 text-sm flex items-center gap-1"
            >
              {label}
              <button
                onClick={() => removeFilter(key)}
                className="ml-1 p-0.5 rounded-full hover:bg-stone-300 transition-colors"
                aria-label={`Remove ${label} filter`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {activeFilters.length > 1 && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-stone-500 hover:text-stone-700 underline underline-offset-2"
            >
              {t('clearAll')}
            </button>
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-[320px,1fr] gap-8">
        {/* Filters Sidebar */}
        {filtersOpen && (
          <aside className="lg:sticky lg:top-8 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto z-10">
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-stone-900">
                  {t('refineSearch')}
                </h2>
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
