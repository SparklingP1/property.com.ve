import { Metadata } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { MapPin, Home } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Browse Properties by Area | Property.com.ve',
  description: 'Explore properties across Venezuela by location, property type, and bedrooms. Find apartments, houses, and land in Caracas, Valencia, Barquisimeto, and more.',
};

interface SEOPage {
  page_slug: string;
  h1: string;
  listing_count: number;
  filters: {
    city?: string;
    state?: string;
    property_type?: string;
    bedrooms?: number;
  };
}

export default async function BrowseByAreaPage() {
  const supabase = createServiceClient();

  // Fetch all SEO pages
  const { data: pages } = await supabase
    .from('seo_page_content')
    .select('page_slug, h1, listing_count, filters')
    .order('listing_count', { ascending: false });

  if (!pages || pages.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="container">
          <h1 className="text-4xl font-bold mb-4">Browse by Area</h1>
          <p className="text-stone-600">No pages available yet.</p>
        </div>
      </div>
    );
  }

  // Calculate unique listings accessible via SEO pages
  // Fetch all active listings
  const { data: allListings } = await supabase
    .from('listings')
    .select('id, city, state, property_type, bedrooms')
    .eq('active', true);

  // Find unique listings that match at least one SEO page
  const uniqueListingIds = new Set<string>();

  allListings?.forEach((listing) => {
    const matchesAnyPage = pages.some((page) => {
      const filters = page.filters;

      // Check if listing matches this page's filters
      if (filters.city && listing.city?.toLowerCase() !== filters.city.toLowerCase()) return false;
      if (filters.state && listing.state?.toLowerCase() !== filters.state.toLowerCase()) return false;
      if (filters.property_type && listing.property_type !== filters.property_type) return false;
      if (filters.bedrooms && listing.bedrooms !== filters.bedrooms) return false;

      return true;
    });

    if (matchesAnyPage) {
      uniqueListingIds.add(listing.id);
    }
  });

  const uniqueCount = uniqueListingIds.size;

  // Group pages by state and city
  const groupedByState = pages.reduce((acc, page: SEOPage) => {
    const state = page.filters.state || page.filters.city || 'Other';
    if (!acc[state]) {
      acc[state] = [];
    }
    acc[state].push(page);
    return acc;
  }, {} as Record<string, SEOPage[]>);

  // Sort states by total listing count
  const sortedStates = Object.entries(groupedByState).sort(
    ([, a], [, b]) => {
      const totalA = a.reduce((sum, page) => sum + page.listing_count, 0);
      const totalB = b.reduce((sum, page) => sum + page.listing_count, 0);
      return totalB - totalA;
    }
  );

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-stone-50 py-16">
        <div className="container">
          <div className="flex items-center gap-2 text-stone-400 text-sm mb-4">
            <Link href="/" className="hover:text-stone-200">
              Home
            </Link>
            <span>/</span>
            <span className="text-stone-200">Browse by Area</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            Browse Properties by Area
          </h1>
          <p className="text-stone-300 text-lg max-w-3xl">
            Explore {pages.length} specialized property search pages across Venezuela.
            Find apartments, houses, and land by location and specifications.
          </p>
        </div>
      </div>

      <div className="container py-12">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">Total Pages</h3>
            </div>
            <p className="text-3xl font-bold text-primary">{pages.length}</p>
            <p className="text-sm text-stone-600 mt-1">Search variations</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Home className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">Total Properties</h3>
            </div>
            <p className="text-3xl font-bold text-primary">
              {uniqueCount.toLocaleString()}
            </p>
            <p className="text-sm text-stone-600 mt-1">Unique listings</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">Locations</h3>
            </div>
            <p className="text-3xl font-bold text-primary">{sortedStates.length}</p>
            <p className="text-sm text-stone-600 mt-1">States & cities</p>
          </div>
        </div>

        {/* Pages grouped by location */}
        {sortedStates.map(([state, statePages]) => {
          const totalListings = statePages.reduce((sum, page) => sum + page.listing_count, 0);

          return (
            <section key={state} className="mb-12">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-stone-900">
                  {state}
                </h2>
                <span className="text-sm text-stone-600">
                  {totalListings.toLocaleString()} properties • {statePages.length} pages
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {statePages.map((page: SEOPage) => (
                  <Link
                    key={page.page_slug}
                    href={page.page_slug}
                    className="bg-white rounded-lg shadow-sm border border-stone-200 p-5 hover:shadow-md hover:border-primary transition-all group"
                  >
                    <h3 className="font-semibold text-stone-900 group-hover:text-primary transition-colors mb-2">
                      {page.h1}
                    </h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-600">
                        {page.listing_count} {page.listing_count === 1 ? 'property' : 'properties'}
                      </span>
                      <span className="text-primary font-medium group-hover:underline">
                        View →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
