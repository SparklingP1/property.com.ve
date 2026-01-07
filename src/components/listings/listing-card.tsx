import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bed, Bath, Maximize, Car, MapPin } from 'lucide-react';
import type { Listing } from '@/types/listing';
import { getListingUrl } from '@/lib/slug';

interface ListingCardProps {
  listing: Listing;
}

export function ListingCard({ listing }: ListingCardProps) {
  const formatPrice = (price: number | null, currency: string) => {
    if (!price) return 'Price on request';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const propertyTypeLabels: Record<string, string> = {
    apartment: 'Apartment',
    house: 'House',
    land: 'Land',
    commercial: 'Commercial',
    office: 'Office',
  };

  // Use thumbnail_url if available, otherwise use first image from image_urls array
  const imageUrl = listing.thumbnail_url || (listing.image_urls && listing.image_urls.length > 0 ? listing.image_urls[0] : null);

  // Use English translations with fallback to Spanish/original
  const displayTitle = listing.title_en || listing.title;

  // Get SEO-friendly URL
  const listingUrl = getListingUrl(listing);

  return (
    <Link href={listingUrl}>
      <Card className="group card-hover overflow-hidden h-full">
        <div className="relative aspect-[3/2] overflow-hidden bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={displayTitle}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-muted-foreground text-sm">No image</span>
            </div>
          )}
          {listing.property_type && (
            <Badge className="absolute top-3 left-3 bg-primary text-primary-foreground">
              {propertyTypeLabels[listing.property_type] || listing.property_type}
            </Badge>
          )}
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
              <span className="flex items-center gap-1">
                <Bed className="h-4 w-4" />
                {listing.bedrooms}
              </span>
            )}
            {listing.bathrooms !== null && (
              <span className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                {listing.bathrooms}
              </span>
            )}
            {listing.area_sqm !== null && (
              <span className="flex items-center gap-1">
                <Maximize className="h-4 w-4" />
                {listing.area_sqm}m²
              </span>
            )}
            {listing.parking_spaces !== null && listing.parking_spaces > 0 && (
              <span className="flex items-center gap-1">
                <Car className="h-4 w-4" />
                {listing.parking_spaces}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
