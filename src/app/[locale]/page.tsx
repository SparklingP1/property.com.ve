import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SearchBar } from '@/components/search/search-bar';
import { ListingGrid } from '@/components/listings/listing-grid';
import { ListingSkeleton } from '@/components/listings/listing-skeleton';
import { EmailSignupForm } from '@/components/forms/email-signup-form';
import { getFeaturedListings } from '@/lib/supabase/cached-queries';
import type { Metadata } from 'next';

export const revalidate = 1800;

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

interface PopularArea {
  city: string;
  housesEs: string;
  housesEn: string;
  apartmentsEs?: string;
  apartmentsEn?: string;
}

const POPULAR_AREAS: PopularArea[] = [
  {
    city: 'Caracas',
    housesEs: '/casas-caracas',
    housesEn: '/houses-caracas',
    apartmentsEs: '/apartamentos-caracas',
    apartmentsEn: '/apartments-caracas',
  },
  {
    city: 'Maracaibo',
    housesEs: '/casas-maracaibo',
    housesEn: '/houses-maracaibo',
    apartmentsEs: '/apartamentos-maracaibo',
    apartmentsEn: '/apartments-maracaibo',
  },
  {
    city: 'Valencia',
    housesEs: '/casas-valencia',
    housesEn: '/houses-valencia',
    apartmentsEs: '/apartamentos-valencia',
    apartmentsEn: '/apartments-valencia',
  },
  {
    city: 'Maracay',
    housesEs: '/casas-maracay',
    housesEn: '/houses-maracay',
    apartmentsEs: '/apartamentos-maracay',
    apartmentsEn: '/apartments-maracay',
  },
  {
    city: 'Barquisimeto',
    housesEs: '/casas-barquisimeto',
    housesEn: '/houses-barquisimeto',
    apartmentsEs: '/apartamentos-barquisimeto',
    apartmentsEn: '/apartments-barquisimeto',
  },
  {
    city: 'Merida',
    housesEs: '/casas-merida',
    housesEn: '/houses-merida',
    apartmentsEs: '/apartamentos-merida',
    apartmentsEn: '/apartments-merida',
  },
  {
    city: 'Punto Fijo',
    housesEs: '/casas-punto-fijo',
    housesEn: '/houses-punto-fijo',
  },
  {
    city: 'Margarita',
    housesEs: '/casas-margarita',
    housesEn: '/houses-margarita',
    apartmentsEs: '/apartamentos-margarita',
    apartmentsEn: '/apartments-margarita',
  },
];

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  return {
    title: t('defaultTitle'),
    description: t('defaultDescription'),
    alternates: {
      canonical: locale === 'es' ? baseUrl : `${baseUrl}/en`,
      languages: {
        es: baseUrl,
        en: `${baseUrl}/en`,
      },
    },
  };
}

async function FeaturedListings({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const { listings, count } = await getFeaturedListings({
    region: searchParams.region,
    type: searchParams.type,
    search: searchParams.search,
    price: searchParams.price,
  });

  return <ListingGrid listings={listings} totalCount={count} />;
}

export default async function HomePage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations('homepage');

  return (
    <>
      {/* Hero — compact, focused on the search bar */}
      <section className="relative overflow-hidden bg-stone-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,63,0.15),transparent_50%)]" />
        <div className="container relative pt-10 pb-16 md:pt-12 md:pb-20">
          <div className="max-w-2xl mx-auto text-center mb-8">
            <p className="text-xs font-semibold tracking-[0.2em] text-amber-200 uppercase mb-3">
              {t('heroTagline')}
            </p>
            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.1] mb-4">
              {t('heroHeadline')}
            </h1>
            <p className="text-stone-400 text-base md:text-lg max-w-lg mx-auto leading-relaxed">
              {t('heroDescription')}
            </p>
          </div>

          {/* Stats row — inline, compact */}
          <div className="hidden md:flex items-center justify-center gap-8 mb-2">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-amber-100">{t('activeListingsValue')}</span>
              <span className="text-sm text-stone-500">{t('activeListings')}</span>
            </div>
            <div className="w-px h-5 bg-stone-700" />
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-amber-100">{t('statesCoveredValue')}</span>
              <span className="text-sm text-stone-500">{t('statesCovered')}</span>
            </div>
            <div className="w-px h-5 bg-stone-700" />
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-amber-100">{t('updatedValue')}</span>
              <span className="text-sm text-stone-500">{t('updated')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Search bar — overlapping the hero */}
      <section className="container -mt-8 relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-6 border border-stone-200">
          <Suspense fallback={<div className="h-16 animate-pulse bg-stone-100 rounded-lg" />}>
            <SearchBar />
          </Suspense>
        </div>
      </section>

      {/* Latest Listings */}
      <section className="bg-stone-50 py-12 mt-4">
        <div className="container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-2">
                {t('latestListings')}
              </h2>
              <p className="text-lg text-stone-600">{t('updatedDaily')}</p>
            </div>
            <Link
              href="/search"
              className="text-stone-600 md:text-stone-900 text-sm md:font-semibold hover:text-amber-700 transition-colors whitespace-nowrap"
            >
              {t('viewAll')}
            </Link>
          </div>
          <Suspense fallback={<ListingSkeleton count={12} />}>
            <FeaturedListings searchParams={resolvedSearchParams} />
          </Suspense>

          <div className="md:hidden text-center mt-8">
            <Link
              href="/search"
              className="inline-block w-full sm:w-auto px-8 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-colors"
            >
              {t('viewAllProperties')}
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Areas */}
      <section className="container py-16">
        <div className="mb-10">
          <h2 className="text-3xl md:text-4xl font-bold text-stone-900 mb-2">
            {t('popularAreas')}
          </h2>
          <p className="text-lg text-stone-600">{t('popularAreasDescription')}</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {POPULAR_AREAS.map((area) => (
            <div
              key={area.city}
              className="bg-white rounded-xl border border-stone-200 p-5 hover:shadow-md transition-shadow"
            >
              <h3 className="font-bold text-stone-900 mb-3">{area.city}</h3>
              <div className="space-y-2">
                <Link
                  href={locale === 'es' ? area.housesEs : area.housesEn}
                  className="block text-sm text-amber-700 hover:text-amber-800 font-medium"
                >
                  {t('housesIn', { city: area.city })}{' '}
                  <span aria-hidden="true">{'\u2192'}</span>
                </Link>
                {area.apartmentsEs && area.apartmentsEn && (
                  <Link
                    href={locale === 'es' ? area.apartmentsEs : area.apartmentsEn}
                    className="block text-sm text-amber-700 hover:text-amber-800 font-medium"
                  >
                    {t('apartmentsIn', { city: area.city })}{' '}
                    <span aria-hidden="true">{'\u2192'}</span>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link
            href="/browse-by-area"
            className="text-stone-900 font-semibold hover:text-amber-700 transition-colors"
          >
            {t('viewAllAreas')}
          </Link>
        </div>
      </section>

      {/* CTA — single card, focused on search + alerts */}
      <section className="container pb-20">
        <div className="bg-amber-600 text-white rounded-3xl p-10 md:p-14 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full blur-3xl opacity-30 transform translate-x-20 -translate-y-20" />
          <div className="relative z-10 max-w-xl">
            <h3 className="text-3xl md:text-4xl font-bold mb-4">
              {t('findPerfectHome')}
            </h3>
            <p className="text-amber-50 text-lg mb-8 max-w-md">
              {t('findPerfectHomeDescription')}
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/search"
                className="px-8 py-4 bg-white text-amber-700 rounded-lg font-semibold hover:bg-stone-100 transition-colors"
              >
                {t('startSearching')}
              </Link>
              <Link
                href="/find-property"
                className="px-8 py-4 bg-amber-700 text-white rounded-lg font-semibold hover:bg-amber-800 transition-colors border border-amber-500"
              >
                {t('getMatched')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Email Signup */}
      <section className="bg-stone-900 py-16">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {t('stayInTheLoop')}
            </h2>
            <p className="text-stone-400 text-lg mb-8">{t('stayInTheLoopDescription')}</p>
            <div className="bg-stone-800 rounded-2xl p-6">
              <EmailSignupForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
