'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search } from 'lucide-react';

const regions = [
  { value: 'all', label: 'All Regions' },
  { value: 'Caracas', label: 'Caracas' },
  { value: 'Miranda', label: 'Miranda' },
  { value: 'Zulia', label: 'Zulia' },
  { value: 'Carabobo', label: 'Carabobo' },
  { value: 'Lara', label: 'Lara' },
  { value: 'Aragua', label: 'Aragua' },
  { value: 'Nueva Esparta', label: 'Nueva Esparta (Margarita)' },
  { value: 'Anzoategui', label: 'Anzoategui' },
  { value: 'Bolivar', label: 'Bolivar' },
];

const propertyTypes = [
  { value: 'all', label: 'All Types' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'land', label: 'Land' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'office', label: 'Office' },
];

const priceRanges = [
  { value: 'all', label: 'Any Price' },
  { value: '0-50000', label: 'Under $50,000' },
  { value: '50000-100000', label: '$50,000 - $100,000' },
  { value: '100000-200000', label: '$100,000 - $200,000' },
  { value: '200000-500000', label: '$200,000 - $500,000' },
  { value: '500000-', label: '$500,000+' },
];

export function SearchBar() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [region, setRegion] = useState(searchParams.get('region') || 'all');
  const [propertyType, setPropertyType] = useState(searchParams.get('type') || 'all');
  const [priceRange, setPriceRange] = useState(searchParams.get('price') || 'all');

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (region && region !== 'all') params.set('region', region);
    if (propertyType && propertyType !== 'all') params.set('type', propertyType);
    if (priceRange && priceRange !== 'all') params.set('price', priceRange);

    startTransition(() => {
      router.push(`/?${params.toString()}`);
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-4 md:p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2">
          <Input
            placeholder="Search by location or keyword..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-11"
          />
        </div>

        <Select value={region} onValueChange={setRegion}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Region" />
          </SelectTrigger>
          <SelectContent>
            {regions.map((r) => (
              <SelectItem key={r.value} value={r.value}>
                {r.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={propertyType} onValueChange={setPropertyType}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Property Type" />
          </SelectTrigger>
          <SelectContent>
            {propertyTypes.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          onClick={handleSearch}
          disabled={isPending}
          className="h-11 bg-primary hover:bg-primary-700"
        >
          <Search className="h-4 w-4 mr-2" />
          {isPending ? 'Searching...' : 'Search'}
        </Button>
      </div>
    </div>
  );
}
