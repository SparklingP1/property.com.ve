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
import { Search, X } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { parseSearchQuery } from '@/lib/search-parser';

export function AdvancedSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('search');
  const tListing = useTranslations('listing');

  // Dynamic options from database
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);

  // Read dropdown values directly from URL (auto-apply)
  const currentType = searchParams.get('type') || 'all';
  const currentState = searchParams.get('state') || 'all';
  const currentCity = searchParams.get('city') || 'all';
  const currentBedrooms = searchParams.get('bedrooms') || 'all';
  const currentBathrooms = searchParams.get('bathrooms') || 'all';
  const currentParking = searchParams.get('parking') || 'all';
  const currentFurnished = searchParams.get('furnished') || 'all';

  // Text/number inputs use local state (applied on Enter)
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [minArea, setMinArea] = useState(searchParams.get('minArea') || '');
  const [maxArea, setMaxArea] = useState(searchParams.get('maxArea') || '');
  const [priceError, setPriceError] = useState('');
  const [areaError, setAreaError] = useState('');

  // Sync local text state when URL params change externally (e.g. filter chip removal)
  useEffect(() => {
    setKeyword(searchParams.get('q') || '');
    setMinPrice(searchParams.get('minPrice') || '');
    setMaxPrice(searchParams.get('maxPrice') || '');
    setMinArea(searchParams.get('minArea') || '');
    setMaxArea(searchParams.get('maxArea') || '');
    setPriceError('');
    setAreaError('');
  }, [searchParams]);

  // Fetch available states on mount
  useEffect(() => {
    const fetchStates = async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('listings')
        .select('state')
        .eq('active', true)
        .not('state', 'is', null);
      if (data) {
        const states = [...new Set(data.map((d: { state: string }) => d.state).filter(Boolean))] as string[];
        states.sort();
        setAvailableStates(states);
      }
    };
    fetchStates();
  }, []);

  // Fetch cities when state changes
  useEffect(() => {
    const fetchCities = async () => {
      const supabase = createClient();
      let query = supabase
        .from('listings')
        .select('city')
        .eq('active', true)
        .not('city', 'is', null);
      if (currentState !== 'all') {
        query = query.eq('state', currentState);
      }
      const { data } = await query;
      if (data) {
        const cities = [...new Set(data.map((d: { city: string }) => d.city).filter(Boolean))] as string[];
        cities.sort();
        setAvailableCities(cities);
      }
    };
    fetchCities();
  }, [currentState]);

  // Update a single URL param (instant apply for dropdowns)
  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== 'all') {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // If state changes, clear city (it may not exist in new state)
    if (key === 'state') {
      params.delete('city');
    }
    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }, [searchParams, router, startTransition]);

  // Apply keyword search (on Enter)
  const applyKeyword = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (keyword.trim()) {
      const parsed = parseSearchQuery(keyword);
      const finalKeyword = parsed.remainingKeywords || keyword;
      if (finalKeyword.trim()) {
        params.set('q', finalKeyword.trim());
      } else {
        params.delete('q');
      }
      // Smart detection: apply parsed filters if not already set
      if (parsed.propertyType && !params.get('type')) {
        params.set('type', parsed.propertyType);
      }
      if (parsed.furnished !== undefined && !params.get('furnished')) {
        params.set('furnished', parsed.furnished.toString());
      }
    } else {
      params.delete('q');
    }

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }, [keyword, searchParams, router, startTransition]);

  // Apply price range (on Enter)
  const applyPrice = useCallback(() => {
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setPriceError(t('priceRangeError'));
      return;
    }
    setPriceError('');

    const params = new URLSearchParams(searchParams.toString());
    if (minPrice) params.set('minPrice', minPrice); else params.delete('minPrice');
    if (maxPrice) params.set('maxPrice', maxPrice); else params.delete('maxPrice');

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }, [minPrice, maxPrice, searchParams, router, startTransition, t]);

  // Apply area range (on Enter)
  const applyArea = useCallback(() => {
    if (minArea && maxArea && Number(minArea) > Number(maxArea)) {
      setAreaError(t('areaRangeError'));
      return;
    }
    setAreaError('');

    const params = new URLSearchParams(searchParams.toString());
    if (minArea) params.set('minArea', minArea); else params.delete('minArea');
    if (maxArea) params.set('maxArea', maxArea); else params.delete('maxArea');

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  }, [minArea, maxArea, searchParams, router, startTransition, t]);

  const handleReset = () => {
    startTransition(() => {
      router.push('/search');
    });
  };

  const hasAnyFilter = searchParams.toString().length > 0;

  return (
    <div className="space-y-5">
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
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyKeyword()}
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

      <Separator className="bg-stone-200" />

      {/* Property Type */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-stone-700">
          {t('propertyType')}
        </Label>
        <Select value={currentType} onValueChange={(v) => updateParam('type', v)}>
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

      {/* State */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-stone-700">{t('state')}</Label>
        <Select value={currentState} onValueChange={(v) => updateParam('state', v)}>
          <SelectTrigger className="border-stone-300">
            <SelectValue placeholder={t('anyState')} />
          </SelectTrigger>
          <SelectContent className="bg-white z-50">
            <SelectItem value="all">{t('allStates')}</SelectItem>
            {availableStates.map((state) => (
              <SelectItem key={state} value={state}>{state}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* City (depends on state) */}
      {availableCities.length > 0 && (
        <div className="space-y-1.5">
          <Label className="text-sm font-medium text-stone-700">{t('city')}</Label>
          <Select value={currentCity} onValueChange={(v) => updateParam('city', v)}>
            <SelectTrigger className="border-stone-300">
              <SelectValue placeholder={t('anyCity')} />
            </SelectTrigger>
            <SelectContent className="bg-white z-50">
              <SelectItem value="all">{t('allCities')}</SelectItem>
              {availableCities.map((city) => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Bedrooms */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-stone-700">{t('bedrooms')}</Label>
        <Select value={currentBedrooms} onValueChange={(v) => updateParam('bedrooms', v)}>
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

      {/* Bathrooms */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-stone-700">{t('bathrooms')}</Label>
        <Select value={currentBathrooms} onValueChange={(v) => updateParam('bathrooms', v)}>
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

      <Separator className="bg-stone-200" />

      {/* Price Range */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-stone-700">{t('priceUSD')}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder={t('min')}
            value={minPrice}
            onChange={(e) => { setMinPrice(e.target.value); setPriceError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && applyPrice()}
            onBlur={applyPrice}
            className={`border-stone-300 ${priceError ? 'border-red-400' : ''}`}
          />
          <Input
            type="number"
            placeholder={t('max')}
            value={maxPrice}
            onChange={(e) => { setMaxPrice(e.target.value); setPriceError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && applyPrice()}
            onBlur={applyPrice}
            className={`border-stone-300 ${priceError ? 'border-red-400' : ''}`}
          />
        </div>
        {priceError && <p className="text-xs text-red-500">{priceError}</p>}
      </div>

      {/* Area Range */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-stone-700">{t('areaM2')}</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder={t('min')}
            value={minArea}
            onChange={(e) => { setMinArea(e.target.value); setAreaError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && applyArea()}
            onBlur={applyArea}
            className={`border-stone-300 ${areaError ? 'border-red-400' : ''}`}
          />
          <Input
            type="number"
            placeholder={t('max')}
            value={maxArea}
            onChange={(e) => { setMaxArea(e.target.value); setAreaError(''); }}
            onKeyDown={(e) => e.key === 'Enter' && applyArea()}
            onBlur={applyArea}
            className={`border-stone-300 ${areaError ? 'border-red-400' : ''}`}
          />
        </div>
        {areaError && <p className="text-xs text-red-500">{areaError}</p>}
      </div>

      <Separator className="bg-stone-200" />

      {/* Parking */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-stone-700">{t('parkingSpaces')}</Label>
        <Select value={currentParking} onValueChange={(v) => updateParam('parking', v)}>
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

      {/* Furnished */}
      <div className="space-y-1.5">
        <Label className="text-sm font-medium text-stone-700">{t('furnished')}</Label>
        <Select value={currentFurnished} onValueChange={(v) => updateParam('furnished', v)}>
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

      {/* Reset Button */}
      {hasAnyFilter && (
        <>
          <Separator className="bg-stone-200" />
          <Button
            onClick={handleReset}
            variant="outline"
            className="w-full border-stone-300 text-stone-700 hover:bg-stone-50"
          >
            <X className="h-4 w-4 mr-2" />
            {t('resetShort')}
          </Button>
        </>
      )}
    </div>
  );
}
