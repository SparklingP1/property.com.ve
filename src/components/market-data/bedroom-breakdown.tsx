import { Bed } from 'lucide-react';
import { formatMarketCount } from '@/lib/market-data';
import type { MarketStat } from '@/lib/supabase/market-data-queries';

interface BedroomBreakdownProps {
  stats: MarketStat[];
  locale: string;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

const BUCKET_LABELS_ES: Record<string, string> = {
  '1': '1 Hab.',
  '2': '2 Hab.',
  '3': '3 Hab.',
  '4+': '4+ Hab.',
};

const BUCKET_LABELS_EN: Record<string, string> = {
  '1': '1 Bed',
  '2': '2 Bed',
  '3': '3 Bed',
  '4+': '4+ Bed',
};

const BUCKET_ORDER = ['1', '2', '3', '4+'];

export function BedroomBreakdown({ stats, locale }: BedroomBreakdownProps) {
  const isEs = locale === 'es';
  const labels = isEs ? BUCKET_LABELS_ES : BUCKET_LABELS_EN;

  const bedroomStats = BUCKET_ORDER
    .map((bucket) =>
      stats.find(
        (stat) => stat.bedrooms_bucket === bucket && stat.property_type === ''
      )
    )
    .filter((stat): stat is MarketStat => stat !== undefined && stat !== null);

  if (bedroomStats.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
      {bedroomStats.map((stat) => (
        <div
          key={stat.bedrooms_bucket}
          className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
        >
          <div className="mb-3 flex items-center gap-2">
            <Bed className="h-5 w-5 text-amber-600" />
            <span className="font-bold text-stone-900">
              {labels[stat.bedrooms_bucket]}
            </span>
          </div>
          <p className="text-xl font-bold text-stone-900">
            {stat.median_price_per_sqm
              ? `${formatPrice(stat.median_price_per_sqm)}/m²`
              : '—'}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {formatMarketCount(stat.listing_count, locale)}{' '}
            {isEs ? 'inmuebles' : 'listings'}
          </p>
        </div>
      ))}
    </div>
  );
}
