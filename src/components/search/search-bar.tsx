'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { parseSearchQuery } from '@/lib/search-parser';

export function SearchBar() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [location, setLocation] = useState('');

  const handleSearch = () => {
    const params = new URLSearchParams();

    if (location) {
      // Parse the query for smart search
      const parsed = parseSearchQuery(location);

      // Apply parsed filters
      if (parsed.bedrooms) {
        params.set('bedrooms', parsed.bedrooms.toString());
      }
      if (parsed.bathrooms) {
        params.set('bathrooms', parsed.bathrooms.toString());
      }
      if (parsed.propertyType) {
        params.set('type', parsed.propertyType);
      }
      if (parsed.transactionType) {
        params.set('transaction', parsed.transactionType);
      }
      if (parsed.furnished !== undefined) {
        params.set('furnished', parsed.furnished.toString());
      }

      // Use remaining keywords for text search
      const finalQuery = parsed.remainingKeywords || location;
      if (finalQuery) {
        params.set('q', finalQuery);
      }
    }

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="flex-1">
        <Input
          placeholder="Try: '2 bedroom apartment Caracas' or 'casa en venta Valencia'"
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
        {isPending ? 'Searching...' : 'Search'}
      </Button>
    </div>
  );
}
