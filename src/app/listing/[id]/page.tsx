import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ListingDetail } from '@/components/listings/listing-detail';
import { ListingSchema } from '@/components/seo/listing-schema';
import { ListingGrid } from '@/components/listings/listing-grid';
import type { Listing } from '@/types/listing';

interface ListingPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ListingPageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .single();

  if (!listing) {
    return { title: 'Listing Not Found' };
  }

  const title = listing.title;
  const description =
    listing.description_short ||
    `${listing.bedrooms || ''} bed, ${listing.bathrooms || ''} bath property in ${listing.location || 'Venezuela'}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${process.env.NEXT_PUBLIC_SITE_URL}/listing/${id}`,
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

export default async function ListingPage({ params }: ListingPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: listing, error } = await supabase
    .from('listings')
    .select('*')
    .eq('id', id)
    .eq('active', true)
    .single();

  if (error || !listing) {
    notFound();
  }

  // Fetch related listings
  const { data: relatedListings } = await supabase
    .from('listings')
    .select('*')
    .eq('active', true)
    .neq('id', id)
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
