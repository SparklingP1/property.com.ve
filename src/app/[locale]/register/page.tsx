import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RegisterForm } from '@/components/auth/register-form';
import { Link } from '@/i18n/navigation';
import { Building2, Bell, Shield, MapPin, ArrowRight } from 'lucide-react';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });

  return {
    title: t('registerTitle'),
    description: t('registerDescription'),
    robots: { index: false, follow: false },
  };
}

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth' });
  const tHome = await getTranslations({ locale, namespace: 'homepage' });

  return (
    <div className="min-h-[80vh] flex flex-col lg:flex-row">
      {/* Left panel — immersive branding */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[48%] bg-stone-900 relative overflow-hidden">
        {/* Atmospheric gradient overlays */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_50%,rgba(13,148,136,0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_80%_20%,rgba(139,92,63,0.1),transparent_50%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-stone-950/60 to-transparent" />

        {/* Decorative grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          <div>
            <Link href="/" className="inline-flex items-center gap-3 group mb-20">
              <div className="w-11 h-11 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition-shadow">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-xl text-stone-100 group-hover:text-white transition-colors">Property.com.ve</span>
            </Link>

            <div className="max-w-md">
              <p className="text-xs font-semibold tracking-[0.2em] text-primary-400 uppercase mb-4">
                {tHome('heroTagline')}
              </p>
              <h2 className="text-4xl xl:text-[2.75rem] font-bold tracking-tight text-white leading-[1.15] mb-5">
                {tHome('heroHeadline')}
              </h2>
              <p className="text-stone-400 text-[17px] leading-relaxed mb-14">
                {tHome('heroDescription')}
              </p>
            </div>

            <div className="space-y-5">
              {[
                {
                  icon: Building2,
                  title: tHome('activeListingsValue'),
                  desc: tHome('activeListings'),
                },
                {
                  icon: Bell,
                  title: t('alertsBenefit'),
                  desc: t('alertsBenefitDescription'),
                },
                {
                  icon: Shield,
                  title: t('freeBenefit'),
                  desc: t('freeBenefitDescription'),
                },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 group/item">
                  <div className="w-11 h-11 bg-stone-800/80 border border-stone-700/50 rounded-xl flex items-center justify-center shrink-0 group-hover/item:border-primary/30 transition-colors">
                    <item.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="font-semibold text-stone-100 text-[15px]">{item.title}</p>
                    <p className="text-sm text-stone-500 leading-relaxed mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 mt-16">
            <div className="flex items-center gap-2 text-stone-600">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs">Caracas</span>
            </div>
            <div className="flex items-center gap-2 text-stone-600">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs">Valencia</span>
            </div>
            <div className="flex items-center gap-2 text-stone-600">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs">Maracaibo</span>
            </div>
            <div className="flex items-center gap-2 text-stone-600">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="text-xs">Margarita</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — register form */}
      <div className="flex-1 flex items-center justify-center px-5 py-10 lg:py-12 bg-stone-50 relative">
        {/* Subtle texture on form panel */}
        <div className="absolute inset-0 opacity-30 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.015) 1px, transparent 0)',
          backgroundSize: '24px 24px',
        }} />

        <div className="w-full max-w-[420px] relative z-10">
          {/* Mobile header */}
          <div className="lg:hidden mb-10">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-xl text-foreground">Property.com.ve</span>
            </Link>
            <h1 className="text-2xl font-bold text-foreground">{t('registerTitle')}</h1>
            <p className="text-muted-foreground mt-1.5 text-[15px] leading-relaxed">{t('registerDescription')}</p>
          </div>

          {/* Desktop heading */}
          <div className="hidden lg:block mb-8">
            <h1 className="text-[1.7rem] font-bold text-foreground tracking-tight">{t('registerTitle')}</h1>
            <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">{t('registerDescription')}</p>
          </div>

          {/* Form card */}
          <div className="bg-white rounded-2xl shadow-sm border border-stone-200/80 p-7 sm:p-8">
            <RegisterForm />
          </div>

          {/* Browse prompt */}
          <div className="mt-6 text-center">
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors group"
            >
              {tHome('startSearching')}
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
