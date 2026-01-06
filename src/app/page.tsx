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
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-16 md:py-24">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Find Your Dream Property in Venezuela
            </h1>
            <p className="text-lg md:text-xl text-primary-100 mb-8">
              Search thousands of properties from multiple sources. Apartments,
              houses, land, and commercial spaces across all regions.
            </p>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="container -mt-8 relative z-10">
        <Suspense fallback={<div className="h-20 bg-white rounded-xl shadow-lg animate-pulse" />}>
          <SearchBar />
        </Suspense>
      </section>

      {/* Stats Section */}
      <section className="container py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="bg-white rounded-xl p-6 text-center shadow-sm border border-border"
            >
              <stat.icon className="h-8 w-8 text-primary mx-auto mb-3" />
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured Listings */}
      <section className="container py-12">
        <h2 className="text-3xl font-bold mb-8">Featured Properties</h2>
        <Suspense fallback={<ListingSkeleton count={12} />}>
          <FeaturedListings searchParams={params} />
        </Suspense>
      </section>

      {/* Email Signup Section */}
      <section className="bg-primary-50 py-16">
        <div className="container">
          <div className="max-w-2xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-4">Stay Updated</h2>
            <p className="text-muted-foreground mb-8">
              Get the latest property listings and market insights delivered to
              your inbox weekly.
            </p>
            <EmailSignupForm />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container py-16">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-xl p-8 shadow-sm border border-border">
            <h3 className="text-2xl font-bold mb-4">Looking to Buy?</h3>
            <p className="text-muted-foreground mb-6">
              Tell us what you&apos;re looking for and we&apos;ll connect you with
              matching properties and agents.
            </p>
            <a
              href="/find-property"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Find Your Property
            </a>
          </div>
          <div className="bg-white rounded-xl p-8 shadow-sm border border-border">
            <h3 className="text-2xl font-bold mb-4">Real Estate Agent?</h3>
            <p className="text-muted-foreground mb-6">
              List your properties on our platform and reach thousands of
              potential buyers.
            </p>
            <a
              href="/list-your-property"
              className="inline-flex items-center justify-center px-6 py-3 bg-foreground text-white rounded-lg font-medium hover:bg-foreground/90 transition-colors"
            >
              List Your Property
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
