import { parseSearchQuery } from './search-parser';

export type SearchParamValue = string | undefined;

export interface SearchParamRecord {
  [key: string]: SearchParamValue;
}

export interface NormalizedSearchParams {
  q?: string;
  type?: string;
  transaction?: 'sale' | 'rent';
  state?: string;
  city?: string;
  neighborhood?: string;
  minPrice?: string;
  maxPrice?: string;
  bedrooms?: string;
  bathrooms?: string;
  parking?: string;
  minArea?: string;
  maxArea?: string;
  furnished?: 'true' | 'false';
  sort?: string;
}

function normalizeText(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeSelect(value?: string) {
  const trimmed = normalizeText(value);
  return trimmed && trimmed !== 'all' ? trimmed : undefined;
}

function normalizeTransaction(value?: string): 'sale' | 'rent' | undefined {
  return value === 'sale' || value === 'rent' ? value : undefined;
}

function normalizeFurnished(value?: string): 'true' | 'false' | undefined {
  return value === 'true' || value === 'false' ? value : undefined;
}

export function normalizeSearchParams(
  searchParams: SearchParamRecord
): NormalizedSearchParams {
  const normalized: NormalizedSearchParams = {
    q: normalizeText(searchParams.q),
    type: normalizeSelect(searchParams.type) || normalizeSelect(searchParams.property_type),
    transaction:
      normalizeTransaction(searchParams.transaction) ||
      normalizeTransaction(searchParams.transaction_type),
    state: normalizeSelect(searchParams.state),
    city: normalizeSelect(searchParams.city),
    neighborhood: normalizeSelect(searchParams.neighborhood),
    minPrice: normalizeText(searchParams.minPrice),
    maxPrice: normalizeText(searchParams.maxPrice),
    bedrooms: normalizeSelect(searchParams.bedrooms),
    bathrooms: normalizeSelect(searchParams.bathrooms),
    parking: normalizeSelect(searchParams.parking),
    minArea: normalizeText(searchParams.minArea),
    maxArea: normalizeText(searchParams.maxArea),
    furnished: normalizeFurnished(searchParams.furnished),
    sort: normalizeText(searchParams.sort),
  };

  if (normalized.q) {
    const parsed = parseSearchQuery(normalized.q);

    if (!normalized.type && parsed.propertyType) {
      normalized.type = parsed.propertyType;
    }

    if (!normalized.transaction && parsed.transactionType) {
      normalized.transaction = parsed.transactionType;
    }

    if (!normalized.furnished && parsed.furnished !== undefined) {
      normalized.furnished = parsed.furnished ? 'true' : 'false';
    }

    normalized.q = normalizeText(parsed.remainingKeywords);
  }

  return normalized;
}

const SEARCH_PARAM_ORDER: Array<keyof NormalizedSearchParams> = [
  'q',
  'type',
  'transaction',
  'state',
  'city',
  'neighborhood',
  'minPrice',
  'maxPrice',
  'bedrooms',
  'bathrooms',
  'parking',
  'minArea',
  'maxArea',
  'furnished',
  'sort',
];

export function serializeSearchParams(searchParams: NormalizedSearchParams) {
  const params = new URLSearchParams();

  for (const key of SEARCH_PARAM_ORDER) {
    const value = searchParams[key];
    if (value) {
      params.set(key, value);
    }
  }

  return params.toString();
}

export function getSearchParamsKey(searchParams: NormalizedSearchParams) {
  return serializeSearchParams(searchParams) || 'search:all';
}
