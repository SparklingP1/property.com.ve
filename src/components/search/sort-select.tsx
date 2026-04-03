'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  normalizeSearchParams,
  serializeSearchParams,
  type SearchParamRecord,
} from '@/lib/search-params';

interface SortSelectProps {
  currentSort: string;
}

export function SortSelect({ currentSort }: SortSelectProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const t = useTranslations('search');

  const handleSortChange = (value: string) => {
    const nextSearchParams = normalizeSearchParams(
      Object.fromEntries(searchParams.entries()) as SearchParamRecord
    );
    nextSearchParams.sort = value;
    const queryString = serializeSearchParams(nextSearchParams);

    startTransition(() => {
      router.push(queryString ? `/search?${queryString}` : '/search');
    });
  };

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
      <span className="text-sm text-stone-600">{t('sortBy')}</span>
      <Select value={currentSort} onValueChange={handleSortChange}>
        <SelectTrigger className="w-full sm:w-[180px] border-stone-300">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-white z-50">
          <SelectItem value="scraped_at-desc">{t('newestFirst')}</SelectItem>
          <SelectItem value="price-asc">{t('priceLowToHigh')}</SelectItem>
          <SelectItem value="price-desc">{t('priceHighToLow')}</SelectItem>
          <SelectItem value="bedrooms-desc">{t('mostBedrooms')}</SelectItem>
          <SelectItem value="area_sqm-desc">{t('largestArea')}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
