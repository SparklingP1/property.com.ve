import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { LayoutDashboard, Bell } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}

export default async function DashboardLayout({
  children,
  params,
}: DashboardLayoutProps) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  const navItems = [
    { href: '/dashboard' as const, label: t('overview'), icon: LayoutDashboard },
    { href: '/dashboard/alerts/new' as const, label: t('createAlert'), icon: Bell },
  ];

  return (
    <div className="container py-8">
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-64 shrink-0">
          <nav className="bg-white rounded-2xl border border-stone-200 p-4 space-y-1 sticky top-24">
            <h2 className="font-semibold text-lg text-foreground px-3 py-2">{t('title')}</h2>
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-stone-50 transition-colors"
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">
          {children}
        </main>
      </div>
    </div>
  );
}
