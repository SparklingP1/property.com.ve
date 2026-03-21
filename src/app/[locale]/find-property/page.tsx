import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { BuyerLeadForm } from '@/components/forms/buyer-lead-form';

interface FindPropertyPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: FindPropertyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('findPropertyTitle'),
    description: t('defaultDescription'),
  };
}

export default async function FindPropertyPage({ params }: FindPropertyPageProps) {
  await params;
  const t = await getTranslations('findProperty');

  return (
    <div className="container py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t('heading')}
          </h1>
          <p className="text-muted-foreground text-lg">
            {t('description')}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-border p-6 md:p-8">
          <BuyerLeadForm />
        </div>

        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>
            {t('security')}
          </p>
        </div>
      </div>
    </div>
  );
}
