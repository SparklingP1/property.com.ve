'use client';

import { useRouter } from 'next/navigation';
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

export function SearchBar() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [location, setLocation] = useState('');
  const [transactionType, setTransactionType] = useState('all');

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (location) params.set('q', location);
    if (transactionType && transactionType !== 'all')
      params.set('transaction', transactionType);

    startTransition(() => {
      router.push(`/search?${params.toString()}`);
    });
  };

  return (
    <div className="flex flex-col md:flex-row gap-3">
      <div className="flex-1">
        <Input
          placeholder="Enter city, neighborhood, or state..."
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          className="h-14 text-base px-5"
        />
      </div>

      <Select value={transactionType} onValueChange={setTransactionType}>
        <SelectTrigger className="h-14 md:w-48 text-base">
          <SelectValue placeholder="Buy or Rent" />
        </SelectTrigger>
        <SelectContent className="bg-white">
          <SelectItem value="all">Buy or Rent</SelectItem>
          <SelectItem value="sale">For Sale</SelectItem>
          <SelectItem value="rent">For Rent</SelectItem>
        </SelectContent>
      </Select>

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
