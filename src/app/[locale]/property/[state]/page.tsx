import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createServiceClient } from '@/lib/supabase/server';
import { ListingGrid } from '@/components/listings/listing-grid';
import { slugify } from '@/lib/slug';
import type { Listing } from '@/types/listing';
import { Link } from '@/i18n/navigation';
import { MapPin, Home, TrendingUp } from 'lucide-react';

interface StatePageProps {
  params: Promise<{ locale: string; state: string }>;
}

export async function generateMetadata({
  params,
}: StatePageProps): Promise<Metadata> {
  const { locale, state } = await params;
  const stateName = state.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const t = await getTranslations({ locale, namespace: 'aggregate' });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  const path = `/property/${state}`;

  return {
    title: `${t('realEstateIn', { location: stateName })}, Venezuela | Property.com.ve`,
    description: `Browse apartments, houses, and properties for sale in ${stateName}. Find your perfect property with detailed listings, photos, and pricing.`,
    alternates: {
      canonical: `${baseUrl}${path}`,
      languages: {
        es: `${baseUrl}${path}`,
        en: `${baseUrl}/en${path}`,
      },
    },
    openGraph: {
      title: `${t('realEstateIn', { location: stateName })}, Venezuela`,
      description: `Browse apartments, houses, and properties for sale in ${stateName}.`,
      type: 'website',
      siteName: 'Property.com.ve',
    },
  };
}

export default async function StatePage({ params }: StatePageProps) {
  const { state: stateSlug } = await params;
  const t = await getTranslations('aggregate');
  const tNav = await getTranslations('nav');
  const supabase = createServiceClient();

  // Get all active listings and unique cities in this state in parallel
  const [{ data: listings }, { data: citiesData }] = await Promise.all([
    supabase
      .from('listings')
      .select('*')
      .eq('active', true)
      .ilike('state', stateSlug.replace(/-/g, ' '))
      .order('last_seen_at', { ascending: false })
      .limit(50),
    supabase
      .from('listings')
      .select('city, state')
      .eq('active', true)
      .ilike('state', stateSlug.replace(/-/g, ' '))
      .not('city', 'is', null),
  ]);

  if (!listings || listings.length === 0) {
    notFound();
  }

  const cities = [...new Set(citiesData?.map(c => c.city).filter(Boolean) || [])];

  // Calculate stats
  const stateName = listings[0].state || stateSlug.replace(/-/g, ' ');
  const totalListings = listings.length;
  const avgPrice = listings
    .filter(l => l.price)
    .reduce((sum, l) => sum + (l.price || 0), 0) / listings.filter(l => l.price).length;

  const propertyTypes = listings.reduce((acc, l) => {
    if (l.property_type) {
      acc[l.property_type] = (acc[l.property_type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-stone-50 py-16">
        <div className="container">
          <div className="flex items-center gap-2 text-stone-400 text-sm mb-4">
            <Link href="/" className="hover:text-stone-200">{tNav('home')}</Link>
            <span>/</span>
            <span className="text-stone-200">{stateName}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            {t('realEstateIn', { location: stateName })}
          </h1>
          <p className="text-stone-300 text-lg max-w-3xl">
            {t('propertiesForSaleIn', { location: `${stateName}, Venezuela` }).replace(' →', '')}
          </p>
        </div>
      </div>

      <div className="container py-12">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Home className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">{t('totalProperties')}</h3>
            </div>
            <p className="text-3xl font-bold text-primary">{totalListings}+</p>
            <p className="text-sm text-stone-600 mt-1">{t('activeListings')}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">{t('averagePrice')}</h3>
            </div>
            <p className="text-3xl font-bold text-primary">
              {avgPrice > 0 ? formatPrice(avgPrice) : 'Varies'}
            </p>
            <p className="text-sm text-stone-600 mt-1">{t('acrossAllProperties')}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">{t('cities')}</h3>
            </div>
            <p className="text-3xl font-bold text-primary">{cities.length}</p>
            <p className="text-sm text-stone-600 mt-1">{t('locationsAvailable')}</p>
          </div>
        </div>

        {/* Cities in this state */}
        {cities.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-stone-900">{t('browseByCity')}</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {cities.slice(0, 12).map((city) => (
                <Link
                  key={city}
                  href={`/property/${stateSlug}/${slugify(city)}`}
                  className="bg-white rounded-lg shadow-sm border border-stone-200 p-4 hover:shadow-md hover:border-primary transition-all text-center"
                >
                  <MapPin className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="font-medium text-stone-900 text-sm">{city}</p>
                </Link>
              ))}
            </div>
            {cities.length > 12 && (
              <p className="text-sm text-stone-600 mt-4">
                {t('andMoreCities', { count: cities.length - 12 })}
              </p>
            )}
          </section>
        )}

        {/* Property Types */}
        {Object.keys(propertyTypes).length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-stone-900">{t('browseByPropertyType')}</h2>
            <div className="flex flex-wrap gap-3">
              {(Object.entries(propertyTypes) as [string, number][]).map(([type, count]) => (
                <Link
                  key={type}
                  href={`/search?state=${encodeURIComponent(stateName)}&property_type=${type}`}
                  className="bg-white rounded-lg shadow-sm border border-stone-200 px-6 py-3 hover:shadow-md hover:border-primary transition-all"
                >
                  <p className="font-medium text-stone-900 capitalize">{type}</p>
                  <p className="text-sm text-stone-600">{count} {t('listings')}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured Listings */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-stone-900">{t('featuredProperties')}</h2>
          <ListingGrid listings={listings as Listing[]} />

          <div className="text-center mt-8">
            <Link
              href={`/search?state=${encodeURIComponent(stateName)}`}
              className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              {t('viewAllIn', { location: stateName })}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
