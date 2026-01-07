import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bed, Bath, Maximize } from 'lucide-react';
import type { Listing } from '@/types/listing';

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

  return (
    <Link href={`/listing/${listing.id}`}>
      <Card className="group card-hover overflow-hidden h-full">
        <div className="relative aspect-[4/3] overflow-hidden bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={listing.title}
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

        <CardContent className="p-4">
          <p className="text-2xl font-bold text-primary-700">
            {formatPrice(listing.price, listing.currency)}
          </p>
          <h3 className="font-semibold text-lg mt-1 line-clamp-2 text-foreground">
            {listing.title}
          </h3>
          <p className="text-muted-foreground text-sm mt-1">
            {[listing.location, listing.region].filter(Boolean).join(', ')}
          </p>

          <div className="flex gap-4 mt-4 text-sm text-muted-foreground">
            {listing.bedrooms !== null && (
              <span className="flex items-center gap-1">
                <Bed className="h-4 w-4" />
                {listing.bedrooms} beds
              </span>
            )}
            {listing.bathrooms !== null && (
              <span className="flex items-center gap-1">
                <Bath className="h-4 w-4" />
                {listing.bathrooms} baths
              </span>
            )}
            {listing.area_sqm !== null && (
              <span className="flex items-center gap-1">
                <Maximize className="h-4 w-4" />
                {listing.area_sqm} m&sup2;
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
