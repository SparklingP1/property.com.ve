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
  /** Our template summary (from description_short_* when it is ours), else null. */
  summary_es?: string | null;
  summary_en?: string | null;
  deactivated_at?: string | null;
  /** Migration 022; undefined before it is applied. */
  duplicate_of?: string | null;
};

/*
 * The scraper (scraper/facts.py summary_es / summary_en) writes our own
 * summary into description_short_es / description_short_en, e.g.
 *   "Apartamento en venta en El Cafetal, Caracas: 3 habitaciones, 2 baños, 120 m², USD 85.000."
 *   "Apartment for sale in El Cafetal, Caracas: 3 bedrooms, 2 bathrooms, 120 m², USD 85,000."
 * Old rows still hold text copied from the source there until the backfill,
 * so only text that matches the template is shown.
 */
const TEMPLATE_ES =
  /^(Apartamento|Casa|Terreno|Anexo|Inmueble) en (venta|alquiler)( en [^:\n]{1,120})?: [^\n]{0,200}(precio a consultar|[A-Z]{3} [\d.]+)\.$/;
const TEMPLATE_EN =
  /^(Apartment|House|Plot of land|Annex|Property) for (sale|rent)( in [^:\n]{1,120})?: [^\n]{0,200}(price on request|[A-Z]{3} [\d,]+)\.$/;

export function isTemplateSummary(text: unknown, locale: 'es' | 'en'): text is string {
  if (typeof text !== 'string') return false;
  return (locale === 'en' ? TEMPLATE_EN : TEMPLATE_ES).test(text.trim());
}

/**
 * Strip copied text, agent contacts and the photo gallery. Keeps one image
 * (thumbnail, else the first stored image) in `thumbnail_url`, and our
 * template summary (if present) in `summary_es` / `summary_en`.
 */
export function toPublicListing(row: Record<string, unknown>): PublicListing {
  const copy: Record<string, unknown> = { ...row };
  const es = [row.description_short_es, row.description_short].find((v) => isTemplateSummary(v, 'es'));
  const en = [row.description_short_en].find((v) => isTemplateSummary(v, 'en'));
  for (const field of PRIVATE_FIELDS) copy[field] = null;
  copy.summary_es = typeof es === 'string' ? es.trim() : null;
  copy.summary_en = typeof en === 'string' ? en.trim() : null;
  const images = Array.isArray(row.image_urls) ? (row.image_urls as string[]) : [];
  copy.thumbnail_url = (row.thumbnail_url as string | null) || images[0] || null;
  copy.image_urls = null;
  return copy as unknown as PublicListing;
}

export type ListingStatus = 'active' | 'inactive' | 'gone' | 'hidden';

/**
 * Per docs/data-contract.md:
 * active   (active=true)                        → normal page
 * hidden   (active=false, deactivated_at null)  → 404 (stored rental, not launched)
 * inactive (active=false, deactivated_at ≤ 30 d) → 200, noindex, "ya no disponible" + similar
 * gone     (active=false, deactivated_at > 30 d) → 410
 */
export function getListingStatus(
  listing: { active?: boolean | null; deactivated_at?: string | null },
  now: number = Date.now()
): ListingStatus {
  if (listing.active !== false) return 'active';
  const since = getInactiveSince(listing);
  if (!since) return 'hidden';
  const days = (now - since.getTime()) / 86_400_000;
  return days > INACTIVE_GRACE_DAYS ? 'gone' : 'inactive';
}

export function getInactiveSince(listing: { deactivated_at?: string | null }): Date | null {
  const raw = listing.deactivated_at;
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
  const amount = Math.round(price).toLocaleString('en-US').replace(/,/g, '.');
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

/** Matches scraper/facts.py fmt_int_es / fmt_int_en: "85.000" / "85,000" (also for 4 digits). */
function formatNumber(value: number, locale: string) {
  const grouped = Math.round(value).toLocaleString('en-US');
  return locale === 'en' ? grouped : grouped.replace(/,/g, '.');
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

  // Same template as scraper/facts.py (summary_es / summary_en), so rows
  // rendered here read exactly like rows the scraper has already written.
  const en = locale === 'en';
  const type = listing.property_type || '';
  let text = (en ? TYPE_EN[type] : TYPE_ES[type]) || (en ? 'Property' : 'Inmueble');
  const rent = listing.transaction_type === 'rent';
  text += en ? (rent ? ' for rent' : ' for sale') : rent ? ' en alquiler' : ' en venta';

  const placeParts: string[] = [];
  for (const part of [listing.neighborhood, listing.city || listing.location, listing.state || listing.region]) {
    const clean = part?.trim();
    if (clean && placeParts.every((p) => fold(p) !== fold(clean))) placeParts.push(clean);
    if (placeParts.length === 2) break;
  }
  if (placeParts.length > 0) text += `${en ? ' in' : ' en'} ${placeParts.join(', ')}`;

  const bits: string[] = [];
  const isLand = type === 'land';
  if (!isLand && listing.bedrooms && listing.bedrooms > 0) {
    bits.push(en ? plural(listing.bedrooms, 'bedroom', 'bedrooms') : plural(listing.bedrooms, 'habitación', 'habitaciones'));
  }
  if (!isLand && listing.bathrooms && listing.bathrooms > 0) {
    bits.push(en ? plural(listing.bathrooms, 'bathroom', 'bathrooms') : plural(listing.bathrooms, 'baño', 'baños'));
  }
  const area = listing.area_sqm || (isLand ? listing.land_area_sqm : null);
  if (area && area > 0) bits.push(`${formatNumber(area, locale)} m²`);
  if (!isLand && listing.parking_spaces && listing.parking_spaces > 0) {
    bits.push(
      en
        ? plural(listing.parking_spaces, 'parking space', 'parking spaces')
        : plural(listing.parking_spaces, 'puesto de estacionamiento', 'puestos de estacionamiento')
    );
  }
  if (includePrice) {
    bits.push(
      listing.price && listing.price > 0
        ? `${listing.currency || 'USD'} ${formatNumber(listing.price, locale)}`
        : en
          ? 'price on request'
          : 'precio a consultar'
    );
  }
  return bits.length > 0 ? `${text}: ${bits.join(', ')}.` : `${text}.`;
}

function fold(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Lowercase letters, digits and dashes only: safe to put in a PostgREST filter. */
export function isSafeSlug(slug: string): boolean {
  return /^[a-z0-9-]{1,200}$/.test(slug);
}
