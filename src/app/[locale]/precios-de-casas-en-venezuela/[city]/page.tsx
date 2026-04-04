import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { BarChart3, Home, TrendingUp } from 'lucide-react';
import { BedroomBreakdown } from '@/components/market-data/bedroom-breakdown';
import { DatasetSchema } from '@/components/market-data/dataset-schema';
import { MethodologyNote } from '@/components/market-data/methodology-note';
import { PropertyTypeBreakdown } from '@/components/market-data/property-type-breakdown';
import { StatCard } from '@/components/market-data/stat-card';
import { Link } from '@/i18n/navigation';
import {
  formatMarketCount,
  getLocalizedPath,
  getMarketDataCityPath,
  getMarketDataHubPath,
  getMarketDataMethodologyPath,
  getMarketDataYear,
  slugifyMarketCity,
} from '@/lib/market-data';
import {
  getCityComparison,
  getCityStats,
  getLatestPeriod,
  getValidCities,
} from '@/lib/supabase/market-data-queries';

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string; city: string }>;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr: string, locale: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString(locale === 'es' ? 'es-VE' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, city: citySlug } = await params;
  const isEs = locale === 'es';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  const [validCities, periodStart] = await Promise.all([
    getValidCities(),
    getLatestPeriod(),
  ]);
  const year = getMarketDataYear(periodStart);

  const match = validCities.find((city) => slugifyMarketCity(city.city) === citySlug);

  if (!match) {
    return { title: 'Not Found' };
  }

  const cityName = match.city;
  const esUrl = `${baseUrl}${getMarketDataCityPath(citySlug, 'es')}`;
  const enUrl = `${baseUrl}${getLocalizedPath(
    getMarketDataCityPath(citySlug, 'en'),
    'en'
  )}`;

  return {
    title: isEs
      ? `Precios de Casas en ${cityName} ${year} | \u00cdndice de Precios | Property.com.ve`
      : `Property Prices in ${cityName} ${year} | Price Index | Property.com.ve`,
    description: isEs
      ? `Precios de inmuebles en ${cityName}, Venezuela. Precios medianos por m\u00b2 para apartamentos y casas, con desglose por habitaciones. Actualizado mensualmente.`
      : `Property prices in ${cityName}, Venezuela. Median prices per sqm for apartments and houses, with bedroom-level breakdowns. Updated monthly.`,
    alternates: {
      canonical: isEs ? esUrl : enUrl,
      languages: {
        es: esUrl,
        en: enUrl,
      },
    },
    openGraph: {
      title: isEs
        ? `Precios de Casas en ${cityName} ${year}`
        : `Property Prices in ${cityName} ${year}`,
      type: 'website',
      locale: isEs ? 'es_VE' : 'en_US',
      siteName: 'Property.com.ve',
    },
  };
}

export async function generateStaticParams() {
  const cities = await getValidCities();
  return cities.map((city) => ({ city: slugifyMarketCity(city.city) }));
}

export default async function CityMarketData({ params }: Props) {
  const { locale, city: citySlug } = await params;
  const isEs = locale === 'es';
  const t = await getTranslations({ locale, namespace: 'marketData' });
  const copy = {
    byPropertyType: isEs
      ? 'Por Tipo de Inmueble Residencial'
      : 'By Residential Property Type',
    compareCity: isEs
      ? '\u00bfC\u00f3mo se compara {city}?'
      : t('compareCity', { city: '{city}' }),
    medianPricePerSqm: isEs ? 'Precio mediano por m\u00b2' : t('medianPricePerSqm'),
    subtitle: isEs
      ? `\u00cdndice de precios basado en ${'{count}'} inmuebles activos`
      : t('subtitle', { count: '{count}' }),
  };

  const [periodStart, validCities] = await Promise.all([
    getLatestPeriod(),
    getValidCities(),
  ]);

  if (!periodStart) {
    return notFound();
  }

  const match = validCities.find((city) => slugifyMarketCity(city.city) === citySlug);

  if (!match) {
    return notFound();
  }

  const cityName = match.city;
  const [cityStats, allCities] = await Promise.all([
    getCityStats(cityName, periodStart),
    getCityComparison(periodStart),
  ]);

  const cityTotal = cityStats.find(
    (stat) => stat.property_type === '' && stat.bedrooms_bucket === ''
  );

  if (!cityTotal) {
    return notFound();
  }

  const methodologyUrl = getMarketDataMethodologyPath(locale);
  const hubUrl = getMarketDataHubPath(locale);
  const compareCities = allCities
    .filter((city) => city.city !== cityName && city.median_price_per_sqm)
    .slice(0, 3);
  const cityListingCount = formatMarketCount(cityTotal.listing_count, locale);

  return (
    <div className="min-h-screen bg-stone-50">
      <DatasetSchema
        name={
          isEs ? `Precios de Inmuebles en ${cityName}` : `Property Prices in ${cityName}`
        }
        description={
          isEs
            ? `Precios medianos de inmuebles en ${cityName}, Venezuela.`
            : `Median property prices in ${cityName}, Venezuela.`
        }
        url={`https://property.com.ve${getLocalizedPath(
          getMarketDataCityPath(citySlug, locale),
          locale
        )}`}
        spatialCoverage={`${cityName}, Venezuela`}
        temporalCoverage={`${periodStart}/..`}
        listingCount={cityTotal.listing_count}
      />

      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 py-16 text-stone-50">
        <div className="container">
          <div className="mb-4 flex items-center gap-2 text-sm text-stone-400">
            <Link href="/" className="hover:text-stone-200">
              {t('breadcrumbHome')}
            </Link>
            <span>/</span>
            <Link href={hubUrl} className="hover:text-stone-200">
              {t('breadcrumbPrices')}
            </Link>
            <span>/</span>
            <span className="text-stone-200">{cityName}</span>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            {t('titleCity', { city: cityName })}
          </h1>
          <p className="mb-2 max-w-3xl text-lg text-stone-300">
            {copy.subtitle.replace('{count}', cityListingCount)}
          </p>
          <p className="text-sm font-medium text-amber-400">
            {t('updated', { date: formatDate(periodStart, locale) })}
          </p>
        </div>
      </div>

      <div className="container space-y-12 py-12">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <StatCard
            label={copy.medianPricePerSqm}
            value={
              cityTotal.median_price_per_sqm
                ? `${formatPrice(cityTotal.median_price_per_sqm)}/m\u00b2`
                : '\u2014'
            }
            changePct={cityTotal.price_change_pct}
            icon={<BarChart3 className="h-6 w-6 text-amber-600" />}
          />
          <StatCard
            label={t('medianPrice')}
            value={cityTotal.median_price ? formatPrice(cityTotal.median_price) : '\u2014'}
            icon={<Home className="h-6 w-6 text-amber-600" />}
          />
          <StatCard
            label={t('listingsTracked')}
            value={cityListingCount}
            icon={<TrendingUp className="h-6 w-6 text-amber-600" />}
          />
        </div>

        <section>
          <h2 className="mb-6 text-2xl font-bold text-stone-900">
            {copy.byPropertyType}
          </h2>
          <p className="mb-6 max-w-3xl text-stone-600">
            {isEs
              ? 'El desglose p\u00fablico se centra en apartamentos y casas para mantener una comparaci\u00f3n residencial consistente.'
              : 'This public breakdown focuses on apartments and houses to keep the residential comparison consistent.'}
          </p>
          <PropertyTypeBreakdown stats={cityStats} locale={locale} />
        </section>

        <section>
          <h2 className="mb-6 text-2xl font-bold text-stone-900">
            {t('byBedrooms')}
          </h2>
          <BedroomBreakdown stats={cityStats} locale={locale} />
        </section>

        {compareCities.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">
                  {copy.compareCity.replace('{city}', cityName)}
                </h2>
                <p className="mt-1 text-stone-600">
                  {isEs
                    ? 'Usa estas ciudades como referencia r\u00e1pida antes de abrir otras p\u00e1ginas de estad\u00edsticas.'
                    : 'Use these cities as quick reference points before opening other city statistics pages.'}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {compareCities.map((city) => (
                <Link
                  key={city.city}
                  href={getMarketDataCityPath(slugifyMarketCity(city.city), locale)}
                  className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-amber-300 hover:shadow-md"
                >
                  <p className="font-bold text-stone-900">{city.city}</p>
                  <p className="mt-1 text-2xl font-bold text-amber-700">
                    {city.median_price_per_sqm
                      ? `${formatPrice(city.median_price_per_sqm)}/m\u00b2`
                      : '\u2014'}
                  </p>
                  <p className="mt-1 text-sm text-stone-500">
                    {formatMarketCount(city.listing_count, locale)}{' '}
                    {isEs ? 'inmuebles' : 'listings'}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <MethodologyNote
          listingCount={cityTotal.listing_count}
          locale={locale}
          methodologyUrl={methodologyUrl}
        />
      </div>
    </div>
  );
}
