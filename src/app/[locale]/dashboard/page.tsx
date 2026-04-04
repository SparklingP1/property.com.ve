import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getUser } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { Link } from '@/i18n/navigation';
import { Bell, Plus, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertList } from '@/components/dashboard/alert-list';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });

  return {
    title: t('title'),
    robots: { index: false, follow: false },
  };
}

export default async function DashboardPage() {
  const user = await getUser();
  const supabase = await createClient();

  const { data: alerts } = await supabase
    .from('property_alerts')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  const activeCount = alerts?.filter((a) => a.is_active).length ?? 0;
  const totalMatches = alerts?.reduce((sum, a) => sum + (a.match_count || 0), 0) ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">{user?.email}</p>
        </div>
        <Link href="/dashboard/alerts/new">
          <Button className="bg-primary hover:bg-primary-700">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            Create Alert
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-50 rounded-lg flex items-center justify-center">
              <Bell className="h-5 w-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Alerts</p>
              <p className="text-2xl font-bold text-foreground">{activeCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-stone-200 p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-amber-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Matches</p>
              <p className="text-2xl font-bold text-foreground">{totalMatches}</p>
            </div>
          </div>
        </div>
      </div>

      <AlertList alerts={alerts ?? []} />
    </div>
  );
}
