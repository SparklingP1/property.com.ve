import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';
import { Bell, Search, Shield } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  return {
    title: t('logInTitle'),
    description: t('logInDescription'),
    robots: { index: false, follow: false },
    alternates: {
      canonical: locale === 'es' ? `${baseUrl}/login` : `${baseUrl}/en/login`,
      languages: {
        es: `${baseUrl}/login`,
        en: `${baseUrl}/en/login`,
      },
    },
  };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return (
    <div className="min-h-[80vh] flex items-center justify-center bg-stone-50 px-4 py-12">
      <div className="w-full max-w-[440px]">
        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">{t('logInTitle')}</h1>
          <p className="text-muted-foreground mt-2 text-[15px]">{t('logInDescription')}</p>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 p-7 sm:p-8">
          <LoginForm />
        </div>

        {/* Value props — subtle, below the form */}
        <div className="mt-10 flex items-center justify-center gap-8 text-xs text-stone-400">
          <div className="flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('saveBenefit')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Bell className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('alertsBenefitShort')}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{t('freeBenefitShort')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
