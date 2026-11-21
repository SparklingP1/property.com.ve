/**
 * Link-out listing helpers (approved 21 Nov 2026).
 *
 * Listing pages show facts, a summary we write from those facts, one image
 * and a link to the original listing. The copied source description, the
 * photo gallery and agent contacts are never sent to the browser.
 *
 * Safe to import from client components: no server-only code here.
 */
import type { Listing } from '@/types/listing';

/** Days an inactive listing keeps its "ya no disponible" page before it returns 410. */
export const INACTIVE_GRACE_DAYS = 30;

/** Columns needed by ListingCard / ListingGrid. Never add description or agent fields. */
export const CARD_COLUMNS =
  'id, title, title_en, thumbnail_url, price, currency, property_type, city, location, neighborhood, state, region, bedrooms, bathrooms, area_sqm, parking_spaces, url_slug, url_slug_es, transaction_type';

const SOURCE_LABELS: Record<string, string> = {
  rentahouse: 'Rent-A-House',
  remax: 'RE/MAX',
  'green-acres': 'Green-Acres',
  bienesonline: 'BienesOnline',
  century21: 'Century 21',
};

export function getSourceName(source: string | null | undefined): string {
  if (!source) return 'el portal de origen';
  return SOURCE_LABELS[source] || source;
}

/** Fields that must never leave the server for a listing page. */
const PRIVATE_FIELDS = [
  'description_full',
  'description_full_en',
  'description_full_es',
  'description_short',
  'description_short_en',
  'description_short_es',
  'agent_name',
  'agent_office',
  'agent_phone',
  'agent_email',
  'agent_whatsapp',
  'street_address',
  'postal_code',
  'latitude',
  'longitude',
] as const;

export type PublicListing = Listing & {
  summary_es?: string | null;
  summary_en?: string | null;
  deactivated_at?: string | null;
};

/**
 * Strip copied text, agent contacts and the photo gallery. Keeps one image
 * (thumbnail, else the first stored image) in `thumbnail_url`.
 */
export function toPublicListing(row: Record<string, unknown>): PublicListing {
  const copy: Record<string, unknown> = { ...row };
  for (const field of PRIVATE_FIELDS) copy[field] = null;
  const images = Array.isArray(row.image_urls) ? (row.image_urls as string[]) : [];
  copy.thumbnail_url = (row.thumbnail_url as string | null) || images[0] || null;
  copy.image_urls = null;
  return copy as unknown as PublicListing;
}

export type ListingStatus = 'active' | 'inactive' | 'gone';

/**
 * active   → normal page
 * inactive → 200, noindex, "ya no disponible" + similar listings
 * gone     → 410 (inactive for more than INACTIVE_GRACE_DAYS)
 *
 * `active = false` is the source of truth; `deactivated_at` (migration 019)
 * dates it, falling back to `last_seen_at` when the scraper did not set it.
 */
export function getListingStatus(
  listing: Pick<PublicListing, 'active' | 'last_seen_at'> & { deactivated_at?: string | null },
  now: number = Date.now()
): ListingStatus {
  if (listing.active !== false) return 'active';
  const since = getInactiveSince(listing);
  if (!since) return 'inactive';
  const days = (now - since.getTime()) / 86_400_000;
  return days > INACTIVE_GRACE_DAYS ? 'gone' : 'inactive';
}

export function getInactiveSince(listing: {
  deactivated_at?: string | null;
  last_seen_at?: string | null;
}): Date | null {
  const raw = listing.deactivated_at || listing.last_seen_at;
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatListingDate(value: string | Date | null | undefined, locale: string): string | null {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-VE', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'America/Caracas',
  }).format(date);
}

export function formatListingPrice(
  price: number | null | undefined,
  currency: string | null | undefined,
  locale: string
): string | null {
  if (!price || price <= 0) return null;
  const cur = currency || 'USD';
  if (locale === 'en') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(price);
  }
  const amount = new Intl.NumberFormat('es-VE', { maximumFractionDigits: 0 }).format(price);
  const prefix = cur === 'USD' ? 'US$' : cur === 'VES' ? 'Bs.' : cur === 'EUR' ? '€' : cur;
  return `${prefix} ${amount}`;
}

const TYPE_ES: Record<string, string> = {
  apartment: 'Apartamento',
  house: 'Casa',
  land: 'Terreno',
  commercial: 'Local comercial',
  office: 'Oficina',
  building: 'Edificio',
  annex: 'Anexo',
};

const TYPE_EN: Record<string, string> = {
  apartment: 'Apartment',
  house: 'House',
  land: 'Plot of land',
  commercial: 'Commercial property',
  office: 'Office',
  building: 'Building',
  annex: 'Annex',
};

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function joinList(items: string[], and: string): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}

function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-VE', { maximumFractionDigits: 0 }).format(value);
}

type SummaryFacts = Pick<
  PublicListing,
  | 'property_type'
  | 'transaction_type'
  | 'neighborhood'
  | 'city'
  | 'location'
  | 'state'
  | 'region'
  | 'bedrooms'
  | 'bathrooms'
  | 'area_sqm'
  | 'land_area_sqm'
  | 'parking_spaces'
  | 'price'
  | 'currency'
> & { summary_es?: string | null; summary_en?: string | null };

/**
 * Our own short summary, built only from the listing's facts.
 * Uses the scraper's `summary_es` / `summary_en` when present.
 * `includePrice: false` is used for inactive listings (no current-price claim).
 */
export function getListingSummary(
  listing: SummaryFacts,
  locale: string,
  options: { includePrice?: boolean } = {}
): string {
  const includePrice = options.includePrice !== false;
  const stored = locale === 'en' ? listing.summary_en : listing.summary_es;
  if (includePrice && typeof stored === 'string' && stored.trim().length > 0) {
    return stored.trim();
  }

  const en = locale === 'en';
  const type = listing.property_type || '';
  const typeLabel = (en ? TYPE_EN[type] : TYPE_ES[type]) || (en ? 'Property' : 'Inmueble');
  const rent = listing.transaction_type === 'rent';
  const deal = en ? (rent ? 'for rent' : 'for sale') : rent ? 'en alquiler' : 'en venta';

  const town = listing.city || listing.location || null;
  const state = listing.state || listing.region || null;
  const placeParts = [listing.neighborhood, town].filter(
    (part, index, all): part is string => !!part && all.indexOf(part) === index
  );
  let place = placeParts.join(', ');
  if (state && state !== town) place = place ? `${place} (${state})` : state;
  if (!place) place = 'Venezuela';

  const facts: string[] = [];
  if (listing.bedrooms && listing.bedrooms > 0) {
    facts.push(en ? plural(listing.bedrooms, 'bedroom', 'bedrooms') : plural(listing.bedrooms, 'habitación', 'habitaciones'));
  }
  if (listing.bathrooms && listing.bathrooms > 0) {
    facts.push(en ? plural(listing.bathrooms, 'bathroom', 'bathrooms') : plural(listing.bathrooms, 'baño', 'baños'));
  }
  const area = listing.area_sqm || (type === 'land' ? listing.land_area_sqm : null);
  if (area && area > 0) {
    facts.push(`${formatNumber(area, locale)} m²`);
  }
  if (listing.parking_spaces && listing.parking_spaces > 0) {
    facts.push(
      en
        ? plural(listing.parking_spaces, 'parking space', 'parking spaces')
        : plural(listing.parking_spaces, 'puesto de estacionamiento', 'puestos de estacionamiento')
    );
  }

  let text = `${typeLabel} ${deal} ${en ? 'in' : 'en'} ${place}`;
  text += facts.length > 0 ? `: ${joinList(facts, en ? 'and' : 'y')}.` : '.';

  if (includePrice) {
    const price = formatListingPrice(listing.price, listing.currency, locale);
    text += price
      ? en
        ? ` Asking price: ${price}.`
        : ` Precio publicado: ${price}.`
      : en
        ? ' Price on request.'
        : ' Precio a consultar.';
  }
  return text;
}

/** Lowercase letters, digits and dashes only: safe to put in a PostgREST filter. */
export function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9-]{1,200}$/.test(slug);
}
