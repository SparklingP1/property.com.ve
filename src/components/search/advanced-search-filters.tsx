'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
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
import { Search, X, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { parseSearchQuery } from '@/lib/search-parser';
import { Badge } from '@/components/ui/badge';

export function AdvancedSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const t = useTranslations('search');
  const tListing = useTranslations('listing');

  // State for all filters
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [propertyType, setPropertyType] = useState(
    searchParams.get('type') || 'all'
  );
  const [city, setCity] = useState(searchParams.get('city') || 'all');
  const [state, setState] = useState(searchParams.get('state') || 'all');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [bedrooms, setBedrooms] = useState(searchParams.get('bedrooms') || 'all');
  const [bathrooms, setBathrooms] = useState(searchParams.get('bathrooms') || 'all');
  const [parking, setParking] = useState(searchParams.get('parking') || 'all');
  const [furnished, setFurnished] = useState(searchParams.get('furnished') || 'all');
  const [minArea, setMinArea] = useState(searchParams.get('minArea') || '');
  const [maxArea, setMaxArea] = useState(searchParams.get('maxArea') || '');
  const [detectedFilters, setDetectedFilters] = useState<string[]>([]);
  const [priceError, setPriceError] = useState('');
  const [areaError, setAreaError] = useState('');

  const handleSearch = () => {
    // Validate price range
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setPriceError(t('priceRangeError'));
      return;
    }
    setPriceError('');

    // Validate area range
    if (minArea && maxArea && Number(minArea) > Number(maxArea)) {
      setAreaError(t('areaRangeError'));
      return;
    }
    setAreaError('');

    const detected: string[] = [];
    const params = new URLSearchParams();

    // Parse the keyword for smart search
    let finalKeyword = keyword;
    let finalPropertyType = propertyType;
    let finalBedrooms = bedrooms;
    let finalBathrooms = bathrooms;
    let finalFurnished = furnished;

    if (keyword) {
      const parsed = parseSearchQuery(keyword);

      // Apply parsed filters (only if not already set by manual filters)
      // Note: bedrooms/bathrooms parsing disabled - use manual dropdowns for those
      if (parsed.propertyType && propertyType === 'all') {
        finalPropertyType = parsed.propertyType;
        detected.push(`${parsed.propertyType.charAt(0).toUpperCase() + parsed.propertyType.slice(1)}`);
      }
      if (parsed.furnished !== undefined && furnished === 'all') {
        finalFurnished = parsed.furnished.toString();
        detected.push(parsed.furnished ? t('furnished') : t('unfurnished'));
      }

      // Use remaining keywords for text search
      finalKeyword = parsed.remainingKeywords || keyword;

      setDetectedFilters(detected);
    } else {
      setDetectedFilters([]);
    }

    if (finalKeyword) params.set('q', finalKeyword);
    if (finalPropertyType && finalPropertyType !== 'all')
      params.set('type', finalPropertyType);
    if (city && city !== 'all') params.set('city', city);
    if (state && state !== 'all') params.set('state', state);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (finalBedrooms && finalBedrooms !== 'all') params.set('bedrooms', finalBedrooms);
    if (finalBathrooms && finalBathrooms !== 'all') params.set('bathrooms', finalBathrooms);
    if (parking && parking !== 'all') params.set('parking', parking);
    if (finalFurnished && finalFurnished !== 'all') params.set('furnished', finalFurnished);
    if (minArea) params.set('minArea', minArea);
    if (maxArea) params.set('maxArea', maxArea);

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setKeyword('');
    setPropertyType('all');
    setCity('all');
    setState('all');
    setMinPrice('');
    setMaxPrice('');
    setBedrooms('all');
    setBathrooms('all');
    setParking('all');
    setFurnished('all');
    setMinArea('');
    setMaxArea('');

    startTransition(() => {
      router.push('/search');
    });
  };

  return (
    <div className="space-y-6">
      {/* Keyword Search - Full Width */}
      <div className="space-y-2">
        <Label htmlFor="keyword" className="text-sm font-medium text-stone-700 flex items-center gap-2">
          {t('keywords')}
          <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 border-amber-200">
            <Sparkles className="h-3 w-3 mr-1" />
            {t('smart')}
          </Badge>
        </Label>
        <Input
          id="keyword"
          placeholder={t('placeholder')}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="border-stone-300"
        />
        <p className="text-xs text-stone-500">
          {t('keywordsHint')}
        </p>
        {detectedFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            <span className="text-xs text-stone-600">{t('detected')}</span>
            {detectedFilters.map((filter, idx) => (
              <Badge key={idx} variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                {filter}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Separator className="bg-stone-200" />

      {/* Two Column Grid on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          {/* Property Type */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-stone-700">
              {t('propertyType')}
            </Label>
            <Select value={propertyType} onValueChange={setPropertyType}>
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
          <div className="space-y-2">
            <Label className="text-sm font-medium text-stone-700">{t('state')}</Label>
            <Select value={state} onValueChange={setState}>
              <SelectTrigger className="border-stone-300">
                <SelectValue placeholder={t('anyState')} />
              </SelectTrigger>
              <SelectContent className="bg-white z-50">
                <SelectItem value="all">{t('allStates')}</SelectItem>
                <SelectItem value="Distrito Metropolitano">
                  Distrito Metropolitano
                </SelectItem>
                <SelectItem value="Miranda">Miranda</SelectItem>
                <SelectItem value="Vargas">Vargas</SelectItem>
                <SelectItem value="Carabobo">Carabobo</SelectItem>
                <SelectItem value="Aragua">Aragua</SelectItem>
                <SelectItem value="Zulia">Zulia</SelectItem>
                <SelectItem value="Lara">Lara</SelectItem>
                <SelectItem value="Anzoategui">Anzoategui</SelectItem>
                <SelectItem value="Merida">Merida</SelectItem>
                <SelectItem value="Portuguesa">Portuguesa</SelectItem>
                <SelectItem value="Falcon">Falcon</SelectItem>
                <SelectItem value="Nueva Esparta">Nueva Esparta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Bedrooms */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-stone-700">{t('bedrooms')}</Label>
            <Select value={bedrooms} onValueChange={setBedrooms}>
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
          <div className="space-y-2">
            <Label className="text-sm font-medium text-stone-700">{t('bathrooms')}</Label>
            <Select value={bathrooms} onValueChange={setBathrooms}>
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

        {/* Right Column */}
        <div className="space-y-6">
          {/* Price Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-stone-700">{t('priceUSD')}</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder={t('min')}
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value); setPriceError(''); }}
                className={`border-stone-300 ${priceError ? 'border-red-400' : ''}`}
              />
              <Input
                type="number"
                placeholder={t('max')}
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); setPriceError(''); }}
                className={`border-stone-300 ${priceError ? 'border-red-400' : ''}`}
              />
            </div>
            {priceError && <p className="text-xs text-red-500 mt-1">{priceError}</p>}
          </div>

          {/* Parking */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-stone-700">{t('parkingSpaces')}</Label>
            <Select value={parking} onValueChange={setParking}>
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

          {/* Area Range */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-stone-700">{t('areaM2')}</Label>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                placeholder={t('min')}
                value={minArea}
                onChange={(e) => { setMinArea(e.target.value); setAreaError(''); }}
                className={`border-stone-300 ${areaError ? 'border-red-400' : ''}`}
              />
              <Input
                type="number"
                placeholder={t('max')}
                value={maxArea}
                onChange={(e) => { setMaxArea(e.target.value); setAreaError(''); }}
                className={`border-stone-300 ${areaError ? 'border-red-400' : ''}`}
              />
            </div>
            {areaError && <p className="text-xs text-red-500 mt-1">{areaError}</p>}
          </div>

          {/* Furnished */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-stone-700">{t('furnished')}</Label>
            <Select value={furnished} onValueChange={setFurnished}>
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
        </div>
      </div>

      <Separator className="bg-stone-200" />

      {/* Action Buttons */}
      <div className="space-y-3 pt-4">
        <Button
          onClick={handleSearch}
          disabled={isPending}
          className="w-full bg-stone-900 hover:bg-stone-800 text-white"
        >
          <Search className="h-4 w-4 mr-2" />
          {isPending ? t('searching') : t('applyFilters')}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="w-full border-stone-300 text-stone-700 hover:bg-stone-50"
        >
          <X className="h-4 w-4 mr-2" />
          {t('reset')}
        </Button>
      </div>
    </div>
  );
}
