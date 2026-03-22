import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { SearchBar } from '@/components/search/search-bar';
import { ListingGrid } from '@/components/listings/listing-grid';
import { ListingSkeleton } from '@/components/listings/listing-skeleton';
import { EmailSignupForm } from '@/components/forms/email-signup-form';
import { getFeaturedListings } from '@/lib/supabase/cached-queries';
import type { Metadata } from 'next';

// Enable ISR - revalidate every 30 minutes (1800 seconds)
export const revalidate = 1800;

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('defaultTitle'),
    description: t('defaultDescription'),
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

  return (
    <ListingGrid
      listings={listings}
      totalCount={count}
    />
  );
}

export default async function HomePage({ params, searchParams }: PageProps) {
  await params;
  const resolvedSearchParams = await searchParams;
  const t = await getTranslations('homepage');

  return (
    <>
      {/* Hero Section - Compact */}
      <section className="relative overflow-hidden bg-stone-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,63,0.15),transparent_50%)]"></div>
        <div className="container relative py-12 pb-20 md:py-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Left: Headline */}
            <div className="space-y-5">
              <div className="inline-block">
                <div className="text-xs font-medium tracking-wider text-amber-200 mb-3 uppercase">
                  {t('heroTagline')}
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1] text-balance">
                {t('heroHeadline').split(' ').slice(0, 2).join(' ')}<br />
                {t('heroHeadline').split(' ').slice(2, 3).join(' ')}<br />
                <span className="text-amber-100">{t('heroHeadline').split(' ').slice(3).join(' ') || 'Property'}</span>
              </h1>
              <p className="text-lg text-stone-300 max-w-md leading-relaxed">
                {t('heroDescription')}
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <Link
                  href="/search"
                  className="px-7 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
                >
                  {t('startSearching')}
                </Link>
                <Link
                  href="/guides"
                  className="px-7 py-3 bg-stone-800 hover:bg-stone-700 text-white font-semibold rounded-lg transition-colors border border-stone-700"
                >
                  {t('buyingGuide')}
                </Link>
              </div>
            </div>

            {/* Right: Stats Cards - Hidden on mobile */}
            <div className="hidden md:grid grid-cols-3 gap-3">
              <div className="bg-stone-800/50 backdrop-blur-sm border border-stone-700 rounded-2xl p-5">
                <div className="text-3xl font-bold text-amber-100">{t('activeListingsValue')}</div>
                <div className="text-stone-400 mt-2 text-sm">{t('activeListings')}</div>
              </div>
              <div className="bg-stone-800/50 backdrop-blur-sm border border-stone-700 rounded-2xl p-5">
                <div className="text-3xl font-bold text-amber-100">{t('statesCoveredValue')}</div>
                <div className="text-stone-400 mt-2 text-sm">{t('statesCovered')}</div>
              </div>
              <div className="bg-stone-800/50 backdrop-blur-sm border border-stone-700 rounded-2xl p-5">
                <div className="text-3xl font-bold text-amber-100">{t('updatedValue')}</div>
                <div className="text-stone-400 mt-2 text-sm">{t('updated')}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Search Bar - Overlapping */}
      <section className="container -mt-12 relative z-10">
        <div className="bg-white rounded-2xl shadow-2xl p-6 border border-stone-200">
          <Suspense fallback={<div className="h-16 animate-pulse bg-stone-100 rounded-lg" />}>
            <SearchBar />
          </Suspense>
        </div>
      </section>

      {/* Featured Listings */}
      <section className="bg-stone-50 py-12 mt-4">
        <div className="container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-2">
                {t('latestListings')}
              </h2>
              <p className="text-lg text-stone-600">
                {t('updatedDaily')}
              </p>
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

          {/* Mobile View All Button */}
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

      {/* Split CTA Section - Asymmetric */}
      <section className="container py-20">
        <div className="grid md:grid-cols-5 gap-8">
          {/* Buyers - Larger */}
          <div className="md:col-span-3 bg-amber-600 text-white rounded-3xl p-10 md:p-12 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500 rounded-full blur-3xl opacity-30 transform translate-x-20 -translate-y-20"></div>
            <div className="relative z-10">
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

          {/* Agents - Smaller */}
          <div className="md:col-span-2 bg-stone-900 text-white rounded-3xl p-8 md:p-10">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              {t('listWithUs')}
            </h3>
            <p className="text-stone-400 mb-8">
              {t('listWithUsDescription')}
            </p>
            <Link
              href="/list-your-property"
              className="inline-flex px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors"
            >
              {t('getStarted')}
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="bg-stone-900 py-16">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              {t('stayInTheLoop')}
            </h2>
            <p className="text-stone-400 text-lg mb-8">
              {t('stayInTheLoopDescription')}
            </p>
            <div className="bg-stone-800 rounded-2xl p-6">
              <EmailSignupForm />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
