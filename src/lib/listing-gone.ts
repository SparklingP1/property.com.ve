/**
 * Middleware checks for listing URLs (/property/{state}/{city}/{slug}, with or
 * without /en), because App Router pages cannot answer 301 or 410 themselves:
 *
 *  - duplicate_of set (migration 022) → 301 to the canonical listing's URL
 *  - expired more than INACTIVE_GRACE_DAYS ago → 410 Gone
 *
 * One lean indexed lookup per URL with the public anon key (no service-role
 * key in the request path), memoised in-process for 10 minutes. Expired rows
 * are readable to anon only after migration 024; before that the lookup finds
 * nothing and the page answers 404. Any error → no decision, page renders.
 */
import { NextResponse } from 'next/server';
import { getListingStatus, isSafeSlug, type ListingStatus } from './listing-public';
import { getListingUrlForLocale } from './slug';

const MEMO_TTL_MS = 10 * 60 * 1000;
const MEMO_MAX = 5000;

export interface ListingRouteDecision {
  status: ListingStatus | 'missing';
  /** Canonical listing (URL fields) when this row is a duplicate. */
  canonical?: CanonicalFields | null;
}

interface CanonicalFields {
  id: string;
  state: string | null;
  city: string | null;
  bedrooms: number | null;
  property_type: string | null;
  neighborhood: string | null;
  transaction_type: string | null;
  url_slug: string | null;
  url_slug_es: string | null;
}

const memo = new Map<string, { decision: ListingRouteDecision; at: number }>();
/** null = unknown yet; false = migration 022 not applied (select without it). */
let duplicateColumn: { exists: boolean; at: number } | null = null;

/** Dev/QA only: `?simulate_status=inactive|gone` when LISTING_STATUS_SIMULATION=1. */
export function getSimulatedStatus(searchParams: URLSearchParams): ListingStatus | null {
  if (process.env.LISTING_STATUS_SIMULATION !== '1') return null;
  const value = searchParams.get('simulate_status');
  return value === 'inactive' || value === 'gone' || value === 'active' || value === 'hidden' ? value : null;
}

/** Dev/QA only: `?simulate_duplicate_of=<uuid>` when LISTING_STATUS_SIMULATION=1. */
export function getSimulatedDuplicateOf(searchParams: URLSearchParams): string | null {
  if (process.env.LISTING_STATUS_SIMULATION !== '1') return null;
  const value = searchParams.get('simulate_duplicate_of');
  return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

/** Returns the listing slug if the path is a listing page, else null. */
export function getListingSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^(?:\/en)?\/property\/[^/]+\/[^/]+\/([^/]+)\/?$/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]);
  return isSafeSlug(slug) ? slug : null;
}

async function restGet<T>(query: string): Promise<{ ok: true; rows: T[] } | { ok: false; status: number }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return { ok: false, status: 0 };
  const response = await fetch(`${url}/rest/v1/listings?${query}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(1500),
    cache: 'no-store',
  });
  if (!response.ok) return { ok: false, status: response.status };
  return { ok: true, rows: (await response.json()) as T[] };
}

const CANONICAL_SELECT =
  'id,state,city,bedrooms,property_type,neighborhood,transaction_type,url_slug,url_slug_es';

export async function fetchCanonical(id: string): Promise<CanonicalFields | null> {
  const result = await restGet<CanonicalFields>(`select=${CANONICAL_SELECT}&id=eq.${id}&limit=1`);
  return result.ok ? result.rows[0] ?? null : null;
}

export async function lookupListingRoute(slug: string): Promise<ListingRouteDecision | null> {
  const cached = memo.get(slug);
  if (cached && Date.now() - cached.at < MEMO_TTL_MS) return cached.decision;

  try {
    const withDup = !duplicateColumn || Date.now() - duplicateColumn.at > MEMO_TTL_MS || duplicateColumn.exists;
    const match = `or=(url_slug.eq.${slug},url_slug_es.eq.${slug})&limit=1`;
    type Row = { active: boolean; deactivated_at: string | null; duplicate_of?: string | null };
    let result = await restGet<Row>(`select=active,deactivated_at${withDup ? ',duplicate_of' : ''}&${match}`);
    if (!result.ok && withDup && result.status === 400) {
      // Column missing: migration 022 not applied yet.
      duplicateColumn = { exists: false, at: Date.now() };
      result = await restGet<Row>(`select=active,deactivated_at&${match}`);
    } else if (result.ok && withDup) {
      duplicateColumn = { exists: true, at: Date.now() };
    }
    if (!result.ok) return null;

    const row = result.rows[0];
    const decision: ListingRouteDecision = row
      ? { status: getListingStatus(row), canonical: row.duplicate_of ? await fetchCanonical(row.duplicate_of) : null }
      : { status: 'missing' };
    if (memo.size >= MEMO_MAX) memo.clear();
    memo.set(slug, { decision, at: Date.now() });
    return decision;
  } catch {
    return null; // Never block a page on this check.
  }
}

/** 301 to the canonical listing in the same locale (null if it has no usable URL). */
export function duplicateRedirect(
  requestUrl: URL,
  canonical: CanonicalFields,
  locale: 'es' | 'en'
): NextResponse | null {
  const path = getListingUrlForLocale(canonical, locale);
  const target = new URL(locale === 'en' ? `/en${path}` : path, requestUrl);
  if (target.pathname === requestUrl.pathname) return null;
  return NextResponse.redirect(target, 301);
}

export function goneResponse(locale: 'es' | 'en'): NextResponse {
  const es = locale === 'es';
  const home = es ? '/' : '/en';
  const search = es ? '/search' : '/en/search';
  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${es ? 'Inmueble retirado | Property.com.ve' : 'Listing removed | Property.com.ve'}</title>
<style>body{font-family:system-ui,sans-serif;background:#fafaf9;color:#1c1917;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:16px}main{max-width:32rem;text-align:center}a{color:#b45309}</style>
</head>
<body>
<main>
<h1>${es ? 'Este inmueble ya no está disponible' : 'This property is no longer available'}</h1>
<p>${
    es
      ? 'El anuncio fue retirado del portal de origen hace más de 30 días.'
      : 'The listing was removed from its original portal more than 30 days ago.'
  }</p>
<p><a href="${search}">${es ? 'Buscar inmuebles disponibles' : 'Search available properties'}</a> · <a href="${home}">${
    es ? 'Ir al inicio' : 'Go to the homepage'
  }</a></p>
</main>
</body>
</html>`;
  return new NextResponse(html, {
    status: 410,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'x-robots-tag': 'noindex',
      'cache-control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
