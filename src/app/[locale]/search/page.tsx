import { Metadata } from 'next';
import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { CollapsibleFilters } from '@/components/search/collapsible-filters';
import { SearchResults } from '@/components/search/search-results';
import { ListingSkeleton } from '@/components/listings/listing-skeleton';

interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export async function generateMetadata({
  params,
}: SearchPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'search' });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  return {
    title: `${t('pageTitle')} | Property.com.ve`,
    description: t('pageSubtitle'),
    robots: {
      index: false,
      follow: true,
    },
    alternates: {
      canonical: locale === 'es' ? `${baseUrl}/search` : `${baseUrl}/en/search`,
      languages: {
        es: `${baseUrl}/search`,
        en: `${baseUrl}/en/search`,
      },
    },
  };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  await params;
  const resolvedParams = await searchParams;
  const t = await getTranslations('search');
  const tNav = await getTranslations('nav');

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-stone-900 text-stone-50 py-12">
        <div className="container">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-stone-400 text-sm mb-4" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-stone-200">
              {tNav('home')}
            </Link>
            <span>/</span>
            <span className="text-stone-200">{tNav('search')}</span>
          </nav>
          <h1 className="text-4xl md:text-5xl font-bold mb-3 tracking-tight">
            {t('pageTitle')}
          </h1>
          <p className="text-stone-300 text-lg max-w-2xl">
            {t('pageSubtitle')}
          </p>
        </div>
      </div>

      {/* Search Interface */}
      <div className="container py-8">
        <CollapsibleFilters>
          <Suspense fallback={<ListingSkeleton count={12} />}>
            <SearchResults searchParams={resolvedParams} />
          </Suspense>
        </CollapsibleFilters>
      </div>
    </div>
  );
}
