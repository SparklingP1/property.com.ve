import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Building2, Search, Globe, Shield } from 'lucide-react';

interface AboutPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: AboutPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('aboutTitle'),
    description: t('defaultDescription'),
  };
}

export default async function AboutPage({ params }: AboutPageProps) {
  await params;
  const t = await getTranslations('about');

  const features = [
    {
      icon: Search,
      title: t('oneSearch'),
      description: t('oneSearchDescription'),
    },
    {
      icon: Globe,
      title: t('nationwide'),
      description: t('nationwideDescription'),
    },
    {
      icon: Building2,
      title: t('allPropertyTypes'),
      description: t('allPropertyTypesDescription'),
    },
    {
      icon: Shield,
      title: t('trustedQuality'),
      description: t('trustedQualityDescription'),
    },
  ];

  return (
    <div className="container py-12">
      {/* Hero */}
      <div className="max-w-3xl mx-auto text-center mb-16">
        <h1 className="text-3xl md:text-4xl font-bold mb-4">
          {t('heading')}
        </h1>
        <p className="text-muted-foreground text-lg">
          {t('description')}
        </p>
      </div>

      {/* Features */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="bg-white rounded-xl p-6 shadow-sm border border-border"
          >
            <feature.icon className="h-10 w-10 text-primary mb-4" />
            <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
            <p className="text-muted-foreground text-sm">{feature.description}</p>
          </div>
        ))}
      </div>

      {/* How It Works */}
      <div className="max-w-3xl mx-auto mb-16">
        <h2 className="text-2xl font-bold text-center mb-8">{t('howItWorks')}</h2>
        <div className="grid md:grid-cols-3 gap-6 text-center">
          <div>
            <div className="bg-amber-100 text-amber-700 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold mb-2">{t('weAggregate')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('weAggregateDescription')}
            </p>
          </div>
          <div>
            <div className="bg-amber-100 text-amber-700 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold mb-2">{t('youSearch')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('youSearchDescription')}
            </p>
          </div>
          <div>
            <div className="bg-amber-100 text-amber-700 w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold mb-2">{t('connectDirectly')}</h3>
            <p className="text-sm text-muted-foreground">
              {t('connectDirectlyDescription')}
            </p>
          </div>
        </div>
      </div>

      {/* Mission */}
      <div className="max-w-3xl mx-auto bg-primary-50 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">{t('ourMission')}</h2>
        <p className="text-muted-foreground">
          {t('missionStatement')}
        </p>
      </div>
    </div>
  );
}
