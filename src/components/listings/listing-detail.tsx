import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bed, Bath, Maximize, MapPin, ExternalLink } from 'lucide-react';
import type { Listing } from '@/types/listing';

interface ListingDetailProps {
  listing: Listing;
}

export function ListingDetail({ listing }: ListingDetailProps) {
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

  const sourceLabels: Record<string, string> = {
    'green-acres': 'Green-Acres',
    bienesonline: 'BienesOnline',
  };

  return (
    <div>
      {/* Image */}
      <div className="relative aspect-[16/9] md:aspect-[21/9] overflow-hidden rounded-xl bg-muted mb-6">
        {listing.thumbnail_url ? (
          <Image
            src={listing.thumbnail_url}
            alt={listing.title}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-muted-foreground">No image available</span>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {listing.property_type && (
              <Badge className="bg-primary text-primary-foreground">
                {propertyTypeLabels[listing.property_type] || listing.property_type}
              </Badge>
            )}
            <Badge variant="outline">
              {sourceLabels[listing.source] || listing.source}
            </Badge>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            {listing.title}
          </h1>
          <p className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {[listing.location, listing.region].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl md:text-4xl font-bold text-primary">
            {formatPrice(listing.price, listing.currency)}
          </p>
        </div>
      </div>

      {/* Features */}
      <div className="flex flex-wrap gap-6 py-6 border-y border-border mb-6">
        {listing.bedrooms !== null && (
          <div className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg">
              <strong>{listing.bedrooms}</strong> Bedrooms
            </span>
          </div>
        )}
        {listing.bathrooms !== null && (
          <div className="flex items-center gap-2">
            <Bath className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg">
              <strong>{listing.bathrooms}</strong> Bathrooms
            </span>
          </div>
        )}
        {listing.area_sqm !== null && (
          <div className="flex items-center gap-2">
            <Maximize className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg">
              <strong>{listing.area_sqm}</strong> m&sup2;
            </span>
          </div>
        )}
      </div>

      {/* Description */}
      {listing.description_short && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Description</h2>
          <p className="text-muted-foreground leading-relaxed">
            {listing.description_short}
          </p>
        </div>
      )}

      {/* View Original */}
      <div className="bg-primary-50 rounded-xl p-6">
        <h3 className="font-semibold mb-2">View Full Listing</h3>
        <p className="text-muted-foreground text-sm mb-4">
          This listing is sourced from {sourceLabels[listing.source] || listing.source}.
          View the original listing for complete details, more photos, and contact
          information.
        </p>
        <Button asChild className="bg-primary hover:bg-primary-700">
          <a href={listing.source_url} target="_blank" rel="noopener noreferrer">
            View on {sourceLabels[listing.source] || listing.source}
            <ExternalLink className="ml-2 h-4 w-4" />
          </a>
        </Button>
      </div>
    </div>
  );
}
