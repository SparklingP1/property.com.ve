import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BarChart3, Home, TrendingUp } from 'lucide-react';
import { CityComparisonTable } from '@/components/market-data/city-comparison-table';
import { DatasetSchema } from '@/components/market-data/dataset-schema';
import { MethodologyNote } from '@/components/market-data/methodology-note';
import { PropertyTypeBreakdown } from '@/components/market-data/property-type-breakdown';
import { StatCard } from '@/components/market-data/stat-card';
import { Link } from '@/i18n/navigation';
import {
  formatMarketCount,
  getLocalizedPath,
  getMarketDataHubPath,
  getMarketDataMethodologyPath,
  getMarketDataYear,
} from '@/lib/market-data';
import {
  getCityComparison,
  getLatestPeriod,
  getMarketOverview,
} from '@/lib/supabase/market-data-queries';

export const revalidate = 86400;

interface Props {
  params: Promise<{ locale: string }>;
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
  const { locale } = await params;
  const isEs = locale === 'es';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  const periodStart = await getLatestPeriod();
  const year = getMarketDataYear(periodStart);

  const esUrl = `${baseUrl}${getMarketDataHubPath('es')}`;
  const enUrl = `${baseUrl}${getLocalizedPath(getMarketDataHubPath('en'), 'en')}`;

  return {
    title: isEs
      ? `Precios de Casas en Venezuela ${year} | Índice de Precios por Ciudad | Property.com.ve`
      : `Property Prices in Venezuela ${year} | Price Index by City | Property.com.ve`,
    description: isEs
      ? 'Índice de precios de inmuebles en Venezuela. Precios medianos por m², comparación por ciudad, apartamentos y casas. Datos actualizados mensualmente.'
      : 'Venezuela property price index. Median prices per sqm, city comparison, apartments and houses. Updated monthly with data from 11,000+ listings.',
    alternates: {
      canonical: isEs ? esUrl : enUrl,
      languages: {
        es: esUrl,
        en: enUrl,
      },
    },
    openGraph: {
      title: isEs
        ? `Precios de Casas en Venezuela ${year}`
        : `Property Prices in Venezuela ${year}`,
      description: isEs
        ? 'Índice de precios de inmuebles con datos de más de 11.000 propiedades activas.'
        : 'Property price index with data from 11,000+ active listings.',
      type: 'website',
      locale: isEs ? 'es_VE' : 'en_US',
      siteName: 'Property.com.ve',
    },
  };
}

export default async function MarketDataHub({ params }: Props) {
  const { locale } = await params;
  const isEs = locale === 'es';
  const t = await getTranslations({ locale, namespace: 'marketData' });
  const copy = {
    byPropertyType: isEs
      ? 'Por Tipo de Inmueble Residencial'
      : 'By Residential Property Type',
    medianPricePerSqm: isEs ? 'Precio mediano por m²' : t('medianPricePerSqm'),
    subtitle: isEs
      ? `Índice de precios basado en ${'{count}'} inmuebles activos`
      : t('subtitle', { count: '{count}' }),
  };

  const periodStart = await getLatestPeriod();
  if (!periodStart) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50">
        <p className="text-stone-500">
          {isEs ? 'Datos de mercado no disponibles aún.' : 'Market data not yet available.'}
        </p>
      </div>
    );
  }

  const [overview, cities] = await Promise.all([
    getMarketOverview(periodStart),
    getCityComparison(periodStart),
  ]);

  const national = overview.find(
    (stat) => stat.property_type === '' && stat.bedrooms_bucket === ''
  );
  const methodologyUrl = getMarketDataMethodologyPath(locale);
  const hubUrl = getMarketDataHubPath(locale);
  const listingCountText = national
    ? formatMarketCount(national.listing_count, locale)
    : isEs
      ? '11.000+'
      : '11,000+';

  return (
    <div className="min-h-screen bg-stone-50">
      <DatasetSchema
        name={
          isEs
            ? 'Índice de Precios de Inmuebles en Venezuela'
            : 'Venezuela Property Price Index'
        }
        description={
          isEs
            ? `Precios medianos de inmuebles en Venezuela basados en ${listingCountText} propiedades activas.`
            : `Median property prices in Venezuela based on ${listingCountText} active listings.`
        }
        url={`https://property.com.ve${getLocalizedPath(hubUrl, locale)}`}
        spatialCoverage="Venezuela"
        temporalCoverage={`${periodStart}/..`}
        listingCount={national?.listing_count || 0}
      />

      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 py-16 text-stone-50">
        <div className="container">
          <div className="mb-4 flex items-center gap-2 text-sm text-stone-400">
            <Link href="/" className="hover:text-stone-200">
              {t('breadcrumbHome')}
            </Link>
            <span>/</span>
            <span className="text-stone-200">{t('breadcrumbPrices')}</span>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">
            {t('title')}
          </h1>
          <p className="mb-2 max-w-3xl text-lg text-stone-300">
            {copy.subtitle.replace('{count}', listingCountText)}
          </p>
          <p className="text-sm font-medium text-amber-400">
            {t('updated', { date: formatDate(periodStart, locale) })}
          </p>
        </div>
      </div>

      <div className="container space-y-12 py-12">
        {national && (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <StatCard
              label={copy.medianPricePerSqm}
              value={
                national.median_price_per_sqm
                  ? `${formatPrice(national.median_price_per_sqm)}/m²`
                  : '—'
              }
              changePct={national.price_change_pct}
              icon={<BarChart3 className="h-6 w-6 text-amber-600" />}
            />
            <StatCard
              label={t('medianPrice')}
              value={national.median_price ? formatPrice(national.median_price) : '—'}
              icon={<Home className="h-6 w-6 text-amber-600" />}
            />
            <StatCard
              label={t('listingsTracked')}
              value={formatMarketCount(national.listing_count, locale)}
              icon={<TrendingUp className="h-6 w-6 text-amber-600" />}
            />
          </div>
        )}

        {cities.length > 0 && (
          <section>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-stone-900">
                  {t('cityComparison')}
                </h2>
                <p className="mt-1 text-stone-600">
                  {isEs
                    ? 'Compara rápidamente las ciudades con mejor cobertura de mercado.'
                    : 'Quickly compare the cities with the deepest market coverage.'}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
              <CityComparisonTable cities={cities} locale={locale} />
            </div>
          </section>
        )}

        <section>
          <h2 className="mb-6 text-2xl font-bold text-stone-900">
            {copy.byPropertyType}
          </h2>
          <p className="mb-6 max-w-3xl text-stone-600">
            {isEs
              ? 'Este desglose público se centra en apartamentos y casas para mantener una comparación residencial consistente.'
              : 'This public breakdown focuses on apartments and houses to keep the residential comparison consistent.'}
          </p>
          <PropertyTypeBreakdown stats={overview} locale={locale} />
        </section>

        <MethodologyNote
          listingCount={national?.listing_count || 0}
          locale={locale}
          methodologyUrl={methodologyUrl}
        />

        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold text-stone-900">
                {isEs ? 'Explorar el mercado completo' : 'Explore the full market'}
              </h2>
              <p className="mt-1 text-stone-600">
                {isEs
                  ? 'Usa el índice como punto de partida y luego revisa los listados activos.'
                  : 'Use the index as a starting point, then jump into active listings.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href={hubUrl}
                className="inline-flex items-center rounded-xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-400 hover:bg-white"
              >
                {isEs ? 'Actualizar vista' : 'Refresh overview'}
              </Link>
              <Link
                href={methodologyUrl}
                className="inline-flex items-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-amber-700"
              >
                {isEs ? 'Ver metodología' : 'View methodology'}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
