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

  // Ids are UUIDs; anything else (an old slug, junk) is simply not a listing.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    notFound();
  }

  const { listing, error } = await getListingById(id);

  // A database error must not look like a missing page (no 404 on outages).
  if (error) {
    throw new Error(`listing ${id}: ${error.message}`);
  }
  if (!listing) {
    notFound();
  }

  const localizedPath = getListingUrlForLocale(listing as Listing, locale);
  redirect(locale === 'en' ? `/en${localizedPath}` : localizedPath);
}
