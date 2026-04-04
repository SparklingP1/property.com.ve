import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import Image from 'next/image';
import { BarChart3, Home, TrendingUp, ExternalLink } from 'lucide-react';
import {
  getLatestPeriod,
  getCityStats,
  getCityComparison,
  getValidCities,
  getSampleListings,
} from '@/lib/supabase/market-data-queries';
import { StatCard } from '@/components/market-data/stat-card';
import { PropertyTypeBreakdown } from '@/components/market-data/property-type-breakdown';
import { BedroomBreakdown } from '@/components/market-data/bedroom-breakdown';
import { MethodologyNote } from '@/components/market-data/methodology-note';
import { DatasetSchema } from '@/components/market-data/dataset-schema';

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string; city: string }>;
}

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(locale === 'es' ? 'es-VE' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, city: citySlug } = await params;
  const isEs = locale === 'es';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  const validCities = await getValidCities();
  const match = validCities.find(c => slugify(c.city) === citySlug);
  if (!match) return { title: 'Not Found' };

  const cityName = match.city;
  const esPath = `/precios-de-casas-en-${citySlug}`;
  const enPath = `/en/property-prices-in-${citySlug}`;

  return {
    title: isEs
      ? `Precios de Casas en ${cityName} 2026 — Índice de Precios | Property.com.ve`
      : `Property Prices in ${cityName} 2026 — Price Index | Property.com.ve`,
    description: isEs
      ? `Precios de inmuebles en ${cityName}, Venezuela. Precios medianos por m² para apartamentos y casas, desglose por habitaciones. Actualizado mensualmente.`
      : `Property prices in ${cityName}, Venezuela. Median prices per sqm for apartments and houses, bedroom breakdown. Updated monthly.`,
    alternates: {
      canonical: isEs ? `${baseUrl}${esPath}` : `${baseUrl}${enPath}`,
      languages: {
        es: `${baseUrl}${esPath}`,
        en: `${baseUrl}${enPath}`,
      },
    },
    openGraph: {
      title: isEs ? `Precios de Casas en ${cityName} 2026` : `Property Prices in ${cityName} 2026`,
      type: 'website',
      locale: isEs ? 'es_VE' : 'en_US',
      siteName: 'Property.com.ve',
    },
  };
}

export async function generateStaticParams() {
  const cities = await getValidCities();
  return cities.map(c => ({ city: slugify(c.city) }));
}

export default async function CityMarketData({ params }: Props) {
  const { locale, city: citySlug } = await params;
  const t = await getTranslations({ locale, namespace: 'marketData' });
  const isEs = locale === 'es';

  const periodStart = await getLatestPeriod();
  if (!periodStart) return notFound();

  const validCities = await getValidCities();
  const match = validCities.find(c => slugify(c.city) === citySlug);
  if (!match) return notFound();

  const cityName = match.city;
  const [cityStats, allCities, sampleListings] = await Promise.all([
    getCityStats(cityName, periodStart),
    getCityComparison(periodStart),
    getSampleListings(cityName, 6),
  ]);

  // Main city stat (all types, all bedrooms)
  const cityTotal = cityStats.find(s => s.property_type === '' && s.bedrooms_bucket === '');
  if (!cityTotal) return notFound();

  const methodologyUrl = isEs ? '/precios-de-casas-en-venezuela/metodologia/' : '/en/property-prices-in-venezuela/methodology/';
  const hubUrl = isEs ? '/precios-de-casas-en-venezuela/' : '/en/property-prices-in-venezuela/';
  const searchUrl = isEs ? `/buscar?city=${encodeURIComponent(cityName)}` : `/en/search?city=${encodeURIComponent(cityName)}`;

  // Find top 3 comparison cities (different from current)
  const compareCities = allCities
    .filter(c => c.city !== cityName && c.median_price_per_sqm)
    .slice(0, 3);

  return (
    <div className="min-h-screen bg-stone-50">
      <DatasetSchema
        name={isEs ? `Precios de Inmuebles en ${cityName}` : `Property Prices in ${cityName}`}
        description={isEs
          ? `Precios medianos de inmuebles en ${cityName}, Venezuela.`
          : `Median property prices in ${cityName}, Venezuela.`}
        url={`https://property.com.ve/precios-de-casas-en-${citySlug}`}
        spatialCoverage={`${cityName}, Venezuela`}
        temporalCoverage={`${periodStart}/..`}
        listingCount={cityTotal.listing_count}
      />

      {/* Hero */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-stone-50 py-16">
        <div className="container">
          <div className="flex items-center gap-2 text-stone-400 text-sm mb-4">
            <a href={isEs ? '/' : '/en'} className="hover:text-stone-200">{t('breadcrumbHome')}</a>
            <span>/</span>
            <a href={hubUrl} className="hover:text-stone-200">{t('breadcrumbPrices')}</a>
            <span>/</span>
            <span className="text-stone-200">{cityName}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            {t('titleCity', { city: cityName })}
          </h1>
          <p className="text-stone-300 text-lg max-w-3xl mb-2">
            {t('subtitle', { count: cityTotal.listing_count.toLocaleString() })}
          </p>
          <p className="text-amber-400 text-sm font-medium">
            {t('updated', { date: formatDate(periodStart, locale) })}
          </p>
        </div>
      </div>

      <div className="container py-12 space-y-12">
        {/* Key stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard
            label={t('medianPricePerSqm')}
            value={cityTotal.median_price_per_sqm ? `${formatPrice(cityTotal.median_price_per_sqm)}/m²` : '—'}
            changePct={cityTotal.price_change_pct}
            icon={<BarChart3 className="h-6 w-6 text-amber-600" />}
          />
          <StatCard
            label={t('medianPrice')}
            value={cityTotal.median_price ? formatPrice(cityTotal.median_price) : '—'}
            icon={<Home className="h-6 w-6 text-amber-600" />}
          />
          <StatCard
            label={t('listingsTracked')}
            value={cityTotal.listing_count.toLocaleString()}
            icon={<TrendingUp className="h-6 w-6 text-amber-600" />}
          />
        </div>

        {/* Property type breakdown */}
        <section>
          <h2 className="text-2xl font-bold text-stone-900 mb-6">{t('byPropertyType')}</h2>
          <PropertyTypeBreakdown stats={cityStats} locale={locale} />
        </section>

        {/* Bedroom breakdown */}
        <section>
          <h2 className="text-2xl font-bold text-stone-900 mb-6">{t('byBedrooms')}</h2>
          <BedroomBreakdown stats={cityStats} locale={locale} />
        </section>

        {/* City comparison */}
        {compareCities.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-stone-900 mb-6">{t('compareCity', { city: cityName })}</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {compareCities.map(c => (
                <a
                  key={c.city}
                  href={`${isEs ? '/precios-de-casas-en-' : '/en/property-prices-in-'}${slugify(c.city)}/`}
                  className="bg-white rounded-xl shadow-sm border border-stone-200 p-5 hover:shadow-md hover:border-amber-300 transition-all"
                >
                  <p className="font-bold text-stone-900">{c.city}</p>
                  <p className="text-2xl font-bold text-amber-700 mt-1">
                    {c.median_price_per_sqm ? `${formatPrice(c.median_price_per_sqm)}/m²` : '—'}
                  </p>
                  <p className="text-sm text-stone-500 mt-1">
                    {c.listing_count.toLocaleString()} {isEs ? 'inmuebles' : 'listings'}
                  </p>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Sample listings */}
        {sampleListings.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-stone-900 mb-6">{t('sampleListings', { city: cityName })}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sampleListings.map(listing => {
                const slug = isEs ? listing.url_slug_es : listing.url_slug;
                const title = (isEs ? listing.title : listing.title_en) || listing.title;
                return (
                  <a
                    key={listing.id}
                    href={`${isEs ? '' : '/en'}/listing/${slug || listing.id}`}
                    className="bg-white rounded-xl shadow-sm border border-stone-200 overflow-hidden hover:shadow-md transition-all group"
                  >
                    {listing.thumbnail_url && (
                      <div className="aspect-[4/3] relative overflow-hidden bg-stone-100">
                        <Image
                          src={listing.thumbnail_url}
                          alt={title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      </div>
                    )}
                    <div className="p-4">
                      <p className="font-bold text-lg text-amber-700">
                        {listing.price ? formatPrice(listing.price) : '—'}
                      </p>
                      <p className="text-sm text-stone-600 mt-1 line-clamp-2">{title}</p>
                      <div className="flex gap-3 text-xs text-stone-500 mt-2">
                        {listing.bedrooms && <span>{listing.bedrooms} {isEs ? 'hab.' : 'bed'}</span>}
                        {listing.bathrooms && <span>{listing.bathrooms} {isEs ? 'baño' : 'bath'}</span>}
                        {listing.area_sqm && <span>{listing.area_sqm}m²</span>}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
            <div className="mt-6 text-center">
              <a
                href={searchUrl}
                className="inline-flex items-center gap-2 bg-amber-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-amber-700 transition-colors"
              >
                {t('viewListings', { city: cityName })}
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </section>
        )}

        {/* Methodology */}
        <MethodologyNote
          listingCount={cityTotal.listing_count}
          locale={locale}
          methodologyUrl={methodologyUrl}
        />
      </div>
    </div>
  );
}
