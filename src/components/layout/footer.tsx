import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function Footer() {
  const t = await getTranslations('footer');
  const tMarket = await getTranslations('marketData');

  const footerLinks = {
    explore: [
      { href: '/' as const, label: t('allProperties') },
      { href: '/browse-by-area' as const, label: t('browseByArea') },
      { href: '/guides' as const, label: t('propertyGuides') },
      { href: '/find-property' as const, label: t('findProperty') },
    ],
    company: [
      { href: '/about' as const, label: t('aboutUs') },
      { href: '/list-your-property' as const, label: t('listYourProperty') },
      { href: '/disclaimer' as const, label: t('disclaimer') },
    ],
    legal: [
      { href: '/disclaimer' as const, label: t('termsOfUse') },
      { href: '/takedown' as const, label: t('takedownRequest') },
    ],
  };

  return (
    <footer className="bg-white border-t border-border mt-auto">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="font-bold text-lg text-foreground">{t('branding')}</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              {t('tagline')}
            </p>
          </div>

          {/* Explore */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">{t('explore')}</h3>
            <ul className="space-y-2">
              {footerLinks.explore.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/precios-de-casas-en-venezuela"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  {tMarket('navLabel')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">{t('company')}</h3>
            <ul className="space-y-2">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">{t('legal')}</h3>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8">
          <p className="text-sm text-muted-foreground text-center">
            {t('copyright', { year: new Date().getFullYear() })}
            <span className="block mt-1">
              {t('aggregatorNotice')}
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
}
