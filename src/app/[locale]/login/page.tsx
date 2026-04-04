import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { LoginForm } from '@/components/auth/login-form';

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

export default async function LoginPage() {
  return (
    <div className="container max-w-md mx-auto py-16 px-4">
      <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <div className="text-center mb-8">
          <div className="w-12 h-12 bg-primary rounded-xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">
            Property.com.ve
          </h1>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
