import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  formatMarketCount,
  getMarketDataCityPath,
  slugifyMarketCity,
} from '@/lib/market-data';
import type { MarketStat } from '@/lib/supabase/market-data-queries';

interface CityComparisonTableProps {
  cities: MarketStat[];
  locale: string;
}

function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(price);
}

function getCityHref(city: string, locale: string) {
  return getMarketDataCityPath(slugifyMarketCity(city), locale);
}

export function CityComparisonTable({
  cities,
  locale,
}: CityComparisonTableProps) {
  const isEs = locale === 'es';

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b-2 border-stone-200">
            <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-stone-600">
              {isEs ? 'Ciudad' : 'City'}
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide text-stone-600">
              {isEs ? 'Precio/m²' : 'Price/sqm'}
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide text-stone-600">
              {isEs ? 'Precio mediano' : 'Median price'}
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide text-stone-600">
              {isEs ? 'Inmuebles' : 'Listings'}
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide text-stone-600">
              {isEs ? 'Cambio' : 'Change'}
            </th>
          </tr>
        </thead>
        <tbody>
          {cities.map((city, index) => (
            <tr
              key={city.city}
              className={`border-b border-stone-100 transition-colors hover:bg-amber-50/50 ${
                index % 2 === 0 ? 'bg-stone-50/50' : ''
              }`}
            >
              <td className="px-4 py-4">
                <Link
                  href={getCityHref(city.city, locale)}
                  className="font-medium text-stone-900 transition-colors hover:text-amber-700"
                >
                  {city.city}
                </Link>
                <span className="ml-2 text-sm text-stone-400">{city.state}</span>
              </td>
              <td className="px-4 py-4 text-right font-semibold text-stone-900">
                {city.median_price_per_sqm
                  ? `${formatPrice(city.median_price_per_sqm)}/m²`
                  : '—'}
              </td>
              <td className="px-4 py-4 text-right text-stone-700">
                {city.median_price ? formatPrice(city.median_price) : '—'}
              </td>
              <td className="px-4 py-4 text-right text-stone-600">
                {formatMarketCount(city.listing_count, locale)}
              </td>
              <td className="px-4 py-4 text-right">
                {city.price_change_pct !== null ? (
                  <span
                    className={`inline-flex items-center gap-1 text-sm font-medium ${
                      city.price_change_pct > 0
                        ? 'text-green-600'
                        : city.price_change_pct < 0
                          ? 'text-red-600'
                          : 'text-stone-500'
                    }`}
                  >
                    {city.price_change_pct > 0 ? (
                      <TrendingUp className="h-3.5 w-3.5" />
                    ) : city.price_change_pct < 0 ? (
                      <TrendingDown className="h-3.5 w-3.5" />
                    ) : (
                      <Minus className="h-3.5 w-3.5" />
                    )}
                    {city.price_change_pct > 0 ? '+' : ''}
                    {city.price_change_pct}%
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
