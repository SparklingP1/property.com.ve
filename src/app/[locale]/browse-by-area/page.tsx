import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Building2, Home, Map, MapPin } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { createServiceClient } from '@/lib/supabase/server';

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

interface ListingCoverageRow {
  id: string;
  city: string | null;
  state: string | null;
  property_type: string | null;
  bedrooms: number | null;
}

interface LocationGroup {
  name: string;
  pages: SEOPage[];
  totalListings: number;
}

function buildLocationGroups(pages: SEOPage[], key: 'city' | 'state'): LocationGroup[] {
  const grouped = pages.reduce((acc, page) => {
    const location = page.filters[key];

    if (!location) {
      return acc;
    }

    if (!acc[location]) {
      acc[location] = [];
    }

    acc[location].push(page);
    return acc;
  }, {} as Record<string, SEOPage[]>);

  return Object.entries(grouped)
    .map(([name, groupPages]) => ({
      name,
      pages: groupPages,
      totalListings: groupPages.reduce((sum, page) => sum + page.listing_count, 0),
    }))
    .sort((a, b) => b.totalListings - a.totalListings);
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : plural}`;
}

function getPropertyTypeLabel(propertyType: string, locale: string) {
  const isEs = locale === 'es';

  switch (propertyType) {
    case 'apartment':
      return isEs ? 'Apartamentos' : 'Apartments';
    case 'house':
      return isEs ? 'Casas' : 'Houses';
    case 'land':
      return isEs ? 'Terrenos' : 'Land';
    case 'commercial':
      return isEs ? 'Comercial' : 'Commercial';
    case 'office':
      return isEs ? 'Oficinas' : 'Offices';
    default:
      return propertyType;
  }
}

function getPageHighlights(page: SEOPage, locale: string) {
  const isEs = locale === 'es';
  const highlights: string[] = [];

  if (page.filters.property_type) {
    highlights.push(getPropertyTypeLabel(page.filters.property_type, locale));
  }

  if (page.filters.bedrooms) {
    highlights.push(isEs ? `${page.filters.bedrooms} hab.` : `${page.filters.bedrooms} bed`);
  }

  return highlights;
}

export async function generateMetadata({
  params,
}: BrowseByAreaPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'browseByArea' });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  return {
    title: t('heading'),
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
  const isEs = locale === 'es';
  const t = await getTranslations('browseByArea');
  const tNav = await getTranslations('nav');
  const supabase = createServiceClient();

  const { data: pages } = await supabase
    .from('seo_page_content')
    .select('page_slug, page_slug_es, h1, h1_es, listing_count, filters')
    .order('listing_count', { ascending: false });

  if (!pages || pages.length === 0) {
    return (
      <div className="min-h-screen bg-stone-50 py-12">
        <div className="container">
          <h1 className="mb-4 text-4xl font-bold">{t('heading')}</h1>
          <p className="text-stone-600">{t('description', { count: '0' })}</p>
        </div>
      </div>
    );
  }

  const seoPages = pages as SEOPage[];

  let allListings: ListingCoverageRow[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('id, city, state, property_type, bedrooms')
      .eq('active', true)
      .range(from, from + pageSize - 1);

    if (error || !data || data.length === 0) {
      break;
    }

    allListings = allListings.concat(data);

    if (data.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  const uniqueListingIds = new Set<string>();

  allListings.forEach((listing) => {
    const matchesAnyPage = seoPages.some((page) => {
      const filters = page.filters;

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
  const cityGroups = buildLocationGroups(
    seoPages.filter((page) => Boolean(page.filters.city)),
    'city'
  );
  const stateGroups = buildLocationGroups(
    seoPages.filter((page) => Boolean(page.filters.state) && !page.filters.city),
    'state'
  );
  const broaderPages = seoPages.filter((page) => !page.filters.city && !page.filters.state);
  const locationCount = cityGroups.length + stateGroups.length;

  const sections = [
    {
      key: 'cities',
      title: isEs ? 'Explorar por ciudad' : 'Browse by city',
      description: isEs
        ? 'Las ciudades con mayor cobertura y con mas combinaciones utiles de filtros.'
        : 'Cities with the deepest inventory coverage and the most useful filter combinations.',
      groups: cityGroups,
      icon: Building2,
    },
    {
      key: 'states',
      title: isEs ? 'Explorar por estado' : 'Browse by state',
      description: isEs
        ? 'Paginas mas amplias para descubrir inventario disponible en cada estado.'
        : 'Broader regional pages for discovering inventory across each state.',
      groups: stateGroups,
      icon: Map,
    },
  ].filter((section) => section.groups.length > 0);

  return (
    <div className="min-h-screen bg-stone-50">
      <div className="bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 py-16 text-stone-50">
        <div className="container">
          <div className="mb-4 flex items-center gap-2 text-sm text-stone-400">
            <Link href="/" className="hover:text-stone-200">
              {tNav('home')}
            </Link>
            <span>/</span>
            <span className="text-stone-200">{t('heading')}</span>
          </div>

          <h1 className="mb-4 text-4xl font-bold tracking-tight md:text-5xl">{t('heading')}</h1>
          <p className="max-w-3xl text-lg text-stone-300">
            {t('description', { count: String(seoPages.length) })}
          </p>
        </div>
      </div>

      <div className="container py-12">
        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <MapPin className="h-6 w-6 text-primary" />
              <h2 className="font-semibold text-stone-900">{t('totalPages')}</h2>
            </div>
            <p className="text-3xl font-bold text-primary">{seoPages.length}</p>
            <p className="mt-1 text-sm text-stone-600">{t('searchVariations')}</p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <Home className="h-6 w-6 text-primary" />
              <h2 className="font-semibold text-stone-900">{t('totalProperties')}</h2>
            </div>
            <p className="text-3xl font-bold text-primary">{uniqueCount.toLocaleString()}</p>
            <p className="mt-1 text-sm text-stone-600">{t('uniqueListings')}</p>
          </div>

          <div className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="mb-2 flex items-center gap-3">
              <Map className="h-6 w-6 text-primary" />
              <h2 className="font-semibold text-stone-900">{t('locations')}</h2>
            </div>
            <p className="text-3xl font-bold text-primary">{locationCount}</p>
            <p className="mt-1 text-sm text-stone-600">{t('statesAndCities')}</p>
          </div>
        </div>

        <div className="space-y-12">
          {sections.map((section) => {
            const SectionIcon = section.icon;

            return (
              <section key={section.key}>
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <div className="mb-2 flex items-center gap-3">
                      <SectionIcon className="h-5 w-5 text-primary" />
                      <h2 className="text-2xl font-bold text-stone-900">{section.title}</h2>
                    </div>
                    <p className="max-w-3xl text-stone-600">{section.description}</p>
                  </div>
                  <span className="whitespace-nowrap text-sm text-stone-500">
                    {formatCountLabel(
                      section.groups.length,
                      isEs ? 'zona' : 'area',
                      isEs ? 'zonas' : 'areas'
                    )}
                  </span>
                </div>

                <div className="space-y-8">
                  {section.groups.map((group) => (
                    <div key={group.name}>
                      <div className="mb-4 flex items-center justify-between gap-4">
                        <h3 className="text-xl font-semibold text-stone-900">{group.name}</h3>
                        <span className="text-sm text-stone-600">
                          {formatCountLabel(
                            group.totalListings,
                            isEs ? 'inmueble' : 'property',
                            isEs ? 'inmuebles' : 'properties'
                          )}
                          {' \u2022 '}
                          {formatCountLabel(
                            group.pages.length,
                            isEs ? 'pagina' : 'page',
                            isEs ? 'paginas' : 'pages'
                          )}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {group.pages.map((page) => {
                          const slug = locale === 'es' && page.page_slug_es ? page.page_slug_es : page.page_slug;
                          const heading = locale === 'es' && page.h1_es ? page.h1_es : page.h1;
                          const highlights = getPageHighlights(page, locale);

                          return (
                            <Link
                              key={page.page_slug}
                              href={slug}
                              className="group rounded-lg border border-stone-200 bg-white p-5 shadow-sm transition-all hover:border-primary hover:shadow-md"
                            >
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <h4 className="font-semibold text-stone-900 transition-colors group-hover:text-primary">
                                  {heading}
                                </h4>
                                <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">
                                  {formatCountLabel(
                                    page.listing_count,
                                    isEs ? 'inmueble' : 'property',
                                    isEs ? 'inmuebles' : 'properties'
                                  )}
                                </span>
                              </div>

                              {highlights.length > 0 && (
                                <div className="mb-3 flex flex-wrap gap-2">
                                  {highlights.map((highlight) => (
                                    <span
                                      key={highlight}
                                      className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-600"
                                    >
                                      {highlight}
                                    </span>
                                  ))}
                                </div>
                              )}

                              <span className="text-sm font-medium text-primary group-hover:underline">
                                {isEs ? 'Ver resultados' : 'View results'}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          {broaderPages.length > 0 && (
            <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="mb-2 text-2xl font-bold text-stone-900">
                    {isEs ? 'Mas formas de explorar' : 'More ways to browse'}
                  </h2>
                  <p className="text-stone-600">
                    {isEs
                      ? 'Paginas adicionales para explorar el inventario nacional por tipo de inmueble o caracteristicas.'
                      : 'Additional pages for exploring national inventory by property type or other key criteria.'}
                  </p>
                </div>
                <span className="whitespace-nowrap text-sm text-stone-500">
                  {formatCountLabel(
                    broaderPages.length,
                    isEs ? 'pagina' : 'page',
                    isEs ? 'paginas' : 'pages'
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {broaderPages.map((page) => {
                  const slug = locale === 'es' && page.page_slug_es ? page.page_slug_es : page.page_slug;
                  const heading = locale === 'es' && page.h1_es ? page.h1_es : page.h1;
                  const highlights = getPageHighlights(page, locale);

                  return (
                    <Link
                      key={page.page_slug}
                      href={slug}
                      className="group rounded-lg border border-stone-200 p-5 transition-all hover:border-primary hover:shadow-md"
                    >
                      <h3 className="mb-3 font-semibold text-stone-900 transition-colors group-hover:text-primary">
                        {heading}
                      </h3>

                      {highlights.length > 0 && (
                        <div className="mb-3 flex flex-wrap gap-2">
                          {highlights.map((highlight) => (
                            <span
                              key={highlight}
                              className="rounded-full border border-stone-200 px-2.5 py-1 text-xs text-stone-600"
                            >
                              {highlight}
                            </span>
                          ))}
                        </div>
                      )}

                      <span className="text-sm font-medium text-primary group-hover:underline">
                        {formatCountLabel(
                          page.listing_count,
                          isEs ? 'inmueble' : 'property',
                          isEs ? 'inmuebles' : 'properties'
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
