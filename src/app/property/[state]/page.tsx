import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { ListingGrid } from '@/components/listings/listing-grid';
import { slugify } from '@/lib/slug';
import type { Listing } from '@/types/listing';
import Link from 'next/link';
import { MapPin, Home, TrendingUp } from 'lucide-react';

interface StatePageProps {
  params: Promise<{ state: string }>;
}

export async function generateMetadata({
  params,
}: StatePageProps): Promise<Metadata> {
  const { state } = await params;
  const stateName = state.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    title: `Real Estate in ${stateName}, Venezuela | Property.com.ve`,
    description: `Browse apartments, houses, and properties for sale in ${stateName}. Find your perfect property with detailed listings, photos, and pricing.`,
    openGraph: {
      title: `Real Estate in ${stateName}, Venezuela`,
      description: `Browse apartments, houses, and properties for sale in ${stateName}.`,
      type: 'website',
      siteName: 'Property.com.ve',
    },
  };
}

export default async function StatePage({ params }: StatePageProps) {
  const { state: stateSlug } = await params;
  const supabase = createServiceClient();

  // Get all active listings in this state
  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('active', true)
    .ilike('state', stateSlug.replace(/-/g, ' '))
    .order('last_seen_at', { ascending: false })
    .limit(50);

  if (!listings || listings.length === 0) {
    notFound();
  }

  // Get unique cities in this state
  const { data: citiesData } = await supabase
    .from('listings')
    .select('city, state')
    .eq('active', true)
    .ilike('state', stateSlug.replace(/-/g, ' '))
    .not('city', 'is', null);

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
            <Link href="/" className="hover:text-stone-200">Home</Link>
            <span>/</span>
            <span className="text-stone-200">{stateName}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Real Estate in {stateName}
          </h1>
          <p className="text-stone-300 text-lg max-w-3xl">
            Discover {totalListings}+ properties available for sale in {stateName}, Venezuela.
            From apartments to houses, find your perfect property.
          </p>
        </div>
      </div>

      <div className="container py-12">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Home className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">Total Properties</h3>
            </div>
            <p className="text-3xl font-bold text-primary">{totalListings}+</p>
            <p className="text-sm text-stone-600 mt-1">Active listings</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">Average Price</h3>
            </div>
            <p className="text-3xl font-bold text-primary">
              {avgPrice > 0 ? formatPrice(avgPrice) : 'Varies'}
            </p>
            <p className="text-sm text-stone-600 mt-1">Across all properties</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">Cities</h3>
            </div>
            <p className="text-3xl font-bold text-primary">{cities.length}</p>
            <p className="text-sm text-stone-600 mt-1">Locations available</p>
          </div>
        </div>

        {/* Cities in this state */}
        {cities.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-stone-900">Browse by City</h2>
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
                And {cities.length - 12} more cities...
              </p>
            )}
          </section>
        )}

        {/* Property Types */}
        {Object.keys(propertyTypes).length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-stone-900">Property Types</h2>
            <div className="flex flex-wrap gap-3">
              {(Object.entries(propertyTypes) as [string, number][]).map(([type, count]) => (
                <Link
                  key={type}
                  href={`/search?state=${encodeURIComponent(stateName)}&property_type=${type}`}
                  className="bg-white rounded-lg shadow-sm border border-stone-200 px-6 py-3 hover:shadow-md hover:border-primary transition-all"
                >
                  <p className="font-medium text-stone-900 capitalize">{type}</p>
                  <p className="text-sm text-stone-600">{count} listings</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured Listings */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-stone-900">Featured Properties</h2>
          <ListingGrid listings={listings as Listing[]} />

          <div className="text-center mt-8">
            <Link
              href={`/search?state=${encodeURIComponent(stateName)}`}
              className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              View All Properties in {stateName} →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
