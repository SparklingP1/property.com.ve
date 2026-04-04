import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { Bell, Plus } from 'lucide-react';
import { AlertCard } from './alert-card';

interface Alert {
  id: string;
  name: string;
  criteria: Record<string, string>;
  is_active: boolean;
  match_count: number;
  last_notified_at: string | null;
  created_at: string;
}

interface AlertListProps {
  alerts: Alert[];
}

export async function AlertList({ alerts }: AlertListProps) {
  const t = await getTranslations('dashboard');

  if (alerts.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
        <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Bell className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{t('noAlertsYet')}</h3>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">{t('noAlertsDescription')}</p>
        <Link href="/dashboard/alerts/new">
          <Button className="bg-primary hover:bg-primary-700">
            <Plus className="h-4 w-4 mr-2" aria-hidden="true" />
            {t('createFirstAlert')}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t('myAlerts')}</h2>
      </div>
      {alerts.map((alert) => (
        <AlertCard key={alert.id} alert={alert} />
      ))}
    </div>
  );
}
