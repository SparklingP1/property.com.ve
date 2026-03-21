import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { TakedownForm } from '@/components/forms/takedown-form';

interface TakedownPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: TakedownPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('takedownTitle'),
    description: t('defaultDescription'),
  };
}

export default async function TakedownPage({ params }: TakedownPageProps) {
  await params;
  const t = await getTranslations('takedown');

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
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-amber-800 mb-2">
              {t('beforeYouSubmit')}
            </h3>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>
                {t('beforeItem1')}
              </li>
              <li>
                {t('beforeItem2')}
              </li>
              <li>
                {t('beforeItem3')}
              </li>
            </ul>
          </div>

          <TakedownForm />
        </div>

        <div className="mt-8 text-center">
          <p className="text-muted-foreground text-sm">
            {t('notice')}
          </p>
        </div>
      </div>
    </div>
  );
}
