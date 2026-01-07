import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ListingDetail } from '@/components/listings/listing-detail';
import { ListingSchema } from '@/components/seo/listing-schema';
import { ListingGrid } from '@/components/listings/listing-grid';
import type { Listing } from '@/types/listing';
import { getListingUrl } from '@/lib/slug';

interface PropertyPageProps {
  params: Promise<{ state: string; city: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: PropertyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('url_slug', slug)
    .single();

  if (!listing) {
    return { title: 'Property Not Found' };
  }

  const title = listing.title_en || listing.title;
  const description =
    listing.description_short_en ||
    listing.description_short ||
    `${listing.bedrooms || ''} bed, ${listing.bathrooms || ''} bath property in ${listing.city || listing.location || 'Venezuela'}`;

  // Generate canonical URL
  const canonicalUrl = `${process.env.NEXT_PUBLIC_SITE_URL}${getListingUrl(listing)}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
      images: listing.thumbnail_url ? [listing.thumbnail_url] : [],
      siteName: 'Property.com.ve',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: listing.thumbnail_url ? [listing.thumbnail_url] : [],
    },
  };
}

export default async function PropertyPage({ params }: PropertyPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  // First, check if listing exists (active or inactive)
  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .eq('url_slug', slug)
    .single();

  if (error || !listing) {
    notFound();
  }

  // If listing is inactive, show "no longer available" page with similar properties
  if (!listing.active) {
    // Fetch similar available properties based on location and type
    const { data: similarListings } = await supabase
      .from('listings')
      .select('*')
      .eq('active', true)
      .eq('property_type', listing.property_type || 'apartment')
      .limit(6)
      .order('scraped_at', { ascending: false });

    // Filter by city/state if available
    const filtered =
      similarListings?.filter(
        (l) =>
          l.city === listing.city ||
          l.state === listing.state ||
          l.region === listing.region
      ) || [];

    const finalSimilar = filtered.length > 0 ? filtered.slice(0, 6) : similarListings || [];

    return (
      <div className="container py-8">
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8 mb-12">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">Property No Longer Available</h1>
            <p className="text-lg text-stone-600 mb-2">
              This property has been sold, rented, or removed from the market.
            </p>
            <p className="text-stone-500 mb-6">
              {(listing.title_en || listing.title) && (
                <span className="block text-sm mt-2 italic">{listing.title_en || listing.title}</span>
              )}
            </p>
            <div className="flex gap-4 justify-center">
              <a
                href="/search"
                className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                Browse All Properties
              </a>
              <a
                href="/find-property"
                className="px-6 py-3 bg-stone-200 text-stone-900 rounded-lg font-medium hover:bg-stone-300 transition-colors"
              >
                Request Property Search
              </a>
            </div>
          </div>
        </div>

        {/* Similar Available Properties */}
        {finalSimilar.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">Similar Available Properties</h2>
            <ListingGrid listings={finalSimilar as Listing[]} />
            <div className="text-center mt-8">
              <a
                href={`/search?property_type=${listing.property_type}${listing.state ? `&state=${encodeURIComponent(listing.state)}` : ''}`}
                className="text-primary hover:underline font-medium"
              >
                View all {listing.property_type || 'properties'}{' '}
                {listing.state ? `in ${listing.state}` : 'in this area'} →
              </a>
            </div>
          </section>
        )}
      </div>
    );
  }

  // Fetch related listings for active properties
  const { data: relatedListings } = await supabase
    .from('listings')
    .select('*')
    .eq('active', true)
    .neq('url_slug', slug)
    .eq('region', listing.region)
    .limit(3);

  return (
    <>
      <ListingSchema listing={listing as Listing} />

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <ListingDetail listing={listing as Listing} />
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="bg-white rounded-xl shadow-sm border border-border p-6">
                <h2 className="text-xl font-semibold mb-4">
                  Interested in this property?
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  Contact the listing agent directly through the original listing
                  page for more information, to schedule a viewing, or to make an
                  offer.
                </p>
                <a
                  href={listing.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Contact Agent
                </a>

                <div className="border-t border-border mt-6 pt-6">
                  <h3 className="font-medium mb-2">Looking for something else?</h3>
                  <a
                    href="/find-property"
                    className="text-primary hover:underline text-sm"
                  >
                    Tell us what you&apos;re looking for
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Listings */}
        {relatedListings && relatedListings.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6">Similar Properties</h2>
            <ListingGrid listings={relatedListings as Listing[]} />
          </section>
        )}
      </div>
    </>
  );
}
