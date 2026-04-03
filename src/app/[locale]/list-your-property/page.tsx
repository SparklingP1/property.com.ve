import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AgentSignupForm } from '@/components/forms/agent-signup-form';
import { CheckCircle } from 'lucide-react';

interface ListPropertyPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: ListPropertyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  return {
    title: t('listPropertyTitle'),
    description: t('defaultDescription'),
    alternates: {
      canonical: locale === 'es' ? `${baseUrl}/list-your-property` : `${baseUrl}/en/list-your-property`,
      languages: {
        es: `${baseUrl}/list-your-property`,
        en: `${baseUrl}/en/list-your-property`,
      },
    },
  };
}

export default async function ListPropertyPage({ params }: ListPropertyPageProps) {
  await params;
  const t = await getTranslations('listProperty');

  const benefits = [
    t('benefit1'),
    t('benefit2'),
    t('benefit3'),
    t('benefit4'),
  ];

  return (
    <div className="container py-12">
      <div className="grid md:grid-cols-2 gap-12 max-w-5xl mx-auto">
        {/* Left Column - Info */}
        <div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            {t('heading')}
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            {t('description')}
          </p>

          <div className="space-y-4 mb-8">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="bg-primary-50 rounded-xl p-6">
            <h3 className="font-semibold mb-2">{t('howItWorks')}</h3>
            <ol className="list-decimal list-inside space-y-2 text-muted-foreground text-sm">
              <li>{t('step1')}</li>
              <li>{t('step2')}</li>
              <li>{t('step3')}</li>
              <li>{t('step4')}</li>
            </ol>
          </div>
        </div>

        {/* Right Column - Form */}
        <div>
          <div className="bg-white rounded-xl shadow-sm border border-border p-6 md:p-8">
            <h2 className="text-xl font-semibold mb-6">{t('agentSignup')}</h2>
            <AgentSignupForm />
          </div>
        </div>
      </div>
    </div>
  );
}
