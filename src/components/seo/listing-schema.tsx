import type { Listing } from '@/types/listing';

interface ListingSchemaProps {
  listing: Listing;
}

export function ListingSchema({ listing }: ListingSchemaProps) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.title,
    description: listing.description_short || undefined,
    url: `${process.env.NEXT_PUBLIC_SITE_URL}/listing/${listing.id}`,
    datePosted: listing.scraped_at,
    offers: {
      '@type': 'Offer',
      price: listing.price || undefined,
      priceCurrency: listing.currency,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: listing.location || undefined,
      addressRegion: listing.region || undefined,
      addressCountry: 'VE',
    },
    numberOfRooms: listing.bedrooms || undefined,
    numberOfBathroomsTotal: listing.bathrooms || undefined,
    floorSize: listing.area_sqm
      ? {
          '@type': 'QuantitativeValue',
          value: listing.area_sqm,
          unitCode: 'MTK',
        }
      : undefined,
    image: listing.thumbnail_url || undefined,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
      }}
    />
  );
}
