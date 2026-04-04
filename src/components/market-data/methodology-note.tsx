import { Info } from 'lucide-react';
import { Link } from '@/i18n/navigation';

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

  return (
    <div className="flex items-start gap-3 rounded-xl bg-stone-100 p-4 text-sm text-stone-600">
      <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-stone-400" />
      <p>
        {isEs
          ? `Basado en ${listingCount.toLocaleString()} inmuebles activos en USD. Mediana estratificada por tipo y habitaciones, excluyendo valores atipicos (percentiles 2-98). `
          : `Based on ${listingCount.toLocaleString()} active USD-denominated listings. Stratified medians by property type and bedrooms, excluding outliers (2nd-98th percentile). `}
        <Link
          href={methodologyUrl}
          className="text-amber-700 underline underline-offset-2 hover:text-amber-800"
        >
          {isEs ? 'Ver metodologia completa' : 'View full methodology'}
        </Link>
      </p>
    </div>
  );
}
