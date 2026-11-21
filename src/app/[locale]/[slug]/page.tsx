import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getLocationListings, getLocationStats, getSeoPageContent } from '@/lib/supabase/listing-queries';
import { ListingGrid } from '@/components/listings/listing-grid';
import CityMarketDataPage, {
  generateMetadata as generateCityMarketMetadata,
} from '../precios-de-casas-en-venezuela/[city]/page';
import { parseMarketDataCitySlug } from '@/lib/market-data';
import { parseSEOUrl, getPageTitleForLocale, getMetaDescriptionForLocale } from '@/lib/seo-url-parser';
import { Link } from '@/i18n/navigation';
import { MapPin, Home, TrendingUp, Bed, Search } from 'lucide-react';

interface SEOPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: SEOPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const marketDataCitySlug = parseMarketDataCitySlug(slug, locale);

  if (marketDataCitySlug) {
    return generateCityMarketMetadata({
      params: Promise.resolve({ locale, city: marketDataCitySlug }),
    });
  }

  // Parse URL to extract filters
  const parsed = parseSEOUrl(slug);

  if (!parsed.isValid) {
    return {
      title: 'Page Not Found',
    };
  }

  // Pre-generated SEO content (English or Spanish slug), cached
  const seoContent = await getSeoPageContent(slug);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  // Use locale-specific slugs for canonical and hreflang
  const esSlug = seoContent?.page_slug_es || `/${slug}`;
  const enSlug = seoContent?.page_slug || `/${slug}`;
  const alternates = {
    canonical: locale === 'es' ? `${baseUrl}${esSlug}` : `${baseUrl}/en${enSlug}`,
    languages: {
      es: `${baseUrl}${esSlug}`,
      en: `${baseUrl}/en${enSlug}`,
    },
  };

  if (seoContent) {
    // Exact live count for this page's filters (cached, shared with the page body)
    const { total: liveCount } = await getLocationStats({ ...parsed.filters, transaction_type: 'sale' });

    // Use locale-appropriate content, replacing stale counts with live count
    const rawTitle = (locale === 'es' && seoContent.meta_title_es) ? seoContent.meta_title_es : seoContent.meta_title;
    const titleNoSuffix = rawTitle?.replace(/ \| Property\.com\.ve$/i, '') || rawTitle;
    // Replace stale number in title (e.g., "252 Listings" → "3432 Listings")
    // ("24 Listados" also becomes "27 Inmuebles": "listados" is not the word searchers use.)
    const metaTitle = liveCount
      ? titleNoSuffix?.replace(/\d[\d,.]*\s*(Listings|Listados|Inmuebles|Available|Disponibles)/i,
          (_match: string, word: string) =>
            `${liveCount.toLocaleString(locale === 'es' ? 'es-VE' : 'en-US')} ${/^listados$/i.test(word) ? 'Inmuebles' : word}`)
      : titleNoSuffix;
    const metaDesc = (locale === 'es' && seoContent.meta_description_es) ? seoContent.meta_description_es : seoContent.meta_description;
    return {
      title: metaTitle,
      description: metaDesc,
      keywords: ((locale === 'es' && seoContent.keywords_es) ? seoContent.keywords_es : seoContent.keywords)?.join(', '),
      alternates,
      openGraph: {
        title: metaTitle,
        description: metaDesc,
        type: 'website',
        siteName: 'Property.com.ve',
      },
    };
  }

  // Fallback metadata if no pre-generated content
  const title = `${getPageTitleForLocale(parsed.filters, locale)} | Property.com.ve`;
  const description = getMetaDescriptionForLocale(parsed.filters, 0, locale);

  return {
    title,
    description,
    alternates,
    openGraph: {
      title: getPageTitleForLocale(parsed.filters, locale),
      description,
      type: 'website',
      siteName: 'Property.com.ve',
    },
  };
}

export default async function SEOPage({ params }: SEOPageProps) {
  const { locale, slug } = await params;
  const marketDataCitySlug = parseMarketDataCitySlug(slug, locale);

  if (marketDataCitySlug) {
    return CityMarketDataPage({
      params: Promise.resolve({ locale, city: marketDataCitySlug }),
    });
  }

  const t = await getTranslations('seoPage');
  const tAgg = await getTranslations('aggregate');
  const tListing = await getTranslations('listing');
  const tNav = await getTranslations('nav');

  // Parse URL to extract filters (handles both English and Spanish slugs)
  const parsed = parseSEOUrl(slug);

  if (!parsed.isValid) {
    notFound();
  }

  const { filters } = parsed;

  // Pre-generated SEO content (English or Spanish slug), cached
  const seoContent = await getSeoPageContent(slug);

  // If no SEO content exists, this page shouldn't exist
  if (!seoContent) {
    notFound();
  }

  // Cached, lean stats (exact count, median USD price, facets) plus a capped
  // card-columns grid. Inactive listings are excluded (active = true).
  const locationFilters = { ...filters, transaction_type: 'sale' as const };
  const [stats, listings] = await Promise.all([
    getLocationStats(locationFilters),
    getLocationListings(locationFilters, 100),
  ]);

  const totalListings = stats.total ?? listings.length;
  const medianPrice = stats.medianPrice ?? 0;
  const propertyTypes = stats.propertyTypes;
  const bedroomOptions = stats.bedroomOptions;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const location = filters.city || filters.state || 'Venezuela';
  const propertyType = filters.property_type || 'properties';

  const propertyTypeLabels: Record<string, string> = {
    apartment: tListing('apartment'),
    house: tListing('house'),
    land: tListing('land'),
    commercial: tListing('commercial'),
    office: tListing('office'),
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-stone-50 py-16">
        <div className="container">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-stone-400 text-sm mb-4">
            <Link href="/" className="hover:text-stone-200">
              {tNav('home')}
            </Link>
            <span>/</span>
            {filters.state && !filters.city && (
              <span className="text-stone-200">{filters.state}</span>
            )}
            {filters.city && (
              <>
                {filters.state && (
                  <>
                    <Link href={`/search?state=${encodeURIComponent(filters.state)}`} className="hover:text-stone-200">
                      {filters.state}
                    </Link>
                    <span>/</span>
                  </>
                )}
                <span className="text-stone-200">{filters.city}</span>
              </>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            {(locale === 'es' && seoContent.h1_es) ? seoContent.h1_es : seoContent.h1}
          </h1>

          {/* SEO Description — replace stale listing count with live count */}
          <p className="text-stone-300 text-lg max-w-3xl leading-relaxed">
            {(() => {
              const raw = (locale === 'es' && seoContent.description_es) ? seoContent.description_es : seoContent.description;
              return totalListings > 0
                ? raw.replace(/\b\d{1,5}\s*(listings|listados|apartamentos disponibles|casas disponibles|terrenos disponibles|inmuebles|properties available|apartments|houses|homes)\b/i,
                    `${totalListings.toLocaleString()} $1`)
                : raw;
            })()}
          </p>

          {totalListings > 0 && (
            <p className="text-stone-400 text-sm mt-4">{totalListings} {t('propertiesAvailable')}</p>
          )}
        </div>
      </div>

      <div className="container py-12">
        {/* Zero Listings State */}
        {totalListings === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-12 text-center max-w-2xl mx-auto">
            <Search className="h-16 w-16 text-stone-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-stone-900 mb-4">
              {t('noPropertiesAvailable')}
            </h2>
            <p className="text-stone-600 mb-8 leading-relaxed">
              {t('noPropertiesDescription', {
                description: `${filters.bedrooms ? `${filters.bedrooms}-bedroom ` : ''}${propertyType} in ${location}`,
              })}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/search"
                className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                {t('browseAllProperties')}
              </Link>
              {filters.city && (
                <Link
                  href={`/search?city=${encodeURIComponent(filters.city)}`}
                  className="inline-block px-8 py-3 bg-stone-100 text-stone-900 rounded-lg font-medium hover:bg-stone-200 transition-colors"
                >
                  {t('viewAllIn', { location: filters.city })}
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Listings Exist - Show Stats and Grid */}
        {totalListings > 0 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Home className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold text-stone-900">{t('totalProperties')}</h3>
                </div>
                <p className="text-3xl font-bold text-primary">{totalListings}</p>
                <p className="text-sm text-stone-600 mt-1">{tAgg('activeListings')}</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold text-stone-900">{tAgg('medianPrice')}</h3>
                </div>
                <p className="text-3xl font-bold text-primary">
                  {medianPrice > 0 ? formatPrice(medianPrice) : tAgg('priceVaries')}
                </p>
                <p className="text-sm text-stone-600 mt-1">{tAgg('medianPriceNote')}</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <MapPin className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold text-stone-900">{t('location')}</h3>
                </div>
                <p className="text-2xl font-bold text-primary">{location}</p>
                <p className="text-sm text-stone-600 mt-1">
                  {filters.bedrooms ? `${filters.bedrooms} ${Number(filters.bedrooms) > 1 ? tAgg('bedrooms') : tAgg('bedroom')} ` : ''}
                  {propertyTypeLabels[propertyType] || propertyType}
                </p>
              </div>
            </div>

            {/* Related Searches - Property Types (if no type filter) */}
            {!filters.property_type && Object.keys(propertyTypes).length > 1 && (
              <section className="mb-12">
                <h2 className="text-2xl font-bold mb-6 text-stone-900">{tAgg('browseByPropertyType')}</h2>
                <div className="flex flex-wrap gap-3">
                  {(Object.entries(propertyTypes) as [string, number][])
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <Link
                        key={type}
                        href={`/search?${filters.city ? `city=${encodeURIComponent(filters.city)}` : `state=${encodeURIComponent(filters.state || '')}`}&type=${type}`}
                        className="bg-white rounded-lg shadow-sm border border-stone-200 px-6 py-4 hover:shadow-md hover:border-primary transition-all"
                      >
                        <p className="font-semibold text-stone-900 capitalize text-lg">{type}</p>
                        <p className="text-sm text-stone-600">{count} {tAgg('listings')}</p>
                      </Link>
                    ))}
                </div>
              </section>
            )}

            {/* Related Searches - Bedrooms (if no bedroom filter and property type is apartment/house) */}
            {!filters.bedrooms &&
              (filters.property_type === 'apartment' || filters.property_type === 'house') &&
              bedroomOptions.length > 0 && (
                <section className="mb-12">
                  <h2 className="text-2xl font-bold mb-6 text-stone-900">
                    {tAgg('browseByBedrooms')}
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {bedroomOptions.map((bedrooms) => (
                      <Link
                        key={bedrooms}
                        href={`/search?${filters.city ? `city=${encodeURIComponent(filters.city)}` : `state=${encodeURIComponent(filters.state || '')}`}&type=${filters.property_type}&bedrooms=${bedrooms}`}
                        className="bg-white rounded-lg shadow-sm border border-stone-200 px-6 py-3 hover:shadow-md hover:border-primary transition-all flex items-center gap-2"
                      >
                        <Bed className="h-5 w-5 text-primary" />
                        <span className="font-medium text-stone-900">
                          {bedrooms} {bedrooms > 1 ? tAgg('bedrooms') : tAgg('bedroom')}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

            {/* Listings Grid */}
            <section>
              <h2 className="text-2xl font-bold mb-6 text-stone-900">
                {filters.bedrooms && `${filters.bedrooms} ${Number(filters.bedrooms) > 1 ? tAgg('bedrooms') : tAgg('bedroom')} `}
                {filters.property_type
                  ? propertyTypeLabels[filters.property_type] || filters.property_type.charAt(0).toUpperCase() + filters.property_type.slice(1)
                  : t('propertiesLabel')}{' '}
                {t('inLocation', { location })}
              </h2>
              <ListingGrid listings={listings} />

              {totalListings >= 100 && (
                <div className="text-center mt-8">
                  <Link
                    href={`/search?${filters.city ? `city=${encodeURIComponent(filters.city)}` : `state=${encodeURIComponent(filters.state || '')}`}${filters.property_type ? `&type=${filters.property_type}` : ''}${filters.bedrooms ? `&bedrooms=${filters.bedrooms}` : ''}`}
                    className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                  >
                    {t('viewAllResults')}
                  </Link>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
