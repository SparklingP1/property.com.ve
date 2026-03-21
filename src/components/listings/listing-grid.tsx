'use client';

import { useTranslations } from 'next-intl';
import { ListingCard } from './listing-card';
import type { Listing } from '@/types/listing';

interface ListingGridProps {
  listings: Listing[];
  totalCount?: number;
}

export function ListingGrid({ listings, totalCount }: ListingGridProps) {
  const t = useTranslations('listing');

  if (listings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground text-lg">{t('noPropertiesFound')}</p>
        <p className="text-muted-foreground text-sm mt-2">
          {t('tryAdjusting')}
        </p>
      </div>
    );
  }

  return (
    <div>
      {totalCount !== undefined && (
        <p className="text-muted-foreground mb-6">
          {t('showingOf', { current: listings.length, total: totalCount })}
        </p>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </div>
  );
}
