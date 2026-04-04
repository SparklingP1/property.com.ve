import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';
import { Link } from '@/i18n/navigation';
import { Building2, Bell, Shield } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return {
    title: t('logInTitle'),
    description: t('logInDescription'),
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  const tHome = await getTranslations({ locale, namespace: 'homepage' });

  return (
    <div className="min-h-[80vh] flex">
      {/* Left panel — branding + value props (hidden on mobile) */}
      <div className="hidden lg:flex lg:w-5/12 bg-stone-900 text-stone-50 flex-col justify-between p-12">
        <div>
          <Link href="/" className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
              <span className="text-white font-bold text-lg">P</span>
            </div>
            <span className="font-bold text-xl">Property.com.ve</span>
          </Link>

          <h2 className="text-3xl font-bold tracking-tight mb-4">
            {tHome('heroHeadline')}
          </h2>
          <p className="text-stone-400 text-lg mb-12">
            {tHome('heroDescription')}
          </p>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-stone-800 rounded-lg flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-stone-200">{tHome('activeListingsValue')}</p>
                <p className="text-sm text-stone-500">{tHome('activeListings')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-stone-800 rounded-lg flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-stone-200">{t('alertsBenefit')}</p>
                <p className="text-sm text-stone-500">{t('alertsBenefitDescription')}</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-stone-800 rounded-lg flex items-center justify-center shrink-0">
                <Shield className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-stone-200">{t('freeBenefit')}</p>
                <p className="text-sm text-stone-500">{t('freeBenefitDescription')}</p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-xs text-stone-600">
          © {new Date().getFullYear()} Property.com.ve
        </p>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 bg-stone-50">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-xl text-foreground">Property.com.ve</span>
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">{t('logInTitle')}</h1>
              <p className="text-muted-foreground mt-1 text-sm">{t('logInDescription')}</p>
            </div>
            <LoginForm />
          </div>
        </div>
      </div>
    </div>
  );
}
