import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

interface DisclaimerPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: DisclaimerPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  return {
    title: t('disclaimerTitle'),
    description: t('defaultDescription'),
  };
}

export default async function DisclaimerPage({ params }: DisclaimerPageProps) {
  await params;
  const t = await getTranslations('disclaimer');

  return (
    <div className="container py-12">
      <div className="max-w-3xl mx-auto prose prose-neutral">
        <h1>{t('heading')}</h1>
        <p className="lead">
          {t('intro')}
        </p>

        <h2>{t('notRealEstateAgency')}</h2>
        <p>
          {t('notRealEstateAgencyContent')}
        </p>

        <h2>{t('thirdPartyListings')}</h2>
        <p>
          {t('thirdPartyListingsContent')}
        </p>

        <h2>{t('accuracyOfInformation')}</h2>
        <p>
          {t('accuracyOfInformationContent')}
        </p>

        <h2>{t('investmentRisks')}</h2>
        <p>
          {t('investmentRisksContent')}
        </p>

        <h2>{t('noProfessionalAdvice')}</h2>
        <p>
          {t('noProfessionalAdviceContent')}
        </p>

        <h2>{t('externalLinks')}</h2>
        <p>
          {t('externalLinksContent')}
        </p>

        <h2>{t('contactOriginalListing')}</h2>
        <p>
          {t('contactOriginalListingContent')}
        </p>

        <h2>{t('takedownRequests')}</h2>
        <p>
          {t('takedownRequestsContent')}{' '}
          <Link href="/takedown" className="text-primary hover:underline">
            {t('takedownRequests').toLowerCase()}
          </Link>.
        </p>

        <h2>{t('changes')}</h2>
        <p>
          {t('changesContent')}
        </p>

        <h2>{t('contactUs')}</h2>
        <p>
          {t('contactUsContent')}
        </p>

        <p className="text-sm text-muted-foreground mt-8">
          {t('lastUpdated')}
        </p>
      </div>
    </div>
  );
}
