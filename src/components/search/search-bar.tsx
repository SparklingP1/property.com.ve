'use client';

import { useRouter } from '@/i18n/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Search } from 'lucide-react';
import { parseSearchQuery } from '@/lib/search-parser';
import { serializeSearchParams } from '@/lib/search-params';

export function SearchBar() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('search');
  const inputId = 'homepage-search';

  const [location, setLocation] = useState('');

  const handleSearch = () => {
    const nextSearchParams: Record<string, string> = {};

    if (location) {
      // Parse the query for smart search (property type, location)
      const parsed = parseSearchQuery(location);

      // Apply parsed filters (no bedrooms/bathrooms - use manual filters for those)
      if (parsed.propertyType) {
        nextSearchParams.type = parsed.propertyType;
      }
      if (parsed.transactionType) {
        nextSearchParams.transaction = parsed.transactionType;
      }
      if (parsed.furnished !== undefined) {
        nextSearchParams.furnished = parsed.furnished.toString();
      }

      // Use remaining keywords for text search
      const finalQuery = parsed.remainingKeywords || location;
      if (finalQuery) {
        nextSearchParams.q = finalQuery;
      }
    }

    const queryString = serializeSearchParams(nextSearchParams);

    startTransition(() => {
      router.push(queryString ? `/search?${queryString}` : '/search');
    });
  };

  return (
    <form
      className="flex flex-col md:flex-row md:items-end gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        handleSearch();
      }}
    >
      <div className="flex-1 space-y-2">
        <Label htmlFor={inputId} className="text-sm font-medium text-stone-700">
          {t('keywords')}
        </Label>
        <Input
          id={inputId}
          name="q"
          aria-label={t('keywords')}
          autoComplete="off"
          spellCheck={false}
          placeholder={t('placeholder')}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="h-14 text-base px-5"
        />
      </div>

      <Button
        type="submit"
        onClick={handleSearch}
        disabled={isPending}
        size="lg"
        className="h-14 px-8 bg-amber-600 hover:bg-amber-700 text-base font-semibold"
      >
        <Search className="h-5 w-5 mr-2" />
        {isPending ? t('searching') : t('searchButton')}
      </Button>
    </form>
  );
}
