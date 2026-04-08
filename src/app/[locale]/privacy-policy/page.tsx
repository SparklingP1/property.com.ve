import { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

interface PrivacyPolicyPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({
  params,
}: PrivacyPolicyPageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'metadata' });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  return {
    title: t('privacyPolicyTitle'),
    description: t('defaultDescription'),
    alternates: {
      canonical: locale === 'es' ? `${baseUrl}/privacy-policy` : `${baseUrl}/en/privacy-policy`,
      languages: {
        es: `${baseUrl}/privacy-policy`,
        en: `${baseUrl}/en/privacy-policy`,
      },
    },
  };
}

export default async function PrivacyPolicyPage({ params }: PrivacyPolicyPageProps) {
  await params;
  const t = await getTranslations('privacyPolicy');

  return (
    <div className="container py-12">
      <div className="max-w-3xl mx-auto prose prose-neutral">
        <h1>{t('heading')}</h1>
        <p className="lead">
          {t('intro')}
        </p>

        <h2>{t('googleApiCompliance')}</h2>
        <p>
          {t('googleApiComplianceContent').split('Google API Services User Data Policy')[0]}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t('googleApiPolicyLinkText')}
          </a>
          {t('googleApiComplianceContent').split('Google API Services User Data Policy')[1]?.split('Limited Use requirements')[0]}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline"
          >
            {t('limitedUseLinkText')}
          </a>
          .
        </p>

        <h2>{t('limitedUse')}</h2>
        <p>{t('limitedUseContent')}</p>
        <ul>
          <li>{t('limitedUseItem1')}</li>
          <li>{t('limitedUseItem2')}</li>
          <li>{t('limitedUseItem3')}</li>
          <li>{t('limitedUseItem4')}</li>
        </ul>

        <h2>{t('scopesRequested')}</h2>
        <p>{t('scopesRequestedContent')}</p>
        <ul>
          <li><strong>openid</strong> — {t('scopeOpenid').split('— ')[1]}</li>
          <li><strong>email</strong> — {t('scopeEmail').split('— ')[1]}</li>
          <li><strong>profile</strong> — {t('scopeProfile').split('— ')[1]}</li>
        </ul>

        <h2>{t('dataAccessed')}</h2>
        <p>{t('dataAccessedContent')}</p>

        <h2>{t('dataUsage')}</h2>
        <p>{t('dataUsageContent')}</p>

        <h2>{t('dataSharing')}</h2>
        <p>{t('dataSharingContent')}</p>

        <h2>{t('dataStorage')}</h2>
        <p>{t('dataStorageContent')}</p>

        <h2>{t('dataRetention')}</h2>
        <p>{t('dataRetentionContent')}</p>

        <h2>{t('contactUs')}</h2>
        <p>{t('contactUsContent')}</p>

        <p className="text-sm text-muted-foreground mt-8">
          {t('lastUpdated')}
        </p>
      </div>
    </div>
  );
}
