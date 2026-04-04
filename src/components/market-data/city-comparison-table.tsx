import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { MarketStat } from '@/lib/supabase/market-data-queries';

interface CityComparisonTableProps {
  cities: MarketStat[];
  locale: string;
  cityUrlPrefix: string;
}

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

export function CityComparisonTable({ cities, locale, cityUrlPrefix }: CityComparisonTableProps) {
  const isEs = locale === 'es';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b-2 border-stone-200">
            <th className="py-3 px-4 text-sm font-semibold text-stone-600 uppercase tracking-wide">
              {isEs ? 'Ciudad' : 'City'}
            </th>
            <th className="py-3 px-4 text-sm font-semibold text-stone-600 uppercase tracking-wide text-right">
              {isEs ? 'Precio/m²' : 'Price/sqm'}
            </th>
            <th className="py-3 px-4 text-sm font-semibold text-stone-600 uppercase tracking-wide text-right">
              {isEs ? 'Precio Mediano' : 'Median Price'}
            </th>
            <th className="py-3 px-4 text-sm font-semibold text-stone-600 uppercase tracking-wide text-right">
              {isEs ? 'Inmuebles' : 'Listings'}
            </th>
            <th className="py-3 px-4 text-sm font-semibold text-stone-600 uppercase tracking-wide text-right">
              {isEs ? 'Cambio' : 'Change'}
            </th>
          </tr>
        </thead>
        <tbody>
          {cities.map((city, i) => (
            <tr key={city.city} className={`border-b border-stone-100 ${i % 2 === 0 ? 'bg-stone-50/50' : ''} hover:bg-amber-50/50 transition-colors`}>
              <td className="py-4 px-4">
                <a
                  href={`${cityUrlPrefix}${slugify(city.city)}/`}
                  className="font-medium text-stone-900 hover:text-amber-700 transition-colors"
                >
                  {city.city}
                </a>
                <span className="text-stone-400 text-sm ml-2">{city.state}</span>
              </td>
              <td className="py-4 px-4 text-right font-semibold text-stone-900">
                {city.median_price_per_sqm ? `${formatPrice(city.median_price_per_sqm)}/m²` : '—'}
              </td>
              <td className="py-4 px-4 text-right text-stone-700">
                {city.median_price ? formatPrice(city.median_price) : '—'}
              </td>
              <td className="py-4 px-4 text-right text-stone-600">
                {city.listing_count.toLocaleString()}
              </td>
              <td className="py-4 px-4 text-right">
                {city.price_change_pct !== null ? (
                  <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                    city.price_change_pct > 0 ? 'text-green-600' :
                    city.price_change_pct < 0 ? 'text-red-600' : 'text-stone-500'
                  }`}>
                    {city.price_change_pct > 0 ? <TrendingUp className="h-3.5 w-3.5" /> :
                     city.price_change_pct < 0 ? <TrendingDown className="h-3.5 w-3.5" /> :
                     <Minus className="h-3.5 w-3.5" />}
                    {city.price_change_pct > 0 ? '+' : ''}{city.price_change_pct}%
                  </span>
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
