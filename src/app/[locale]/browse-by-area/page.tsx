import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { createServiceClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { MapPin, Home } from 'lucide-react';

interface BrowseByAreaPageProps {
  params: Promise<{ locale: string }>;
}

interface SEOPage {
  page_slug: string;
  page_slug_es: string;
  h1: string;
  h1_es: string;
  listing_count: number;
  filters: {
    city?: string;
    state?: string;
    property_type?: string;
    bedrooms?: number;
  };
}

export async function generateMetadata({
  params,
}: BrowseByAreaPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'browseByArea' });
  const tMeta = await getTranslations({ locale, namespace: 'metadata' });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  return {
    title: `${t('heading')} | Property.com.ve`,
    description: t('description', { count: '' }),
    alternates: {
      canonical: locale === 'es' ? `${baseUrl}/browse-by-area` : `${baseUrl}/en/browse-by-area`,
      languages: {
        es: `${baseUrl}/browse-by-area`,
        en: `${baseUrl}/en/browse-by-area`,
      },
    },
  };
}

export default async function BrowseByAreaPage({ params }: BrowseByAreaPageProps) {
  const { locale } = await params;
  const t = await getTranslations('browseByArea');
  const tNav = await getTranslations('nav');
  const supabase = createServiceClient();

  // Fetch all SEO pages with both locale slugs
  const { data: pages } = await supabase
    .from('seo_page_content')
    .select('page_slug, page_slug_es, h1, h1_es, listing_count, filters')
    .order('listing_count', { ascending: false });

  if (!pages || pages.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="container">
          <h1 className="text-4xl font-bold mb-4">{t('heading')}</h1>
          <p className="text-stone-600">{t('description', { count: '0' })}</p>
        </div>
      </div>
    );
  }

  // Calculate unique listings accessible via SEO pages
  // Fetch all active listings (with pagination to get all 8000+)
  let allListings: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, city, state, property_type, bedrooms')
      .eq('active', true)
      .range(from, from + pageSize - 1);

    if (error || !data || data.length === 0) break;
    allListings = allListings.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Find unique listings that match at least one SEO page
  const uniqueListingIds = new Set<string>();

  allListings.forEach((listing) => {
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
              {tNav('home')}
            </Link>
            <span>/</span>
            <span className="text-stone-200">{t('heading')}</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">
            {t('heading')}
          </h1>
          <p className="text-stone-300 text-lg max-w-3xl">
            {t('description', { count: String(pages.length) })}
          </p>
        </div>
      </div>

      <div className="container py-12">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">{t('totalPages')}</h3>
            </div>
            <p className="text-3xl font-bold text-primary">{pages.length}</p>
            <p className="text-sm text-stone-600 mt-1">{t('searchVariations')}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <Home className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">{t('totalProperties')}</h3>
            </div>
            <p className="text-3xl font-bold text-primary">
              {uniqueCount.toLocaleString()}
            </p>
            <p className="text-sm text-stone-600 mt-1">{t('uniqueListings')}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-stone-200 p-6">
            <div className="flex items-center gap-3 mb-2">
              <MapPin className="h-6 w-6 text-primary" />
              <h3 className="font-semibold text-stone-900">{t('locations')}</h3>
            </div>
            <p className="text-3xl font-bold text-primary">{sortedStates.length}</p>
            <p className="text-sm text-stone-600 mt-1">{t('statesAndCities')}</p>
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
                {statePages.map((page: SEOPage) => {
                  const slug = (locale === 'es' && page.page_slug_es) ? page.page_slug_es : page.page_slug;
                  const heading = (locale === 'es' && page.h1_es) ? page.h1_es : page.h1;
                  return (
                  <Link
                    key={page.page_slug}
                    href={slug}
                    className="bg-white rounded-lg shadow-sm border border-stone-200 p-5 hover:shadow-md hover:border-primary transition-all group"
                  >
                    <h3 className="font-semibold text-stone-900 group-hover:text-primary transition-colors mb-2">
                      {heading}
                    </h3>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-stone-600">
                        {page.listing_count} {page.listing_count === 1 ? 'property' : 'properties'}
                      </span>
                      <span className="text-primary font-medium group-hover:underline">
                        {t('view')}
                      </span>
                    </div>
                  </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
