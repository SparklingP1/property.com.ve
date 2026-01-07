import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { ListingGrid } from '@/components/listings/listing-grid';
import { slugify } from '@/lib/slug';
import type { Listing } from '@/types/listing';
import Link from 'next/link';
import { MapPin, Home, TrendingUp, Bed } from 'lucide-react';

interface CityPageProps {
  params: Promise<{ state: string; city: string }>;
}

export async function generateMetadata({
  params,
}: CityPageProps): Promise<Metadata> {
  const { state, city } = await params;
  const cityName = city.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const stateName = state.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

  return {
    title: `Real Estate in ${cityName}, ${stateName} | Property.com.ve`,
    description: `Find apartments, houses, and properties for sale in ${cityName}, ${stateName}. Browse detailed listings with photos, prices, and amenities.`,
    openGraph: {
      title: `Real Estate in ${cityName}, ${stateName}`,
      description: `Find apartments, houses, and properties for sale in ${cityName}.`,
      type: 'website',
      siteName: 'Property.com.ve',
    },
  };
}

export default async function CityPage({ params }: CityPageProps) {
  const { state: stateSlug, city: citySlug } = await params;
  const supabase = createServiceClient();

  // Get all active listings in this city
  const { data: listings } = await supabase
    .from('listings')
    .select('*')
    .eq('active', true)
    .ilike('state', stateSlug.replace(/-/g, ' '))
    .ilike('city', citySlug.replace(/-/g, ' '))
    .order('last_seen_at', { ascending: false })
    .limit(100);

  if (!listings || listings.length === 0) {
    notFound();
  }

  // Calculate stats
  const cityName = listings[0].city || citySlug.replace(/-/g, ' ');
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

  const bedroomOptions = [...new Set(listings.map(l => l.bedrooms).filter(Boolean))].sort((a, b) => (a || 0) - (b || 0));

  const neighborhoods = [...new Set(listings.map(l => l.neighborhood).filter(Boolean))];

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
            <Link href={`/property/${stateSlug}`} className="hover:text-stone-200">{stateName}</Link>
            <span>/</span>
            <span className="text-stone-200">{cityName}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Real Estate in {cityName}, {stateName}
          </h1>
          <p className="text-stone-300 text-lg max-w-3xl">
            Explore {totalListings}+ properties for sale in {cityName}.
            From modern apartments to family houses, find your ideal property.
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
              <h3 className="font-semibold text-stone-900">Neighborhoods</h3>
            </div>
            <p className="text-3xl font-bold text-primary">{neighborhoods.length || 'Multiple'}</p>
            <p className="text-sm text-stone-600 mt-1">Areas available</p>
          </div>
        </div>

        {/* Property Types */}
        {Object.keys(propertyTypes).length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-stone-900">Browse by Property Type</h2>
            <div className="flex flex-wrap gap-3">
              {(Object.entries(propertyTypes) as [string, number][])
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <Link
                    key={type}
                    href={`/search?state=${encodeURIComponent(stateName)}&city=${encodeURIComponent(cityName)}&property_type=${type}`}
                    className="bg-white rounded-lg shadow-sm border border-stone-200 px-6 py-4 hover:shadow-md hover:border-primary transition-all"
                  >
                    <p className="font-semibold text-stone-900 capitalize text-lg">{type}</p>
                    <p className="text-sm text-stone-600">{count} listings</p>
                  </Link>
                ))}
            </div>
          </section>
        )}

        {/* Bedrooms Filter */}
        {bedroomOptions.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-stone-900">Browse by Bedrooms</h2>
            <div className="flex flex-wrap gap-3">
              {bedroomOptions.map((bedrooms) => (
                <Link
                  key={bedrooms}
                  href={`/search?state=${encodeURIComponent(stateName)}&city=${encodeURIComponent(cityName)}&bedrooms=${bedrooms}`}
                  className="bg-white rounded-lg shadow-sm border border-stone-200 px-6 py-3 hover:shadow-md hover:border-primary transition-all flex items-center gap-2"
                >
                  <Bed className="h-5 w-5 text-primary" />
                  <span className="font-medium text-stone-900">{bedrooms} Bedroom{(bedrooms || 0) > 1 ? 's' : ''}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Neighborhoods */}
        {neighborhoods.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 text-stone-900">Popular Neighborhoods</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {neighborhoods.slice(0, 10).map((neighborhood) => (
                <Link
                  key={neighborhood}
                  href={`/search?state=${encodeURIComponent(stateName)}&city=${encodeURIComponent(cityName)}&neighborhood=${encodeURIComponent(neighborhood)}`}
                  className="bg-white rounded-lg shadow-sm border border-stone-200 p-4 hover:shadow-md hover:border-primary transition-all text-center"
                >
                  <MapPin className="h-5 w-5 text-primary mx-auto mb-2" />
                  <p className="font-medium text-stone-900 text-sm">{neighborhood}</p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured Listings */}
        <section>
          <h2 className="text-2xl font-bold mb-6 text-stone-900">
            Properties for Sale in {cityName}
          </h2>
          <ListingGrid listings={listings.slice(0, 50) as Listing[]} />

          <div className="text-center mt-8">
            <Link
              href={`/search?state=${encodeURIComponent(stateName)}&city=${encodeURIComponent(cityName)}`}
              className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              View All Properties in {cityName} →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
