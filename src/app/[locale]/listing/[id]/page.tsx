import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import type { Listing } from '@/types/listing';
import { getListingUrlForLocale } from '@/lib/slug';
import { getListingById } from '@/lib/supabase/cached-queries';

// Enable ISR - revalidate every hour (3600 seconds)
export const revalidate = 3600;

interface ListingPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({
  params,
}: ListingPageProps): Promise<Metadata> {
  const { locale, id } = await params;

  const { listing } = await getListingById(id);

  if (!listing) {
    return { title: 'Listing Not Found' };
  }

  // Use locale-appropriate title/description
  const title = locale === 'es'
    ? (listing.title || listing.title_en || 'Property')
    : (listing.title_en || listing.title || 'Property');
  const description = locale === 'es'
    ? (listing.description_short || listing.description_short_en || `${listing.bedrooms || ''} bed, ${listing.bathrooms || ''} bath property in ${listing.location || 'Venezuela'}`)
    : (listing.description_short_en || listing.description_short || `${listing.bedrooms || ''} bed, ${listing.bathrooms || ''} bath property in ${listing.location || 'Venezuela'}`);

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
  const { locale, id } = await params;

  // First, check if listing exists (active or inactive)
  const { listing, error } = await getListingById(id);

  if (error || !listing) {
    notFound();
  }

  // Redirect to locale-aware SEO-friendly URL
  const localizedPath = getListingUrlForLocale(listing as Listing, locale);
  redirect(locale === 'en' ? `/en${localizedPath}` : localizedPath);
}
