import { notFound, redirect } from 'next/navigation';
import type { Listing } from '@/types/listing';
import { getListingUrlForLocale } from '@/lib/slug';
import { getListingById } from '@/lib/supabase/cached-queries';

interface ListingPageProps {
  params: Promise<{ locale: string; id: string }>;
}

/** Legacy /listing/{id} URLs: always redirect to the locale-aware listing URL. */
export default async function ListingPage({ params }: ListingPageProps) {
  const { locale, id } = await params;

  const { listing, error } = await getListingById(id);

  if (error || !listing) {
    notFound();
  }

  const localizedPath = getListingUrlForLocale(listing as Listing, locale);
  redirect(locale === 'en' ? `/en${localizedPath}` : localizedPath);
}
