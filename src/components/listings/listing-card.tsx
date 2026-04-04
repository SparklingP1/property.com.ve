'use client';

import Image from 'next/image';
import { Link } from '@/i18n/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bed, Bath, Maximize, Car, MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import type { Listing } from '@/types/listing';
import { getListingUrlForLocale } from '@/lib/slug';
import { SaveButton } from './save-button';

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const t = useTranslations('listing');
  const locale = useLocale();

  const formatPrice = (price: number | null, currency: string) => {
    if (!price) return t('priceOnRequest');
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const propertyTypeLabels: Record<string, string> = {
    apartment: t('apartment'),
    house: t('house'),
    land: t('land'),
    commercial: t('commercial'),
    office: t('office'),
  };

  // Use thumbnail_url if available, otherwise use first image from image_urls array
  const imageUrl = listing.thumbnail_url || (listing.image_urls && listing.image_urls.length > 0 ? listing.image_urls[0] : null);

  // Use locale-appropriate title
  const displayTitle = locale === 'en' ? (listing.title_en || listing.title) : listing.title;

  // Get locale-aware SEO-friendly URL
  const listingUrl = getListingUrlForLocale(listing, locale);

  return (
    <Link href={listingUrl}>
      <Card className="group card-hover overflow-hidden h-full transition-shadow duration-200 hover:shadow-lg hover:border-primary/30">
        <div className="relative aspect-[3/2] overflow-hidden bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={displayTitle}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              loading="lazy"
              quality={60}
              placeholder="blur"
              blurDataURL="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNzAwIiBoZWlnaHQ9IjQ3NSIgZmlsbD0iI2UzZTNlMyIvPjwvc3ZnPg=="
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-muted-foreground text-sm">{t('noImage')}</span>
            </div>
          )}
          {listing.property_type && (
            <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
              {propertyTypeLabels[listing.property_type] || listing.property_type}
            </Badge>
          )}
          <div className="absolute top-3 right-3">
            <SaveButton listingId={listing.id} />
          </div>
        </div>

        <CardContent className="p-3">
          <p className="text-xl font-bold text-primary-700">
            {formatPrice(listing.price, listing.currency)}
          </p>
          <h3 className="font-semibold text-base mt-1 line-clamp-2 text-foreground">
            {displayTitle}
          </h3>
          <p className="text-muted-foreground text-xs mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {[listing.city || listing.location, listing.neighborhood, listing.state || listing.region].filter(Boolean).join(', ')}
          </p>

          <div className="flex flex-wrap gap-2 mt-3 text-xs text-muted-foreground">
            {listing.bedrooms !== null && (
              <span className="flex items-center gap-1" aria-label={`${listing.bedrooms} ${t('bedrooms')}`}>
                <Bed className="h-4 w-4" aria-hidden="true" />
                {listing.bedrooms}
              </span>
            )}
            {listing.bathrooms !== null && (
              <span className="flex items-center gap-1" aria-label={`${listing.bathrooms} ${t('bathrooms')}`}>
                <Bath className="h-4 w-4" aria-hidden="true" />
                {listing.bathrooms}
              </span>
            )}
            {listing.area_sqm !== null && (
              <span className="flex items-center gap-1" aria-label={`${listing.area_sqm} m²`}>
                <Maximize className="h-4 w-4" aria-hidden="true" />
                {listing.area_sqm}m²
              </span>
            )}
            {listing.parking_spaces !== null && listing.parking_spaces > 0 && (
              <span className="flex items-center gap-1" aria-label={`${listing.parking_spaces} ${t('parking')}`}>
                <Car className="h-4 w-4" aria-hidden="true" />
                {listing.parking_spaces}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
