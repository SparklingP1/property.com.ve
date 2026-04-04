import { Info } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { formatMarketCount } from '@/lib/market-data';

interface MethodologyNoteProps {
  listingCount: number;
  locale: string;
  methodologyUrl: string;
}

export function MethodologyNote({
  listingCount,
  locale,
  methodologyUrl,
}: MethodologyNoteProps) {
  const isEs = locale === 'es';
  const listingCountText = formatMarketCount(listingCount, locale);

  return (
    <div className="flex items-start gap-3 rounded-xl bg-stone-100 p-4 text-sm text-stone-600">
      <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-stone-400" />
      <p>
        {isEs
          ? `Basado en ${listingCountText} inmuebles activos en USD. Medianas estratificadas por tipo residencial y habitaciones, excluyendo valores atípicos (percentiles 2-98). `
          : `Based on ${listingCountText} active USD-denominated listings. Stratified medians by residential property type and bedrooms, excluding outliers (2nd-98th percentile). `}
        <Link
          href={methodologyUrl}
          className="text-amber-700 underline underline-offset-2 hover:text-amber-800"
        >
          {isEs ? 'Ver metodología completa' : 'View full methodology'}
        </Link>
      </p>
    </div>
  );
}
