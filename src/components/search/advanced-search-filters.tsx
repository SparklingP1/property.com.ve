'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
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

export function AdvancedSearchFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // State for all filters
  const [keyword, setKeyword] = useState(searchParams.get('q') || '');
  const [transactionType, setTransactionType] = useState(
    searchParams.get('transaction') || 'all'
  );
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

  const handleSearch = () => {
    const params = new URLSearchParams();

    if (keyword) params.set('q', keyword);
    if (transactionType && transactionType !== 'all')
      params.set('transaction', transactionType);
    if (propertyType && propertyType !== 'all')
      params.set('type', propertyType);
    if (city && city !== 'all') params.set('city', city);
    if (state && state !== 'all') params.set('state', state);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    if (bedrooms && bedrooms !== 'all') params.set('bedrooms', bedrooms);
    if (bathrooms && bathrooms !== 'all') params.set('bathrooms', bathrooms);
    if (parking && parking !== 'all') params.set('parking', parking);
    if (furnished && furnished !== 'all') params.set('furnished', furnished);
    if (minArea) params.set('minArea', minArea);
    if (maxArea) params.set('maxArea', maxArea);

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  };

  const handleReset = () => {
    setKeyword('');
    setTransactionType('all');
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
      {/* Keyword Search */}
      <div className="space-y-2">
        <Label htmlFor="keyword" className="text-sm font-medium text-stone-700">
          Search Keywords
        </Label>
        <Input
          id="keyword"
          placeholder="Location, neighborhood..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="border-stone-300"
        />
      </div>

      <Separator className="bg-stone-200" />

      {/* Transaction Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-stone-700">
          Transaction Type
        </Label>
        <Select value={transactionType} onValueChange={setTransactionType}>
          <SelectTrigger className="border-stone-300">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="sale">For Sale</SelectItem>
            <SelectItem value="rent">For Rent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Property Type */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-stone-700">
          Property Type
        </Label>
        <Select value={propertyType} onValueChange={setPropertyType}>
          <SelectTrigger className="border-stone-300">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any Type</SelectItem>
            <SelectItem value="apartment">Apartment</SelectItem>
            <SelectItem value="house">House</SelectItem>
            <SelectItem value="land">Land</SelectItem>
            <SelectItem value="commercial">Commercial</SelectItem>
            <SelectItem value="office">Office</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Location */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-stone-700">State</Label>
        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="border-stone-300">
            <SelectValue placeholder="Any State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
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

      <Separator className="bg-stone-200" />

      {/* Price Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-stone-700">Price (USD)</Label>
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            className="border-stone-300"
          />
          <Input
            type="number"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            className="border-stone-300"
          />
        </div>
      </div>

      {/* Bedrooms */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-stone-700">Bedrooms</Label>
        <Select value={bedrooms} onValueChange={setBedrooms}>
          <SelectTrigger className="border-stone-300">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
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
        <Label className="text-sm font-medium text-stone-700">Bathrooms</Label>
        <Select value={bathrooms} onValueChange={setBathrooms}>
          <SelectTrigger className="border-stone-300">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="1">1+</SelectItem>
            <SelectItem value="2">2+</SelectItem>
            <SelectItem value="3">3+</SelectItem>
            <SelectItem value="4">4+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Parking */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-stone-700">Parking Spaces</Label>
        <Select value={parking} onValueChange={setParking}>
          <SelectTrigger className="border-stone-300">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="1">1+</SelectItem>
            <SelectItem value="2">2+</SelectItem>
            <SelectItem value="3">3+</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Separator className="bg-stone-200" />

      {/* Area Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium text-stone-700">Area (m²)</Label>
        <div className="grid grid-cols-2 gap-3">
          <Input
            type="number"
            placeholder="Min"
            value={minArea}
            onChange={(e) => setMinArea(e.target.value)}
            className="border-stone-300"
          />
          <Input
            type="number"
            placeholder="Max"
            value={maxArea}
            onChange={(e) => setMaxArea(e.target.value)}
            className="border-stone-300"
          />
        </div>
      </div>

      {/* Furnished */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-stone-700">Furnished</Label>
        <Select value={furnished} onValueChange={setFurnished}>
          <SelectTrigger className="border-stone-300">
            <SelectValue placeholder="Any" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any</SelectItem>
            <SelectItem value="true">Furnished</SelectItem>
            <SelectItem value="false">Unfurnished</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-4">
        <Button
          onClick={handleSearch}
          disabled={isPending}
          className="w-full bg-stone-900 hover:bg-stone-800 text-white"
        >
          <Search className="h-4 w-4 mr-2" />
          {isPending ? 'Searching...' : 'Apply Filters'}
        </Button>
        <Button
          onClick={handleReset}
          variant="outline"
          className="w-full border-stone-300 text-stone-700 hover:bg-stone-50"
        >
          <X className="h-4 w-4 mr-2" />
          Reset
        </Button>
      </div>
    </div>
  );
}
