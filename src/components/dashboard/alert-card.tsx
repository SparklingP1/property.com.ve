'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { deleteAlert, toggleAlert } from '@/actions/alerts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Pencil, Trash2, Pause, Play } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';

interface AlertCardProps {
  alert: {
    id: string;
    name: string;
    criteria: Record<string, string>;
    is_active: boolean;
    match_count: number;
    last_notified_at: string | null;
    created_at: string;
  };
}

const CRITERIA_LABELS: Record<string, string> = {
  type: 'Type',
  transaction: 'Transaction',
  state: 'State',
  city: 'City',
  minPrice: 'Min Price',
  maxPrice: 'Max Price',
  bedrooms: 'Beds',
  bathrooms: 'Baths',
  parking: 'Parking',
  minArea: 'Min Area',
  maxArea: 'Max Area',
  furnished: 'Furnished',
};

export function AlertCard({ alert }: AlertCardProps) {
  const [loading, setLoading] = useState(false);
  const t = useTranslations('alerts');
  const router = useRouter();

  const handleToggle = async () => {
    setLoading(true);
    await toggleAlert(alert.id, !alert.is_active);
    setLoading(false);
    router.refresh();
  };

  const handleDelete = async () => {
    if (!confirm(t('confirmDelete'))) return;
    setLoading(true);
    await deleteAlert(alert.id);
    router.refresh();
  };

  const criteriaEntries = Object.entries(alert.criteria).filter(
    ([key, value]) => value && key !== 'sort' && key !== 'q'
  );

  return (
    <div className="bg-white rounded-2xl border border-stone-200 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold text-foreground truncate">{alert.name}</h3>
            <Badge variant={alert.is_active ? 'default' : 'secondary'} className="shrink-0">
              {alert.is_active ? t('active') : t('paused')}
            </Badge>
          </div>

          {criteriaEntries.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {criteriaEntries.map(([key, value]) => (
                <span
                  key={key}
                  className="inline-flex items-center text-xs bg-stone-100 text-stone-600 px-2 py-1 rounded-md"
                >
                  {CRITERIA_LABELS[key] || key}: {value}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span>{t('matches', { count: alert.match_count })}</span>
            <span>
              {alert.last_notified_at
                ? t('lastNotified', { date: new Date(alert.last_notified_at).toLocaleDateString() })
                : t('neverNotified')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Link href={`/dashboard/alerts/${alert.id}/edit`}>
            <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t('editAlert')}>
              <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleToggle}
            disabled={loading}
            aria-label={alert.is_active ? t('pause') : t('resume')}
          >
            {alert.is_active
              ? <Pause className="h-3.5 w-3.5" aria-hidden="true" />
              : <Play className="h-3.5 w-3.5" aria-hidden="true" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={handleDelete}
            disabled={loading}
            aria-label={t('delete')}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
