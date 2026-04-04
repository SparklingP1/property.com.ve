import { Building2, Home } from 'lucide-react';
import type { ReactElement } from 'react';
import { formatMarketCount } from '@/lib/market-data';
import type { MarketStat } from '@/lib/supabase/market-data-queries';

interface PropertyTypeBreakdownProps {
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

export function PropertyTypeBreakdown({
  stats,
  locale,
}: PropertyTypeBreakdownProps) {
  const isEs = locale === 'es';
  const apartments = stats.find(
    (stat) => stat.property_type === 'apartment' && stat.bedrooms_bucket === ''
  );
  const houses = stats.find(
    (stat) => stat.property_type === 'house' && stat.bedrooms_bucket === ''
  );

  if (!apartments && !houses) {
    return null;
  }

  const types: Array<{
    data: MarketStat;
    label: string;
    icon: ReactElement;
  }> = [];

  if (apartments) {
    types.push({
      data: apartments,
      label: isEs ? 'Apartamentos' : 'Apartments',
      icon: <Building2 className="h-6 w-6" />,
    });
  }

  if (houses) {
    types.push({
      data: houses,
      label: isEs ? 'Casas' : 'Houses',
      icon: <Home className="h-6 w-6" />,
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {types.map(({ data, label, icon }) => (
        <div
          key={label}
          className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-4 flex items-center gap-3">
            <div className="text-amber-600">{icon}</div>
            <h3 className="text-lg font-bold text-stone-900">{label}</h3>
            <span className="ml-auto text-sm text-stone-500">
              {formatMarketCount(data.listing_count, locale)}{' '}
              {isEs ? 'inmuebles' : 'listings'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="mb-1 text-sm text-stone-500">
                {isEs ? 'Precio/m²' : 'Price/sqm'}
              </p>
              <p className="text-2xl font-bold text-stone-900">
                {data.median_price_per_sqm
                  ? formatPrice(data.median_price_per_sqm)
                  : '—'}
              </p>
            </div>
            <div>
              <p className="mb-1 text-sm text-stone-500">
                {isEs ? 'Precio mediano' : 'Median price'}
              </p>
              <p className="text-2xl font-bold text-stone-900">
                {data.median_price ? formatPrice(data.median_price) : '—'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
