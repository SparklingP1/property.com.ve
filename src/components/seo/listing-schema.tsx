import { getListingSummary, type PublicListing } from '@/lib/listing-public';

interface ListingSchemaProps {
  listing: PublicListing;
  locale: string;
  /** Absolute canonical URL of this page in this locale. */
  url: string;
}

const ACCOMMODATION_TYPES: Record<string, string> = {
  apartment: 'Apartment',
  house: 'SingleFamilyResidence',
  annex: 'Accommodation',
};

/**
 * RealEstateListing markup for active listings only. Every value comes from
 * the listing's facts; nothing is derived from the source description, and
 * fields we do not hold (posting date, seller) are left out.
 */
export function ListingSchema({ listing, locale, url }: ListingSchemaProps) {
  const title = (locale === 'en' ? listing.title_en || listing.title : listing.title) || undefined;
  const town = listing.city || listing.location || undefined;
  const region = listing.state || listing.region || undefined;

  const address = {
    '@type': 'PostalAddress',
    addressLocality: town,
    addressRegion: region,
    addressCountry: 'VE',
  };

  const accommodationType = listing.property_type ? ACCOMMODATION_TYPES[listing.property_type] : undefined;
  const about = accommodationType
    ? {
        '@type': accommodationType,
        address,
        numberOfBedrooms: listing.bedrooms || undefined,
        numberOfBathroomsTotal: listing.bathrooms || undefined,
        floorSize: listing.area_sqm
          ? { '@type': 'QuantitativeValue', value: listing.area_sqm, unitCode: 'MTK' }
          : undefined,
      }
    : { '@type': 'Place', address };

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: title,
    description: getListingSummary(listing, locale),
    url,
    inLanguage: locale === 'en' ? 'en' : 'es-VE',
    image: listing.thumbnail_url || undefined,
    about,
    offers:
      listing.price && listing.price > 0
        ? {
            '@type': 'Offer',
            price: listing.price,
            priceCurrency: listing.currency || 'USD',
            businessFunction:
              listing.transaction_type === 'rent'
                ? 'http://purl.org/goodrelations/v1#LeaseOut'
                : 'http://purl.org/goodrelations/v1#Sell',
            url: listing.source_url || undefined,
          }
        : undefined,
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
