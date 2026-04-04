import { Info } from 'lucide-react';

interface MethodologyNoteProps {
  listingCount: number;
  locale: string;
  methodologyUrl: string;
}

export function MethodologyNote({ listingCount, locale, methodologyUrl }: MethodologyNoteProps) {
  const isEs = locale === 'es';

  return (
    <div className="flex items-start gap-3 bg-stone-100 rounded-xl p-4 text-sm text-stone-600">
      <Info className="h-5 w-5 text-stone-400 flex-shrink-0 mt-0.5" />
      <p>
        {isEs
          ? `Basado en ${listingCount.toLocaleString()} inmuebles activos en USD. Mediana estratificada por tipo y habitaciones, excluyendo valores atípicos (percentiles 2-98). `
          : `Based on ${listingCount.toLocaleString()} active USD-denominated listings. Stratified median by property type and bedrooms, excluding outliers (2nd-98th percentile). `}
        <a href={methodologyUrl} className="text-amber-700 hover:text-amber-800 underline underline-offset-2">
          {isEs ? 'Ver metodología completa' : 'View full methodology'}
        </a>
      </p>
    </div>
  );
}
