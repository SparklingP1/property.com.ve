'use client';

import { useState, useEffect, useCallback } from 'react';
import { useLocale } from 'next-intl';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';
import { Menu, X, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const t = useTranslations('nav');
  const tHeader = useTranslations('header');
  const locale = useLocale();
  const pathname = usePathname();

  // Close mobile menu on Escape key
  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeMobileMenu();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen, closeMobileMenu]);

  const navLinks = [
    { href: '/' as const, label: t('home') },
    { href: '/search' as const, label: t('search') },
    { href: '/guides' as const, label: t('guides') },
    { href: '/find-property' as const, label: t('findProperty') },
    { href: '/list-your-property' as const, label: t('listProperty') },
    { href: '/about' as const, label: t('about') },
  ];

  return (
    <header className="bg-white border-b border-border sticky top-0 z-50">
      <nav className="container flex items-center justify-between h-16">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">P</span>
          </div>
          <span className="font-bold text-xl text-foreground">{tHeader('branding')}</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              {link.label}
            </Link>
          ))}
          {/* Language Switcher */}
          <Link
            href={pathname}
            locale={locale === 'es' ? 'en' : 'es'}
            className="text-sm font-semibold px-3 py-1 rounded-md border border-stone-300 hover:bg-stone-50 transition-colors flex items-center gap-1.5"
          >
            <Globe className="h-3.5 w-3.5" />
            {tHeader('langSwitch')}
          </Link>
        </div>

        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-expanded={mobileMenuOpen}
          aria-label={mobileMenuOpen ? t('closeMenu') : t('openMenu')}
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </nav>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-border bg-white">
          <div className="container py-4 flex flex-col gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors py-2 text-sm font-medium"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            {/* Mobile Language Switcher */}
            <Link
              href={pathname}
              locale={locale === 'es' ? 'en' : 'es'}
              className="text-sm font-semibold py-2 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
              onClick={() => setMobileMenuOpen(false)}
            >
              <Globe className="h-3.5 w-3.5" />
              {tHeader('langSwitch')}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
