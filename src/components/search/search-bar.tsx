'use client';

import { useRouter } from '@/i18n/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { parseSearchQuery } from '@/lib/search-parser';
import { serializeSearchParams } from '@/lib/search-params';

export function SearchBar() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('search');

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
    <div className="flex flex-col md:flex-row gap-3">
      <div className="flex-1">
        <Input
          placeholder={t('placeholder')}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="h-14 text-base px-5"
        />
      </div>

      <Button
        onClick={handleSearch}
        disabled={isPending}
        size="lg"
        className="h-14 px-8 bg-amber-600 hover:bg-amber-700 text-base font-semibold"
      >
        <Search className="h-5 w-5 mr-2" />
        {isPending ? t('searching') : t('searchButton')}
      </Button>
    </div>
  );
}
