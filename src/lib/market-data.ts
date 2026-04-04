export const MARKET_DATA_HUB_ES_PATH = '/precios-de-casas-en-venezuela';
export const MARKET_DATA_HUB_EN_PATH = '/property-prices-in-venezuela';
export const MARKET_DATA_METHODOLOGY_ES_PATH =
  `${MARKET_DATA_HUB_ES_PATH}/metodologia`;
export const MARKET_DATA_METHODOLOGY_EN_PATH =
  `${MARKET_DATA_HUB_EN_PATH}/methodology`;

export function slugifyMarketCity(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function getMarketDataHubPath(locale: string): string {
  return locale === 'es' ? MARKET_DATA_HUB_ES_PATH : MARKET_DATA_HUB_EN_PATH;
}

export function getMarketDataMethodologyPath(locale: string): string {
  return locale === 'es'
    ? MARKET_DATA_METHODOLOGY_ES_PATH
    : MARKET_DATA_METHODOLOGY_EN_PATH;
}

export function getMarketDataCityPath(citySlug: string, locale: string): string {
  return locale === 'es'
    ? `/precios-de-casas-en-${citySlug}`
    : `/property-prices-in-${citySlug}`;
}

export function getLocalizedPath(path: string, locale: string): string {
  return locale === 'es' ? path : `/en${path}`;
}

export function formatMarketCount(count: number, locale: string): string {
  return new Intl.NumberFormat(locale === 'es' ? 'es-VE' : 'en-US').format(
    count
  );
}

export function getMarketDataYear(periodStart?: string | null): number {
  if (!periodStart) {
    return new Date().getFullYear();
  }

  const year = new Date(`${periodStart}T00:00:00`).getUTCFullYear();
  return Number.isNaN(year) ? new Date().getFullYear() : year;
}

export function parseMarketDataCitySlug(
  slug: string,
  locale: string
): string | null {
  const prefix =
    locale === 'es' ? 'precios-de-casas-en-' : 'property-prices-in-';

  if (!slug.startsWith(prefix)) {
    return null;
  }

  const citySlug = slug.slice(prefix.length);
  if (!citySlug || citySlug === 'venezuela') {
    return null;
  }

  return citySlug;
}
