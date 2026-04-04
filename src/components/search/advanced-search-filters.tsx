'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from '@/i18n/navigation';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Search, X, MapPin, Home, DollarSign, Settings2 } from 'lucide-react';
import {
  normalizeSearchParams,
  serializeSearchParams,
  type NormalizedSearchParams,
  type SearchParamRecord,
} from '@/lib/search-params';

interface AvailableLocationRow {
  state?: string | null;
  city?: string | null;
}

interface AdvancedSearchFiltersContentProps {
  searchParamsString: string;
}

function parseSearchParams(searchParamsString: string) {
  return normalizeSearchParams(
    Object.fromEntries(
      new URLSearchParams(searchParamsString).entries()
    ) as SearchParamRecord
  );
}

function pushSearch(
  router: ReturnType<typeof useRouter>,
  startTransition: (callback: () => void) => void,
  searchParams: NormalizedSearchParams
) {
  const queryString = serializeSearchParams(searchParams);

  startTransition(() => {
    router.push(queryString ? `/search?${queryString}` : '/search');
  });
}

function AdvancedSearchFiltersContent({
  searchParamsString,
}: AdvancedSearchFiltersContentProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('search');
  const tListing = useTranslations('listing');
  const normalizedSearchParams = parseSearchParams(searchParamsString);

  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  const currentTransaction = normalizedSearchParams.transaction || 'all';
  const currentType = normalizedSearchParams.type || 'all';
  const currentState = normalizedSearchParams.state || 'all';
  const currentCity = normalizedSearchParams.city || 'all';
  const currentBedrooms = normalizedSearchParams.bedrooms || 'all';
  const currentBathrooms = normalizedSearchParams.bathrooms || 'all';
  const currentParking = normalizedSearchParams.parking || 'all';
  const currentFurnished = normalizedSearchParams.furnished || 'all';

  const [keyword, setKeyword] = useState(() => normalizedSearchParams.q || '');
  const [minPrice, setMinPrice] = useState(() => normalizedSearchParams.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(() => normalizedSearchParams.maxPrice || '');
  const [minArea, setMinArea] = useState(() => normalizedSearchParams.minArea || '');
  const [maxArea, setMaxArea] = useState(() => normalizedSearchParams.maxArea || '');
  const [priceError, setPriceError] = useState('');
  const [areaError, setAreaError] = useState('');

  // Determine which accordion sections should start open
  const defaultOpenSections: string[] = ['location', 'property'];
  if (normalizedSearchParams.minPrice || normalizedSearchParams.maxPrice || normalizedSearchParams.minArea || normalizedSearchParams.maxArea) {
    defaultOpenSections.push('price');
  }
  if (normalizedSearchParams.parking || normalizedSearchParams.furnished) {
    defaultOpenSections.push('extras');
  }

  useEffect(() => {
    const fetchStates = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('listings')
        .select('state')
        .eq('active', true)
        .not('state', 'is', null);

      if (data) {
        const states = [
          ...new Set(
            data
              .map((row: AvailableLocationRow) => row.state)
              .filter((value): value is string => Boolean(value))
          ),
        ];

        states.sort();
        setAvailableStates(states);
      }
    };

    fetchStates();
  }, []);

  useEffect(() => {
    const fetchCities = async () => {
      const supabase = createClient();
      let query = supabase
        .from('listings')
        .select('city')
        .eq('active', true)
        .not('city', 'is', null);

      if (normalizedSearchParams.state) {
        query = query.eq('state', normalizedSearchParams.state);
      }

      const { data } = await query;

      if (data) {
        const cities = [
          ...new Set(
            data
              .map((row: AvailableLocationRow) => row.city)
              .filter((value): value is string => Boolean(value))
          ),
        ];

        cities.sort();
        setAvailableCities(cities);
      }
    };

    fetchCities();
  }, [normalizedSearchParams.state]);

  const updateSearch = useCallback(
    (updater: (current: NormalizedSearchParams) => NormalizedSearchParams) => {
      pushSearch(router, startTransition, updater(parseSearchParams(searchParamsString)));
    },
    [router, searchParamsString, startTransition]
  );

  const updateParam = useCallback(
    (key: keyof NormalizedSearchParams, value: string) => {
      updateSearch((current) => {
        const nextSearchParams: NormalizedSearchParams = { ...current };

        if (value && value !== 'all') {
          nextSearchParams[key] = value as never;
        } else {
          delete nextSearchParams[key];
        }

        if (key === 'state') {
          delete nextSearchParams.city;
          delete nextSearchParams.neighborhood;
        }

        if (key === 'city') {
          delete nextSearchParams.neighborhood;
        }

        return nextSearchParams;
      });
    },
    [updateSearch]
  );

  const applyKeyword = useCallback(() => {
    updateSearch((current) => {
      const nextSearchParams: NormalizedSearchParams = { ...current };

      if (keyword.trim()) {
        const parsed = normalizeSearchParams({ q: keyword.trim() });

        nextSearchParams.q = parsed.q;

        if (!current.type && parsed.type) {
          nextSearchParams.type = parsed.type;
        }

        if (!current.transaction && parsed.transaction) {
          nextSearchParams.transaction = parsed.transaction;
        }

        if (!current.furnished && parsed.furnished) {
          nextSearchParams.furnished = parsed.furnished;
        }
      } else {
        delete nextSearchParams.q;
      }

      return nextSearchParams;
    });
  }, [keyword, updateSearch]);

  const applyPrice = useCallback(() => {
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setPriceError(t('priceRangeError'));
      return;
    }

    setPriceError('');

    updateSearch((current) => ({
      ...current,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
    }));
  }, [maxPrice, minPrice, t, updateSearch]);

  const applyArea = useCallback(() => {
    if (minArea && maxArea && Number(minArea) > Number(maxArea)) {
      setAreaError(t('areaRangeError'));
      return;
    }

    setAreaError('');

    updateSearch((current) => ({
      ...current,
      minArea: minArea || undefined,
      maxArea: maxArea || undefined,
    }));
  }, [maxArea, minArea, t, updateSearch]);

  const handleReset = useCallback(() => {
    startTransition(() => {
      router.push('/search');
    });
  }, [router, startTransition]);

  const hasAnyFilter = searchParamsString.length > 0;

  return (
    <div className="space-y-4">
      {/* Keyword Search */}
      <div className="space-y-1.5">
        <Label htmlFor="keyword" className="text-sm font-medium text-stone-700">
          {t('keywords')}
        </Label>
        <div className="flex gap-2">
          <Input
            id="keyword"
            placeholder={t('placeholder')}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && applyKeyword()}
            className="border-stone-300"
          />
          <Button
            onClick={applyKeyword}
            disabled={isPending}
            size="icon"
            className="shrink-0 bg-stone-900 hover:bg-stone-800 text-white"
          >
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Transaction Type Toggle (Sale / Rent) */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-stone-700">
          {t('transactionType')}
        </Label>
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-stone-100 p-1">
          {(['all', 'sale', 'rent'] as const).map((value) => {
            const isActive = currentTransaction === value;
            const label = value === 'all'
              ? t('any')
              : value === 'sale'
                ? tListing('forSale')
                : tListing('forRent');
            return (
              <button
                key={value}
                onClick={() => updateParam('transaction', value)}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white text-stone-900 shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Accordion Filter Sections */}
      <Accordion type="multiple" defaultValue={defaultOpenSections} className="w-full">
        {/* Location Section */}
        <AccordionItem value="location">
          <AccordionTrigger className="gap-2">
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-stone-400" />
              {t('sectionLocation')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-500">{t('state')}</Label>
              <Select value={currentState} onValueChange={(value) => updateParam('state', value)}>
                <SelectTrigger className="border-stone-300">
                  <SelectValue placeholder={t('anyState')} />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="all">{t('allStates')}</SelectItem>
                  {availableStates.map((state) => (
                    <SelectItem key={state} value={state}>
                      {state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {availableCities.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-stone-500">{t('city')}</Label>
                <Select value={currentCity} onValueChange={(value) => updateParam('city', value)}>
                  <SelectTrigger className="border-stone-300">
                    <SelectValue placeholder={t('anyCity')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="all">{t('allCities')}</SelectItem>
                    {availableCities.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* Property Section */}
        <AccordionItem value="property">
          <AccordionTrigger className="gap-2">
            <span className="flex items-center gap-2">
              <Home className="h-4 w-4 text-stone-400" />
              {t('sectionProperty')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-500">
                {t('propertyType')}
              </Label>
              <Select value={currentType} onValueChange={(value) => updateParam('type', value)}>
                <SelectTrigger className="border-stone-300">
                  <SelectValue placeholder={t('any')} />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="all">{t('anyType')}</SelectItem>
                  <SelectItem value="apartment">{tListing('apartment')}</SelectItem>
                  <SelectItem value="house">{tListing('house')}</SelectItem>
                  <SelectItem value="land">{tListing('land')}</SelectItem>
                  <SelectItem value="commercial">{tListing('commercial')}</SelectItem>
                  <SelectItem value="office">{tListing('office')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-stone-500">{t('bedrooms')}</Label>
                <Select
                  value={currentBedrooms}
                  onValueChange={(value) => updateParam('bedrooms', value)}
                >
                  <SelectTrigger className="border-stone-300">
                    <SelectValue placeholder={t('any')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="all">{t('any')}</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                    <SelectItem value="5">5+</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-stone-500">{t('bathrooms')}</Label>
                <Select
                  value={currentBathrooms}
                  onValueChange={(value) => updateParam('bathrooms', value)}
                >
                  <SelectTrigger className="border-stone-300">
                    <SelectValue placeholder={t('any')} />
                  </SelectTrigger>
                  <SelectContent className="bg-white z-50">
                    <SelectItem value="all">{t('any')}</SelectItem>
                    <SelectItem value="1">1+</SelectItem>
                    <SelectItem value="2">2+</SelectItem>
                    <SelectItem value="3">3+</SelectItem>
                    <SelectItem value="4">4+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Price & Area Section */}
        <AccordionItem value="price">
          <AccordionTrigger className="gap-2">
            <span className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-stone-400" />
              {t('sectionPrice')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-500">{t('priceUSD')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder={t('min')}
                  value={minPrice}
                  onChange={(event) => {
                    setMinPrice(event.target.value);
                    setPriceError('');
                  }}
                  onKeyDown={(event) => event.key === 'Enter' && applyPrice()}
                  onBlur={applyPrice}
                  className={`border-stone-300 ${priceError ? 'border-red-400' : ''}`}
                />
                <Input
                  type="number"
                  placeholder={t('max')}
                  value={maxPrice}
                  onChange={(event) => {
                    setMaxPrice(event.target.value);
                    setPriceError('');
                  }}
                  onKeyDown={(event) => event.key === 'Enter' && applyPrice()}
                  onBlur={applyPrice}
                  className={`border-stone-300 ${priceError ? 'border-red-400' : ''}`}
                />
              </div>
              {priceError && <p className="text-xs text-red-500">{priceError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-500">{t('areaM2')}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="number"
                  placeholder={t('min')}
                  value={minArea}
                  onChange={(event) => {
                    setMinArea(event.target.value);
                    setAreaError('');
                  }}
                  onKeyDown={(event) => event.key === 'Enter' && applyArea()}
                  onBlur={applyArea}
                  className={`border-stone-300 ${areaError ? 'border-red-400' : ''}`}
                />
                <Input
                  type="number"
                  placeholder={t('max')}
                  value={maxArea}
                  onChange={(event) => {
                    setMaxArea(event.target.value);
                    setAreaError('');
                  }}
                  onKeyDown={(event) => event.key === 'Enter' && applyArea()}
                  onBlur={applyArea}
                  className={`border-stone-300 ${areaError ? 'border-red-400' : ''}`}
                />
              </div>
              {areaError && <p className="text-xs text-red-500">{areaError}</p>}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Extras Section */}
        <AccordionItem value="extras">
          <AccordionTrigger className="gap-2">
            <span className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-stone-400" />
              {t('sectionExtras')}
            </span>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-500">
                {t('parkingSpaces')}
              </Label>
              <Select value={currentParking} onValueChange={(value) => updateParam('parking', value)}>
                <SelectTrigger className="border-stone-300">
                  <SelectValue placeholder={t('any')} />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="all">{t('any')}</SelectItem>
                  <SelectItem value="1">1+</SelectItem>
                  <SelectItem value="2">2+</SelectItem>
                  <SelectItem value="3">3+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-stone-500">{t('furnished')}</Label>
              <Select
                value={currentFurnished}
                onValueChange={(value) => updateParam('furnished', value)}
              >
                <SelectTrigger className="border-stone-300">
                  <SelectValue placeholder={t('any')} />
                </SelectTrigger>
                <SelectContent className="bg-white z-50">
                  <SelectItem value="all">{t('any')}</SelectItem>
                  <SelectItem value="true">{t('furnishedYes')}</SelectItem>
                  <SelectItem value="false">{t('furnishedNo')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {hasAnyFilter && (
        <Button
          onClick={handleReset}
          variant="outline"
          className="w-full border-stone-300 text-stone-700 hover:bg-stone-50"
        >
          <X className="h-4 w-4 mr-2" />
          {t('resetShort')}
        </Button>
      )}
    </div>
  );
}

export function AdvancedSearchFilters() {
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  return (
    <AdvancedSearchFiltersContent
      key={searchParamsString}
      searchParamsString={searchParamsString}
    />
  );
}
