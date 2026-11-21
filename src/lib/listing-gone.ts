/**
 * 410 Gone for listings inactive for more than INACTIVE_GRACE_DAYS.
 *
 * App Router pages cannot set a 410 status, so the middleware checks listing
 * URLs (/property/{state}/{city}/{slug}, with or without /en) before the page
 * renders. One lean indexed lookup per URL, memoised in-process for 10 minutes.
 * Uses the service-role key server side (middleware never runs in the browser);
 * without it the check is skipped and the page handles the listing as usual.
 */
import { NextResponse } from 'next/server';
import { getListingStatus, isSafeSlug, type ListingStatus } from './listing-public';

const MEMO_TTL_MS = 10 * 60 * 1000;
const MEMO_MAX = 5000;
const memo = new Map<string, { status: ListingStatus | 'missing'; at: number }>();

/** Dev/QA only: `?simulate_status=inactive|gone` when LISTING_STATUS_SIMULATION=1. */
export function getSimulatedStatus(searchParams: URLSearchParams): ListingStatus | null {
  if (process.env.LISTING_STATUS_SIMULATION !== '1') return null;
  const value = searchParams.get('simulate_status');
  return value === 'inactive' || value === 'gone' || value === 'active' ? value : null;
}

/** Returns the listing slug if the path is a listing page, else null. */
export function getListingSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^(?:\/en)?\/property\/[^/]+\/[^/]+\/([^/]+)\/?$/);
  if (!match) return null;
  const slug = decodeURIComponent(match[1]);
  return isSafeSlug(slug) ? slug : null;
}

export async function lookupListingStatus(slug: string): Promise<ListingStatus | 'missing' | null> {
  const cached = memo.get(slug);
  if (cached && Date.now() - cached.at < MEMO_TTL_MS) return cached.status;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  try {
    const response = await fetch(
      `${url}/rest/v1/listings?select=active,deactivated_at,last_seen_at&or=(url_slug.eq.${slug},url_slug_es.eq.${slug})&limit=1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(1500),
        cache: 'no-store',
      }
    );
    if (!response.ok) return null;
    const rows = (await response.json()) as Array<{
      active: boolean;
      deactivated_at: string | null;
      last_seen_at: string;
    }>;
    const status: ListingStatus | 'missing' = rows[0] ? getListingStatus(rows[0]) : 'missing';
    if (memo.size >= MEMO_MAX) memo.clear();
    memo.set(slug, { status, at: Date.now() });
    return status;
  } catch {
    return null; // Never block a page on this check.
  }
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
