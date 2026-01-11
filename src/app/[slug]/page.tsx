import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';
import { ListingGrid } from '@/components/listings/listing-grid';
import { parseSEOUrl, getPageTitle, getMetaDescription } from '@/lib/seo-url-parser';
import type { Listing } from '@/types/listing';
import Link from 'next/link';
import { MapPin, Home, TrendingUp, Bed, Search } from 'lucide-react';

interface SEOPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: SEOPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = createServiceClient();

  // Parse URL to extract filters
  const parsed = parseSEOUrl(slug);

  if (!parsed.isValid) {
    return {
      title: 'Page Not Found | Property.com.ve',
    };
  }

  // Try to fetch pre-generated SEO content
  const { data: seoContent } = await supabase
    .from('seo_page_content')
    .select('*')
    .eq('page_slug', `/${slug}`)
    .single();

  if (seoContent) {
    return {
      title: seoContent.meta_title,
      description: seoContent.meta_description,
      keywords: seoContent.keywords?.join(', '),
      openGraph: {
        title: seoContent.meta_title,
        description: seoContent.meta_description,
        type: 'website',
        siteName: 'Property.com.ve',
      },
    };
  }

  // Fallback metadata if no pre-generated content
  const title = `${getPageTitle(parsed.filters)} | Property.com.ve`;
  const description = getMetaDescription(parsed.filters, 0);

  return {
    title,
    description,
    openGraph: {
      title: getPageTitle(parsed.filters),
      description,
      type: 'website',
      siteName: 'Property.com.ve',
    },
  };
}

export default async function SEOPage({ params }: SEOPageProps) {
  const { slug } = await params;
  const supabase = createServiceClient();

  // Parse URL to extract filters
  const parsed = parseSEOUrl(slug);

  if (!parsed.isValid) {
    notFound();
  }

  const { filters } = parsed;

  // Fetch pre-generated SEO content
  const { data: seoContent } = await supabase
    .from('seo_page_content')
    .select('*')
    .eq('page_slug', `/${slug}`)
    .single();

  // If no SEO content exists, this page shouldn't exist
  if (!seoContent) {
    notFound();
  }

  // Build Supabase query based on filters
  let query = supabase
    .from('listings')
    .select('*')
    .eq('active', true);

  if (filters.city) {
    query = query.ilike('city', filters.city);
  }

  if (filters.state) {
    query = query.ilike('state', filters.state);
  }

  if (filters.property_type) {
    query = query.eq('property_type', filters.property_type);
  }

  if (filters.bedrooms) {
    query = query.eq('bedrooms', filters.bedrooms);
  }

  const { data: listings } = await query
    .order('last_seen_at', { ascending: false })
    .limit(100);

  const totalListings = listings?.length || 0;

  // Calculate stats (only if listings exist)
  const avgPrice =
    totalListings > 0
      ? listings!
          .filter((l) => l.price)
          .reduce((sum, l) => sum + (l.price || 0), 0) /
        listings!.filter((l) => l.price).length
      : 0;

  const propertyTypes =
    totalListings > 0
      ? listings!.reduce((acc, l) => {
          if (l.property_type) {
            acc[l.property_type] = (acc[l.property_type] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>)
      : {};

  const bedroomOptions =
    totalListings > 0
      ? [
          ...new Set(
            listings!.map((l) => l.bedrooms).filter((b): b is number => b !== null && b !== undefined)
          ),
        ].sort((a, b) => a - b)
      : [];

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(price);
  };

  const location = filters.city || filters.state || 'Venezuela';
  const propertyType = filters.property_type || 'properties';

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-stone-50 py-16">
        <div className="container">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-stone-400 text-sm mb-4">
            <Link href="/" className="hover:text-stone-200">
              Home
            </Link>
            <span>/</span>
            {filters.state && !filters.city && (
              <span className="text-stone-200">{filters.state}</span>
            )}
            {filters.city && (
              <>
                {filters.state && (
                  <>
                    <Link href={`/search?state=${encodeURIComponent(filters.state)}`} className="hover:text-stone-200">
                      {filters.state}
                    </Link>
                    <span>/</span>
                  </>
                )}
                <span className="text-stone-200">{filters.city}</span>
              </>
            )}
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">{seoContent.h1}</h1>

          {/* SEO Description */}
          <p className="text-stone-300 text-lg max-w-3xl leading-relaxed">{seoContent.description}</p>

          {totalListings > 0 && (
            <p className="text-stone-400 text-sm mt-4">{totalListings} properties available</p>
          )}
        </div>
      </div>

      <div className="container py-12">
        {/* Zero Listings State */}
        {totalListings === 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-12 text-center max-w-2xl mx-auto">
            <Search className="h-16 w-16 text-stone-400 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-stone-900 mb-4">
              No Properties Currently Available
            </h2>
            <p className="text-stone-600 mb-8 leading-relaxed">
              We don't have any {filters.bedrooms ? `${filters.bedrooms}-bedroom ` : ''}
              {propertyType} in {location} right now, but we add new listings regularly.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/search"
                className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                Browse All Properties
              </Link>
              {filters.city && (
                <Link
                  href={`/search?city=${encodeURIComponent(filters.city)}`}
                  className="inline-block px-8 py-3 bg-stone-100 text-stone-900 rounded-lg font-medium hover:bg-stone-200 transition-colors"
                >
                  View All in {filters.city}
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Listings Exist - Show Stats and Grid */}
        {totalListings > 0 && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Home className="h-6 w-6 text-primary" />
                  <h3 className="font-semibold text-stone-900">Total Properties</h3>
                </div>
                <p className="text-3xl font-bold text-primary">{totalListings}</p>
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
                  <h3 className="font-semibold text-stone-900">Location</h3>
                </div>
                <p className="text-2xl font-bold text-primary">{location}</p>
                <p className="text-sm text-stone-600 mt-1">
                  {filters.bedrooms ? `${filters.bedrooms} bedroom ` : ''}
                  {propertyType}
                </p>
              </div>
            </div>

            {/* Related Searches - Property Types (if no type filter) */}
            {!filters.property_type && Object.keys(propertyTypes).length > 1 && (
              <section className="mb-12">
                <h2 className="text-2xl font-bold mb-6 text-stone-900">Browse by Property Type</h2>
                <div className="flex flex-wrap gap-3">
                  {(Object.entries(propertyTypes) as [string, number][])
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <Link
                        key={type}
                        href={`/search?${filters.city ? `city=${encodeURIComponent(filters.city)}` : `state=${encodeURIComponent(filters.state || '')}`}&property_type=${type}`}
                        className="bg-white rounded-lg shadow-sm border border-stone-200 px-6 py-4 hover:shadow-md hover:border-primary transition-all"
                      >
                        <p className="font-semibold text-stone-900 capitalize text-lg">{type}</p>
                        <p className="text-sm text-stone-600">{count} listings</p>
                      </Link>
                    ))}
                </div>
              </section>
            )}

            {/* Related Searches - Bedrooms (if no bedroom filter and property type is apartment/house) */}
            {!filters.bedrooms &&
              (filters.property_type === 'apartment' || filters.property_type === 'house') &&
              bedroomOptions.length > 0 && (
                <section className="mb-12">
                  <h2 className="text-2xl font-bold mb-6 text-stone-900">
                    Browse by Number of Bedrooms
                  </h2>
                  <div className="flex flex-wrap gap-3">
                    {bedroomOptions.map((bedrooms) => (
                      <Link
                        key={bedrooms}
                        href={`/search?${filters.city ? `city=${encodeURIComponent(filters.city)}` : `state=${encodeURIComponent(filters.state || '')}`}&property_type=${filters.property_type}&bedrooms=${bedrooms}`}
                        className="bg-white rounded-lg shadow-sm border border-stone-200 px-6 py-3 hover:shadow-md hover:border-primary transition-all flex items-center gap-2"
                      >
                        <Bed className="h-5 w-5 text-primary" />
                        <span className="font-medium text-stone-900">
                          {bedrooms} Bedroom{bedrooms > 1 ? 's' : ''}
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

            {/* Listings Grid */}
            <section>
              <h2 className="text-2xl font-bold mb-6 text-stone-900">
                {filters.bedrooms && `${filters.bedrooms} Bedroom `}
                {filters.property_type
                  ? filters.property_type.charAt(0).toUpperCase() + filters.property_type.slice(1)
                  : 'Properties'}{' '}
                in {location}
              </h2>
              <ListingGrid listings={listings as Listing[]} />

              {totalListings >= 100 && (
                <div className="text-center mt-8">
                  <Link
                    href={`/search?${filters.city ? `city=${encodeURIComponent(filters.city)}` : `state=${encodeURIComponent(filters.state || '')}`}${filters.property_type ? `&property_type=${filters.property_type}` : ''}${filters.bedrooms ? `&bedrooms=${filters.bedrooms}` : ''}`}
                    className="inline-block px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                  >
                    View All Results →
                  </Link>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
