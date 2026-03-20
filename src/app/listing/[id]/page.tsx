import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { Listing } from '@/types/listing';
import { getListingUrl } from '@/lib/slug';
import { getListingById } from '@/lib/supabase/cached-queries';

// Enable ISR - revalidate every hour (3600 seconds)
export const revalidate = 3600;

interface ListingPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({
  params,
}: ListingPageProps): Promise<Metadata> {
  const { id } = await params;

  const { listing } = await getListingById(id);

  if (!listing) {
    return { title: 'Listing Not Found' };
  }

  const title = listing.title_en || listing.title;
  const description =
    listing.description_short_en ||
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

  // First, check if listing exists (active or inactive)
  const { listing, error } = await getListingById(id);

  if (error || !listing) {
    notFound();
  }

  // Redirect to new SEO-friendly URL
  redirect(getListingUrl(listing as Listing));
}
