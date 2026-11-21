import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ListingDetail } from '@/components/listings/listing-detail';
import { ListingSchema } from '@/components/seo/listing-schema';
import { ListingGrid } from '@/components/listings/listing-grid';
import { getListingUrlForLocale } from '@/lib/slug';
import { Link } from '@/i18n/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { getListingBySlugCached, getSimilarActiveListings } from '@/lib/supabase/listing-queries';
import {
  formatListingDate,
  getInactiveSince,
  getListingStatus,
  getListingSummary,
  getSourceName,
  type ListingStatus,
  type PublicListing,
} from '@/lib/listing-public';
import { SaveButton } from '@/components/listings/save-button';
import { TrackView } from '@/components/listings/track-view';
import { RegisterCTA } from '@/components/common/register-cta';

interface PropertyPageProps {
  params: Promise<{ locale: string; state: string; city: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Dev/QA only: `?simulate_status=inactive|gone` when LISTING_STATUS_SIMULATION=1
 * (never set in production). Lets us check the inactive page without DB writes.
 */
async function resolveStatus(
  listing: PublicListing,
  searchParams: PropertyPageProps['searchParams']
): Promise<{ status: ListingStatus; listing: PublicListing }> {
  if (process.env.LISTING_STATUS_SIMULATION === '1') {
    const value = (await searchParams).simulate_status;
    if (value === 'inactive' || value === 'gone') {
      const days = value === 'gone' ? 45 : 5;
      const deactivated = new Date(Date.now() - days * 86_400_000).toISOString();
      const simulated = { ...listing, active: false, deactivated_at: deactivated };
      return { status: getListingStatus(simulated), listing: simulated };
    }
  }
  return { status: getListingStatus(listing), listing };
}

/** Rentals are not launched yet (see migration 005): their pages stay 404. */
function isHidden(listing: PublicListing) {
  return listing.transaction_type === 'rent';
}

function getTitle(listing: PublicListing, locale: string) {
  return locale === 'es'
    ? listing.title || listing.title_en || 'Inmueble en Venezuela'
    : listing.title_en || listing.title || 'Property in Venezuela';
}

export async function generateMetadata({ params, searchParams }: PropertyPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = await getListingBySlugCached(slug);

  if (!found || isHidden(found)) {
    return { title: locale === 'es' ? 'Inmueble no encontrado' : 'Property not found' };
  }

  const { status, listing } = await resolveStatus(found, searchParams);
  const unavailable = status !== 'active';
  const baseTitle = getTitle(listing, locale);
  const title = unavailable
    ? `${locale === 'es' ? 'No disponible' : 'No longer available'}: ${baseTitle}`
    : baseTitle;
  const description = getListingSummary(listing, locale, { includePrice: !unavailable });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  const esPath = getListingUrlForLocale(listing, 'es');
  const enPath = getListingUrlForLocale(listing, 'en');
  const canonicalUrl = locale === 'es' ? `${baseUrl}${esPath}` : `${baseUrl}/en${enPath}`;
  const images = listing.thumbnail_url ? [listing.thumbnail_url] : [];

  return {
    title,
    description,
    robots: { index: !unavailable, follow: true },
    alternates: {
      canonical: canonicalUrl,
      languages: {
        es: `${baseUrl}${esPath}`,
        en: `${baseUrl}/en${enPath}`,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: canonicalUrl,
      locale: locale === 'es' ? 'es_VE' : 'en_US',
      images,
      siteName: 'Property.com.ve',
    },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export default async function PropertyPage({ params, searchParams }: PropertyPageProps) {
  const { locale, state, city, slug } = await params;
  const t = await getTranslations('propertyDetail');
  const tListing = await getTranslations('listing');
  const found = await getListingBySlugCached(slug);

  if (!found || isHidden(found)) {
    notFound();
  }

  const canonicalPath = getListingUrlForLocale(found, locale);
  const requestedPath = `/property/${state}/${city}/${slug}`;

  if (requestedPath !== canonicalPath) {
    redirect(locale === 'en' ? `/en${canonicalPath}` : canonicalPath);
  }

  const { status, listing } = await resolveStatus(found, searchParams);

  // The middleware answers 410 for these; this is the fallback if its check
  // was skipped (no service key, lookup timeout).
  if (status === 'gone') {
    notFound();
  }

  const town = listing.city || listing.location || null;
  const similar = await getSimilarActiveListings({
    excludeId: listing.id,
    city: listing.city,
    state: listing.state,
    propertyType: listing.property_type,
    transactionType: listing.transaction_type || 'sale',
    limit: 6,
  });
  const sourceName = getSourceName(listing.source);

  if (status === 'inactive') {
    const since = formatListingDate(getInactiveSince(listing), locale);
    const location = town || listing.state || 'Venezuela';

    return (
      <div className="container py-8">
        <div
          role="status"
          className="bg-amber-50 border border-amber-300 rounded-2xl p-6 md:p-8 mb-8"
        >
          <h1 className="text-2xl md:text-3xl font-bold mb-3 text-stone-900">{t('unavailableBanner')}</h1>
          <p className="text-stone-700 mb-5">
            {since
              ? t('unavailableText', { source: sourceName, date: since })
              : t('unavailableTextNoDate', { source: sourceName })}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            {listing.city && (
              <Link
                href={`/search?city=${encodeURIComponent(listing.city)}${listing.property_type ? `&type=${listing.property_type}` : ''}`}
                className="px-6 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors text-center"
              >
                {t('searchSimilarIn', { location: listing.city })}
              </Link>
            )}
            <Link
              href="/search"
              className="px-6 py-3 bg-stone-200 text-stone-900 rounded-lg font-medium hover:bg-stone-300 transition-colors text-center"
            >
              {t('browseAllProperties')}
            </Link>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6">{t('similarInTown', { location })}</h2>
            <ListingGrid listings={similar} />
          </section>
        )}

        <div className="max-w-3xl opacity-90">
          <ListingDetail listing={listing} unavailable />
        </div>
      </div>
    );
  }

  const canonicalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve'}${locale === 'en' ? '/en' : ''}${canonicalPath}`;

  return (
    <>
      <ListingSchema listing={listing} locale={locale} url={canonicalUrl} />
      <TrackView listingId={listing.id} />

      <div className="container py-8">
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToSearch')}
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ListingDetail listing={listing} />
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="bg-white rounded-xl shadow-sm border border-border p-6">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h2 className="text-xl font-semibold">{t('interestedInProperty')}</h2>
                  <SaveButton listingId={listing.id} size="lg" />
                </div>
                <p className="text-muted-foreground text-sm mb-4">
                  {t('contactViaSource', { source: sourceName })}
                </p>
                <a
                  href={listing.source_url}
                  target="_blank"
                  rel="nofollow noopener noreferrer"
                  className="flex items-center justify-center w-full text-center py-3 px-4 bg-primary text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
                >
                  {tListing('viewOriginalOn', { source: sourceName })}
                  <ExternalLink className="ml-2 h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="sr-only"> {tListing('opensInNewTab')}</span>
                </a>

                <div className="border-t border-border mt-6 pt-6">
                  <h3 className="font-medium mb-2">{t('lookingForSomethingElse')}</h3>
                  <Link href="/find-property" className="text-primary hover:underline text-sm">
                    {t('tellUsWhatYoureLooking')}
                  </Link>
                </div>
              </div>

              <RegisterCTA location={listing.city || listing.state || undefined} variant="compact" />
            </div>
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6">{t('similarProperties')}</h2>
            <ListingGrid listings={similar} />
          </section>
        )}
      </div>
    </>
  );
}
