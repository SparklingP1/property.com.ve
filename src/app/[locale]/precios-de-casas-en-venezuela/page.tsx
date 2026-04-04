import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BarChart3, Home, TrendingUp } from 'lucide-react';
import { getLatestPeriod, getMarketOverview, getCityComparison } from '@/lib/supabase/market-data-queries';
import { StatCard } from '@/components/market-data/stat-card';
import { CityComparisonTable } from '@/components/market-data/city-comparison-table';
import { PropertyTypeBreakdown } from '@/components/market-data/property-type-breakdown';
import { MethodologyNote } from '@/components/market-data/methodology-note';
import { DatasetSchema } from '@/components/market-data/dataset-schema';

export const revalidate = 86400; // 24 hours

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
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString(locale === 'es' ? 'es-VE' : 'en-US', {
    month: 'long',
    year: 'numeric',
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  const isEs = locale === 'es';

  const esPath = '/precios-de-casas-en-venezuela';
  const enPath = '/en/property-prices-in-venezuela';

  return {
    title: isEs
      ? 'Precios de Casas en Venezuela 2026 — Índice de Precios por Ciudad | Property.com.ve'
      : 'Property Prices in Venezuela 2026 — Price Index by City | Property.com.ve',
    description: isEs
      ? 'Índice de precios de inmuebles en Venezuela. Precios medianos por m², comparación por ciudad, apartamentos y casas. Datos actualizados mensualmente.'
      : 'Venezuela property price index. Median prices per sqm, city comparison, apartments and houses. Updated monthly with data from 11,000+ listings.',
    alternates: {
      canonical: isEs ? `${baseUrl}${esPath}` : `${baseUrl}${enPath}`,
      languages: {
        es: `${baseUrl}${esPath}`,
        en: `${baseUrl}${enPath}`,
      },
    },
    openGraph: {
      title: isEs ? 'Precios de Casas en Venezuela 2026' : 'Property Prices in Venezuela 2026',
      description: isEs
        ? 'Índice de precios de inmuebles con datos de más de 11,000 propiedades activas.'
        : 'Property price index with data from 11,000+ active listings.',
      type: 'website',
      locale: isEs ? 'es_VE' : 'en_US',
      siteName: 'Property.com.ve',
    },
  };
}

export default async function MarketDataHub({ params }: Props) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'marketData' });
  const isEs = locale === 'es';

  const periodStart = await getLatestPeriod();
  if (!periodStart) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <p className="text-stone-500">{isEs ? 'Datos de mercado no disponibles aún.' : 'Market data not yet available.'}</p>
      </div>
    );
  }

  const [overview, cities] = await Promise.all([
    getMarketOverview(periodStart),
    getCityComparison(periodStart),
  ]);

  // National totals (all types, all bedrooms)
  const national = overview.find(s => s.property_type === '' && s.bedrooms_bucket === '');
  const methodologyUrl = isEs ? '/precios-de-casas-en-venezuela/metodologia/' : '/en/property-prices-in-venezuela/methodology/';
  const cityUrlPrefix = isEs ? '/precios-de-casas-en-' : '/en/property-prices-in-';

  return (
    <div className="min-h-screen bg-stone-50">
      <DatasetSchema
        name={isEs ? 'Índice de Precios de Inmuebles en Venezuela' : 'Venezuela Property Price Index'}
        description={isEs
          ? `Precios medianos de inmuebles en Venezuela basados en ${national?.listing_count?.toLocaleString() || '11,000+'} propiedades activas.`
          : `Median property prices in Venezuela based on ${national?.listing_count?.toLocaleString() || '11,000+'} active listings.`}
        url="https://property.com.ve/precios-de-casas-en-venezuela"
        spatialCoverage="Venezuela"
        temporalCoverage={`${periodStart}/..`}
        listingCount={national?.listing_count || 0}
      />

      {/* Hero */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-stone-50 py-16">
        <div className="container">
          <div className="flex items-center gap-2 text-stone-400 text-sm mb-4">
            <a href={isEs ? '/' : '/en'} className="hover:text-stone-200">{t('breadcrumbHome')}</a>
            <span>/</span>
            <span className="text-stone-200">{t('breadcrumbPrices')}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            {t('title')}
          </h1>
          <p className="text-stone-300 text-lg max-w-3xl mb-2">
            {t('subtitle', { count: national?.listing_count?.toLocaleString() || '11,000+' })}
          </p>
          <p className="text-amber-400 text-sm font-medium">
            {t('updated', { date: formatDate(periodStart, locale) })}
          </p>
        </div>
      </div>

      <div className="container py-12 space-y-12">
        {/* Key stats */}
        {national && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard
              label={t('medianPricePerSqm')}
              value={national.median_price_per_sqm ? `${formatPrice(national.median_price_per_sqm)}/m²` : '—'}
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
              value={national.listing_count.toLocaleString()}
              icon={<TrendingUp className="h-6 w-6 text-amber-600" />}
            />
          </div>
        )}

        {/* City comparison table */}
        {cities.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-stone-900 mb-6">{t('cityComparison')}</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-stone-200 overflow-hidden">
              <CityComparisonTable cities={cities} locale={locale} cityUrlPrefix={cityUrlPrefix} />
            </div>
          </section>
        )}

        {/* Property type breakdown */}
        <section>
          <h2 className="text-2xl font-bold text-stone-900 mb-6">{t('byPropertyType')}</h2>
          <PropertyTypeBreakdown stats={overview} locale={locale} />
        </section>

        {/* Methodology note */}
        <MethodologyNote
          listingCount={national?.listing_count || 0}
          locale={locale}
          methodologyUrl={methodologyUrl}
        />
      </div>
    </div>
  );
}
