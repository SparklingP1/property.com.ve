import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getGuides, getGuideSlugForLocale } from '@/lib/guides';

interface GuidesPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: GuidesPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  return {
    title: t('guidesTitle'),
    description: t('defaultDescription'),
    alternates: {
      canonical: locale === 'es' ? `${baseUrl}/guides` : `${baseUrl}/en/guides`,
      languages: {
        es: `${baseUrl}/guides`,
        en: `${baseUrl}/en/guides`,
      },
    },
  };
}

export default async function GuidesPage({ params }: GuidesPageProps) {
  const { locale } = await params;
  const t = await getTranslations('guides');
  const guides = getGuides(locale);

  // Group guides by category
  const categories = [...new Set(guides.map((g) => g.category))];

  return (
    <div className="container py-12">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">{t('heading')}</h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          {t('description')}
        </p>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        {categories.map((category) => (
          <Badge
            key={category}
            variant="outline"
            className="text-sm py-1 px-3 cursor-pointer hover:bg-primary hover:text-white transition-colors"
          >
            {category}
          </Badge>
        ))}
      </div>

      {/* Guides Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {guides.map((guide) => (
          <Link key={guide.slug} href={`/guides/${getGuideSlugForLocale(guide, locale)}`}>
            <Card className="h-full card-hover">
              <CardHeader>
                <Badge variant="outline" className="w-fit mb-2">
                  {guide.category}
                </Badge>
                <CardTitle className="text-xl leading-tight">
                  {guide.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  {guide.description}
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  {t('published')} {new Date(guide.publishedAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
