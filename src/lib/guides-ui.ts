type GuideLocale = 'en' | 'es';

const GUIDE_CATEGORY_LABELS: Record<string, Record<GuideLocale, string>> = {
  buying: {
    en: 'Buying',
    es: 'Compra',
  },
  location: {
    en: 'Location',
    es: 'Ubicacion',
  },
  legal: {
    en: 'Legal',
    es: 'Legal',
  },
  investment: {
    en: 'Investment',
    es: 'Inversion',
  },
  'property type': {
    en: 'Property Type',
    es: 'Tipo de Propiedad',
  },
  market: {
    en: 'Market',
    es: 'Mercado',
  },
};

function toTitleCase(value: string) {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function normalizeGuideCategory(category: string) {
  const normalized = category
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (normalized === 'buying guide') {
    return 'buying';
  }

  if (normalized === 'market analysis') {
    return 'market';
  }

  return normalized;
}

export function getGuideCategoryLabel(category: string, locale: string) {
  const localeKey: GuideLocale = locale === 'es' ? 'es' : 'en';
  const normalized = normalizeGuideCategory(category);

  return GUIDE_CATEGORY_LABELS[normalized]?.[localeKey] ?? toTitleCase(normalized);
}

export function formatGuideDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'es' ? 'es-VE' : 'en-US', {
    dateStyle: 'long',
  }).format(new Date(`${date}T00:00:00`));
}
