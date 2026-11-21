'use client';

import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import {
  Bed,
  Bath,
  Maximize,
  MapPin,
  ExternalLink,
  Car,
  Home,
  CheckCircle2,
} from 'lucide-react';
import { useTranslations, useLocale } from 'next-intl';
import {
  formatListingDate,
  formatListingPrice,
  getListingSummary,
  getSourceName,
  type PublicListing,
} from '@/lib/listing-public';

interface ListingDetailProps {
  /** Already passed through toPublicListing(): no description, gallery or agent contacts. */
  listing: PublicListing;
  /** Inactive listings: no link-out button, price shown as the last listed price. */
  unavailable?: boolean;
}

function normalizePhrase(value: string) {
  return value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function toTitleCase(value: string) {
  return normalizePhrase(value)
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function translatePropertyStyle(style: string | null): string | null {
  if (!style) {
    return null;
  }

  const translations: Record<string, string> = {
    'un nivel': 'one level',
    'dos niveles': 'two levels',
    'tres niveles': 'three levels',
    'multiple niveles': 'multiple levels',
    'casa quinta': 'detached house',
    townhouse: 'townhouse',
    adosado: 'townhouse',
    unifamiliar: 'single family',
    'pent-house': 'penthouse',
    penthouse: 'penthouse',
    duplex: 'duplex',
    triplex: 'triplex',
    estudio: 'studio',
    moderno: 'modern',
    contemporaneo: 'contemporary',
    colonial: 'colonial',
    rustico: 'rustic',
  };

  const normalized = normalizePhrase(style).toLowerCase();
  return translations[normalized] || normalizePhrase(style);
}

function formatCondition(condition: string, locale: string) {
  const normalized = normalizePhrase(condition).toLowerCase();
  const localeKey = locale === 'es' ? 'es' : 'en';
  const labels: Record<string, { en: string; es: string }> = {
    used: { en: 'Pre-owned', es: 'Usado' },
    new: { en: 'New', es: 'Nuevo' },
    renovated: { en: 'Renovated', es: 'Remodelado' },
    remodelled: { en: 'Renovated', es: 'Remodelado' },
    excellent: { en: 'Excellent', es: 'Excelente' },
    good: { en: 'Good', es: 'Bueno' },
    'under construction': { en: 'Under construction', es: 'En construccion' },
  };

  return labels[normalized]?.[localeKey] || toTitleCase(normalized);
}

function formatAmenity(amenity: string, locale: string) {
  const normalized = normalizePhrase(amenity).toLowerCase();
  const localeKey = locale === 'es' ? 'es' : 'en';
  const labels: Record<string, { en: string; es: string }> = {
    elevator: { en: 'Elevator', es: 'Ascensor' },
    playground: { en: 'Playground', es: 'Parque infantil' },
    'air conditioning': { en: 'Air conditioning', es: 'Aire acondicionado' },
    pool: { en: 'Pool', es: 'Piscina' },
    'swimming pool': { en: 'Pool', es: 'Piscina' },
    garden: { en: 'Garden', es: 'Jardin' },
    terrace: { en: 'Terrace', es: 'Terraza' },
    balcony: { en: 'Balcony', es: 'Balcon' },
    furnished: { en: 'Furnished', es: 'Amoblado' },
    parking: { en: 'Parking', es: 'Estacionamiento' },
    security: { en: 'Security', es: 'Seguridad' },
    gym: { en: 'Gym', es: 'Gimnasio' },
    internet: { en: 'Internet', es: 'Internet' },
  };

  return labels[normalized]?.[localeKey] || toTitleCase(normalized);
}
export function ListingDetail({ listing, unavailable = false }: ListingDetailProps) {
  const t = useTranslations('listing');
  const tDetail = useTranslations('propertyDetail');
  const locale = useLocale();

  const propertyTypeLabels: Record<string, string> = {
    apartment: t('apartment'),
    house: t('house'),
    land: t('land'),
    commercial: t('commercial'),
    office: t('office'),
  };

  const image = listing.thumbnail_url;
  const displayTitle = (locale === 'en' ? listing.title_en || listing.title : listing.title) || '';
  const summary = getListingSummary(listing, locale, { includePrice: !unavailable });
  const sourceName = getSourceName(listing.source);
  const lastSeen = formatListingDate(listing.last_seen_at, locale);
  const price = formatListingPrice(listing.price, listing.currency, locale);
  const displayStyle = listing.property_style
    ? toTitleCase(
        locale === 'en'
          ? translatePropertyStyle(listing.property_style) || listing.property_style
          : listing.property_style
      )
    : null;

  return (
    <div>
      <div className="relative aspect-[4/3] md:aspect-[16/9] overflow-hidden rounded-xl bg-muted mb-6">
        {image ? (
          <Image
            src={image}
            alt={displayTitle}
            fill
            className="object-cover object-center"
            sizes="(max-width: 1024px) 100vw, 66vw"
            priority
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-muted-foreground">{t('noImagesAvailable')}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            {listing.property_type && (
              <Badge className="bg-primary text-primary-foreground">
                {propertyTypeLabels[listing.property_type] || listing.property_type}
              </Badge>
            )}
            <Badge variant="outline">{sourceName}</Badge>
          </div>
          {unavailable ? (
            <p className="text-2xl md:text-3xl font-bold text-foreground mb-2">{displayTitle}</p>
          ) : (
            <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">{displayTitle}</h1>
          )}
          <p className="text-muted-foreground flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {[
              listing.city || listing.location,
              listing.neighborhood,
              listing.state || listing.region,
            ]
              .filter(Boolean)
              .join(', ')}
          </p>
        </div>
        <div className="text-right">
          {unavailable ? (
            price && (
              <div>
                <p className="text-sm text-muted-foreground">{tDetail('lastListedPrice')}</p>
                <p className="text-2xl font-semibold text-muted-foreground line-through decoration-1">
                  {price}
                </p>
                <p className="text-xs text-muted-foreground max-w-[16rem] mt-1">
                  {tDetail('lastListedPriceNote')}
                </p>
              </div>
            )
          ) : (
            <>
              <p className="text-3xl md:text-4xl font-bold text-primary">{price || t('priceOnRequest')}</p>
              {listing.transaction_type && (
                <Badge variant="secondary" className="mt-2">
                  {listing.transaction_type === 'sale' ? t('forSale') : t('forRent')}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-6 py-6 border-y border-border mb-6">
        {listing.bedrooms !== null && (
          <div className="flex items-center gap-2">
            <Bed className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg">
              <strong>{listing.bedrooms}</strong> {t('bedrooms')}
            </span>
          </div>
        )}
        {listing.bathrooms !== null && (
          <div className="flex items-center gap-2">
            <Bath className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg">
              <strong>{listing.bathrooms}</strong> {t('bathrooms')}
            </span>
          </div>
        )}
        {listing.area_sqm !== null && (
          <div className="flex items-center gap-2">
            <Maximize className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg">
              <strong>{listing.area_sqm}</strong> m{'²'}
            </span>
          </div>
        )}
        {listing.parking_spaces !== null && (
          <div className="flex items-center gap-2">
            <Car className="h-5 w-5 text-muted-foreground" />
            <span className="text-lg">
              <strong>{listing.parking_spaces}</strong> {t('parking')}
            </span>
          </div>
        )}
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">{t('summary')}</h2>
        <p className="text-muted-foreground leading-relaxed">{summary}</p>
      </div>

      {(displayStyle ||
        listing.condition ||
        listing.furnished !== null ||
        listing.total_area_sqm ||
        listing.reference_code) && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">{t('propertyDetails')}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {displayStyle && (
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('style')}</span>
                <span className="font-medium">{displayStyle}</span>
              </div>
            )}
            {listing.condition && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('condition')}</span>
                <span className="font-medium">
                  {formatCondition(listing.condition, locale)}
                </span>
              </div>
            )}
            {listing.furnished !== null && (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('furnished')}</span>
                <span className="font-medium">{listing.furnished ? t('yes') : t('no')}</span>
              </div>
            )}
            {listing.total_area_sqm && (
              <div className="flex items-center gap-2">
                <Maximize className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('totalArea')}</span>
                <span className="font-medium">
                  {listing.total_area_sqm} m{'²'}
                </span>
              </div>
            )}
            {listing.reference_code && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">{t('reference')}</span>
                <span className="font-medium">{listing.reference_code}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {listing.amenities && listing.amenities.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">{t('amenities')}</h2>
          <div className="flex flex-wrap gap-2">
            {listing.amenities.map((amenity) => (
              <Badge key={amenity} variant="outline">
                {formatAmenity(amenity, locale)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="bg-primary-50 rounded-xl p-6">
        {!unavailable && (
          <>
            <p className="text-muted-foreground text-sm mb-4">
              {t('linkOutNote', { source: sourceName })}
            </p>
            <a
              href={listing.source_url}
              target="_blank"
              rel="nofollow noopener noreferrer"
              className="inline-flex items-center justify-center w-full sm:w-auto px-6 py-3 bg-primary text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
            >
              {t('viewOriginalOn', { source: sourceName })}
              <ExternalLink className="ml-2 h-4 w-4" aria-hidden="true" />
              <span className="sr-only"> {t('opensInNewTab')}</span>
            </a>
          </>
        )}
        <p className={`text-sm text-muted-foreground ${unavailable ? '' : 'mt-4'}`}>
          {t('sourceLine', { source: sourceName })}
          {lastSeen && (
            <>
              {' · '}
              {t('lastSeenLine', { date: lastSeen })}
            </>
          )}
        </p>
      </div>
    </div>
  );
}
