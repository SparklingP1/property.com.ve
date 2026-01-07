import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Bed, Bath, Maximize, MapPin, ExternalLink, Car, Home, CheckCircle2, User } from 'lucide-react';
import type { Listing } from '@/types/listing';
import { ListingImages } from './listing-images';

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
    rentahouse: 'Rent-A-House',
  };

  // Combine thumbnail_url and image_urls for the gallery
  const images = listing.image_urls && listing.image_urls.length > 0
    ? listing.image_urls
    : listing.thumbnail_url
    ? [listing.thumbnail_url]
    : [];

  return (
    <div>
      {/* Image Gallery */}
      <ListingImages images={images} title={listing.title} />

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
            {[listing.city || listing.location, listing.neighborhood, listing.state || listing.region].filter(Boolean).join(', ')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl md:text-4xl font-bold text-primary">
            {formatPrice(listing.price, listing.currency)}
          </p>
          {listing.transaction_type && (
            <Badge variant="secondary" className="mt-2">
              For {listing.transaction_type === 'sale' ? 'Sale' : 'Rent'}
            </Badge>
          )}
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
              <strong>{listing.area_sqm}</strong> m²
            </span>
          </div>
        )}
        {listing.parking_spaces !== null && (
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg">
              <strong>{listing.parking_spaces}</strong> Parking
            </span>
          </div>
        )}
      </div>

      {/* Property Details */}
      {(listing.property_style || listing.condition || listing.furnished !== null || listing.total_area_sqm || listing.reference_code) && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Property Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {listing.property_style && (
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Style:</span>
                <span className="font-medium">{listing.property_style}</span>
              </div>
            )}
            {listing.condition && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Condition:</span>
                <span className="font-medium capitalize">{listing.condition}</span>
              </div>
            )}
            {listing.furnished !== null && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Furnished:</span>
                <span className="font-medium">{listing.furnished ? 'Yes' : 'No'}</span>
              </div>
            )}
            {listing.total_area_sqm && (
              <div className="flex items-center gap-2">
                <Maximize className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total Area:</span>
                <span className="font-medium">{listing.total_area_sqm} m²</span>
              </div>
            )}
            {listing.reference_code && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Reference:</span>
                <span className="font-medium">{listing.reference_code}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Amenities */}
      {listing.amenities && listing.amenities.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Amenities</h2>
          <div className="flex flex-wrap gap-2">
            {listing.amenities.map((amenity) => (
              <Badge key={amenity} variant="outline" className="capitalize">
                {amenity.replace('_', ' ')}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Agent Info */}
      {listing.agent_name && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Listed By</h2>
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">{listing.agent_name}</span>
            {listing.agent_office && (
              <span className="text-muted-foreground">• {listing.agent_office}</span>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {(listing.description_full || listing.description_short) && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">Description</h2>
          <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
            {listing.description_full || listing.description_short}
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
