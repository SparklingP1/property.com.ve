import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import { SearchBar } from '@/components/search/search-bar';
import { ListingGrid } from '@/components/listings/listing-grid';
import { ListingSkeleton } from '@/components/listings/listing-skeleton';
import { EmailSignupForm } from '@/components/forms/email-signup-form';
import { Building2, MapPin, Shield, TrendingUp } from 'lucide-react';
import type { Listing } from '@/types/listing';

interface PageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

async function FeaturedListings({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined };
}) {
  const supabase = await createClient();

  let query = supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('active', true)
    .order('scraped_at', { ascending: false })
    .limit(12);

  if (searchParams.region) {
    query = query.ilike('region', `%${searchParams.region}%`);
  }
  if (searchParams.type) {
    query = query.eq('property_type', searchParams.type);
  }
  if (searchParams.search) {
    query = query.or(
      `title.ilike.%${searchParams.search}%,location.ilike.%${searchParams.search}%`
    );
  }
  if (searchParams.price) {
    const [min, max] = searchParams.price.split('-');
    if (min) query = query.gte('price', Number(min));
    if (max) query = query.lte('price', Number(max));
  }

  const { data: listings, count } = await query;

  return (
    <ListingGrid
      listings={(listings as Listing[]) || []}
      totalCount={count || 0}
    />
  );
}

const stats = [
  { icon: Building2, value: '1,000+', label: 'Properties Listed' },
  { icon: MapPin, value: '10+', label: 'Regions Covered' },
  { icon: Shield, value: '100%', label: 'Verified Sources' },
  { icon: TrendingUp, value: 'Weekly', label: 'Updates' },
];

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <>
      {/* Hero Section - Compact */}
      <section className="relative overflow-hidden bg-stone-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(139,92,63,0.15),transparent_50%)]"></div>
        <div className="container relative py-12 md:py-16">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            {/* Left: Headline */}
            <div className="space-y-5">
              <div className="inline-block">
                <div className="text-xs font-medium tracking-wider text-amber-200 mb-3 uppercase">
                  Venezuela's Market Opens to Investment
                </div>
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
                Discover<br />
                Your Next<br />
                <span className="text-amber-100">Space</span>
              </h1>
              <p className="text-lg text-stone-300 max-w-md leading-relaxed">
                10,000+ curated properties across Venezuela. From coastal
                apartments to mountain estates.
              </p>
              <div className="flex flex-wrap gap-3 pt-2">
                <a
                  href="/search"
                  className="px-7 py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg transition-all transform hover:scale-105"
                >
                  Start Searching
                </a>
                <a
                  href="/guides"
                  className="px-7 py-3 bg-stone-800 hover:bg-stone-700 text-white font-semibold rounded-lg transition-colors border border-stone-700"
                >
                  Buying Guide
                </a>
              </div>
            </div>

            {/* Right: Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-stone-800/50 backdrop-blur-sm border border-stone-700 rounded-2xl p-5">
                <div className="text-3xl font-bold text-amber-100">10,000+</div>
                <div className="text-stone-400 mt-2 text-sm">Active Listings</div>
              </div>
              <div className="bg-stone-800/50 backdrop-blur-sm border border-stone-700 rounded-2xl p-5">
                <div className="text-3xl font-bold text-amber-100">12+</div>
                <div className="text-stone-400 mt-2 text-sm">States Covered</div>
              </div>
              <div className="bg-stone-800/50 backdrop-blur-sm border border-stone-700 rounded-2xl p-5">
                <div className="text-3xl font-bold text-amber-100">24/7</div>
                <div className="text-stone-400 mt-2 text-sm">Updated</div>
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
      <section className="bg-stone-50 py-16 mt-16">
        <div className="container">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-stone-900 mb-2">
                Latest Listings
              </h2>
              <p className="text-lg text-stone-600">
                Handpicked properties updated daily
              </p>
            </div>
            <a
              href="/search"
              className="hidden md:block text-stone-900 font-semibold hover:text-amber-700 transition-colors"
            >
              View All →
            </a>
          </div>
          <Suspense fallback={<ListingSkeleton count={12} />}>
            <FeaturedListings searchParams={params} />
          </Suspense>
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
                Find Your Perfect Home
              </h3>
              <p className="text-amber-50 text-lg mb-8 max-w-md">
                Browse thousands of verified listings. Get personalized
                recommendations and expert guidance.
              </p>
              <div className="flex flex-wrap gap-4">
                <a
                  href="/search"
                  className="px-8 py-4 bg-white text-amber-700 rounded-lg font-semibold hover:bg-stone-100 transition-colors"
                >
                  Start Searching
                </a>
                <a
                  href="/find-property"
                  className="px-8 py-4 bg-amber-700 text-white rounded-lg font-semibold hover:bg-amber-800 transition-colors border border-amber-500"
                >
                  Get Matched
                </a>
              </div>
            </div>
          </div>

          {/* Agents - Smaller */}
          <div className="md:col-span-2 bg-stone-900 text-white rounded-3xl p-8 md:p-10">
            <h3 className="text-2xl md:text-3xl font-bold mb-4">
              List With Us
            </h3>
            <p className="text-stone-400 mb-8">
              Real estate agents: reach thousands of potential buyers.
            </p>
            <a
              href="/list-your-property"
              className="inline-flex px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold transition-colors"
            >
              Get Started →
            </a>
          </div>
        </div>
      </section>

      {/* Newsletter Section */}
      <section className="bg-stone-900 py-16">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Stay in the Loop
            </h2>
            <p className="text-stone-400 text-lg mb-8">
              Weekly market updates, new listings, and buying tips delivered to
              your inbox.
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
