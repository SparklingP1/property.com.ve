import { Home, Building2 } from 'lucide-react';
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

export function PropertyTypeBreakdown({ stats, locale }: PropertyTypeBreakdownProps) {
  const isEs = locale === 'es';
  const apartments = stats.find(s => s.property_type === 'apartment' && s.bedrooms_bucket === '');
  const houses = stats.find(s => s.property_type === 'house' && s.bedrooms_bucket === '');

  if (!apartments && !houses) return null;

  const types = [
    { data: apartments, label: isEs ? 'Apartamentos' : 'Apartments', icon: <Building2 className="h-6 w-6" /> },
    { data: houses, label: isEs ? 'Casas' : 'Houses', icon: <Home className="h-6 w-6" /> },
  ].filter(t => t.data);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {types.map(({ data, label, icon }) => (
        <div key={label} className="bg-white rounded-2xl shadow-sm border border-stone-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="text-amber-600">{icon}</div>
            <h3 className="text-lg font-bold text-stone-900">{label}</h3>
            <span className="ml-auto text-sm text-stone-500">
              {data!.listing_count.toLocaleString()} {isEs ? 'inmuebles' : 'listings'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-stone-500 mb-1">{isEs ? 'Precio/m²' : 'Price/sqm'}</p>
              <p className="text-2xl font-bold text-stone-900">
                {data!.median_price_per_sqm ? `${formatPrice(data!.median_price_per_sqm)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-stone-500 mb-1">{isEs ? 'Precio mediano' : 'Median price'}</p>
              <p className="text-2xl font-bold text-stone-900">
                {data!.median_price ? formatPrice(data!.median_price) : '—'}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
