import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AlertForm } from '@/components/dashboard/alert-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'alerts' });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  return {
    title: t('createNew'),
    robots: { index: false, follow: false },
    alternates: {
      canonical: locale === 'es' ? `${baseUrl}/dashboard/alerts/new` : `${baseUrl}/en/dashboard/alerts/new`,
      languages: {
        es: `${baseUrl}/dashboard/alerts/new`,
        en: `${baseUrl}/en/dashboard/alerts/new`,
      },
    },
  };
}

interface NewAlertPageProps {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}

export default async function NewAlertPage({ searchParams }: NewAlertPageProps) {
  const params = await searchParams;
  const t = await getTranslations('alerts');

  // Pre-fill criteria from search params (when coming from "Save this search")
  const initialCriteria: Record<string, string> = {};
  const criteriaKeys = ['type', 'transaction', 'state', 'city', 'minPrice', 'maxPrice', 'bedrooms', 'bathrooms', 'parking', 'minArea', 'maxArea', 'furnished'];
  for (const key of criteriaKeys) {
    if (params[key]) {
      initialCriteria[key] = params[key]!;
    }
  }

  // Generate a default name from the criteria
  const nameParts: string[] = [];
  if (initialCriteria.type) nameParts.push(initialCriteria.type);
  if (initialCriteria.city) nameParts.push(initialCriteria.city);
  else if (initialCriteria.state) nameParts.push(initialCriteria.state);
  if (initialCriteria.maxPrice) nameParts.push(`< $${Number(initialCriteria.maxPrice).toLocaleString()}`);
  const defaultName = nameParts.length > 0 ? nameParts.join(' - ') : '';

  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-6">{t('createNew')}</h1>
      <p className="text-muted-foreground mb-8">{t('description')}</p>
      <div className="bg-white rounded-2xl border border-stone-200 p-8">
        <AlertForm
          mode="create"
          initialName={defaultName}
          initialCriteria={initialCriteria}
        />
      </div>
    </div>
  );
}
