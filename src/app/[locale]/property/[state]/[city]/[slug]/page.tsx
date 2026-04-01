import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { ListingDetail } from '@/components/listings/listing-detail';
import { ListingSchema } from '@/components/seo/listing-schema';
import { ListingGrid } from '@/components/listings/listing-grid';
import type { Listing } from '@/types/listing';
import { getListingUrl, getListingUrlForLocale } from '@/lib/slug';
import { Link } from '@/i18n/navigation';
import { ArrowLeft } from 'lucide-react';

interface PropertyPageProps {
  params: Promise<{ locale: string; state: string; city: string; slug: string }>;
}

export async function generateMetadata({
  params,
}: PropertyPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const supabase = await createClient();

  // Try both English and Spanish slug columns
  const [{ data: byEnSlug }, { data: byEsSlug }] = await Promise.all([
    supabase.from('listings').select('*').eq('url_slug', slug).single(),
    supabase.from('listings').select('*').eq('url_slug_es', slug).single(),
  ]);
  const listing = byEnSlug || byEsSlug;

  if (!listing) {
    return { title: 'Property Not Found' };
  }

  // Use locale-appropriate title/description
  const title = locale === 'es'
    ? (listing.title || listing.title_en)
    : (listing.title_en || listing.title);
  const description = locale === 'es'
    ? (listing.description_short || listing.description_short_en || `${listing.bedrooms || ''} bed, ${listing.bathrooms || ''} bath property in ${listing.city || listing.location || 'Venezuela'}`)
    : (listing.description_short_en || listing.description_short || `${listing.bedrooms || ''} bed, ${listing.bathrooms || ''} bath property in ${listing.city || listing.location || 'Venezuela'}`);

  // Generate locale-aware canonical URLs
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  const esPath = getListingUrlForLocale(listing, 'es');
  const enPath = getListingUrlForLocale(listing, 'en');
  const canonicalUrl = locale === 'es' ? `${baseUrl}${esPath}` : `${baseUrl}/en${enPath}`;

  return {
    title,
    description,
    robots: {
      // Index active listings; noindex inactive ones (sold/removed = soft 404 risk)
      index: listing.active !== false,
      follow: true,
    },
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
  const { locale, slug } = await params;
  const t = await getTranslations('propertyDetail');
  const supabase = await createClient();

  // First, check if listing exists (active or inactive) — try both slug columns
  const [{ data: byEn }, { data: byEs }] = await Promise.all([
    supabase.from('listings').select('*').eq('url_slug', slug).single(),
    supabase.from('listings').select('*').eq('url_slug_es', slug).single(),
  ]);
  const listing = byEn || byEs;

  if (!listing) {
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

    // Use locale-appropriate title
    const listingTitle = locale === 'es'
      ? (listing.title || listing.title_en)
      : (listing.title_en || listing.title);

    return (
      <div className="container py-8">
        <div className="bg-stone-50 border border-stone-200 rounded-2xl p-8 mb-12">
          <div className="max-w-2xl mx-auto text-center">
            <h1 className="text-3xl font-bold mb-4">{t('noLongerAvailable')}</h1>
            <p className="text-lg text-stone-600 mb-2">
              {t('soldOrRemoved')}
            </p>
            <p className="text-stone-500 mb-6">
              {listingTitle && (
                <span className="block text-sm mt-2 italic">{listingTitle}</span>
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
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
        </div>

        {/* Similar Available Properties */}
        {finalSimilar.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold mb-6">{t('similarAvailable')}</h2>
            <ListingGrid listings={finalSimilar as Listing[]} />
            <div className="text-center mt-8">
              <Link
                href={`/search?property_type=${listing.property_type}${listing.state ? `&state=${encodeURIComponent(listing.state)}` : ''}`}
                className="text-primary hover:underline font-medium"
              >
                {t('viewAllType', {
                  type: listing.property_type || 'properties',
                  location: listing.state ? `in ${listing.state}` : 'in this area',
                })}
              </Link>
            </div>
          </section>
        )}
      </div>
    );
  }

  // Fetch related listings for active properties (exclude current by ID, not slug)
  const { data: relatedListings } = await supabase
    .from('listings')
    .select('*')
    .eq('active', true)
    .neq('id', listing.id)
    .eq('region', listing.region)
    .limit(3);

  return (
    <>
      <ListingSchema listing={listing as Listing} />

      <div className="container py-8">
        {/* Back to search */}
        <Link
          href="/search"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('backToSearch')}
        </Link>

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
                  {t('interestedInProperty')}
                </h2>
                <p className="text-muted-foreground text-sm mb-4">
                  {t('contactAgentDescription')}
                </p>
                <a
                  href={listing.source_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  {t('contactAgent')}
                </a>

                <div className="border-t border-border mt-6 pt-6">
                  <h3 className="font-medium mb-2">{t('lookingForSomethingElse')}</h3>
                  <Link
                    href="/find-property"
                    className="text-primary hover:underline text-sm"
                  >
                    {t('tellUsWhatYoureLooking')}
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Related Listings */}
        {relatedListings && relatedListings.length > 0 && (
          <section className="mt-16">
            <h2 className="text-2xl font-bold mb-6">{t('similarProperties')}</h2>
            <ListingGrid listings={relatedListings as Listing[]} />
          </section>
        )}
      </div>
    </>
  );
}
