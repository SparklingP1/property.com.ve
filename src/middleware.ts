import createMiddleware from 'next-intl/middleware';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

/**
 * English keywords that identify an English SEO slug at root (Spanish) paths.
 * If a root path contains any of these, it's an old English URL that needs redirecting.
 */
const ENGLISH_SEO_KEYWORDS = [
  'apartments', 'houses', 'land', 'commercial', 'office', 'bedroom',
];
const ENGLISH_STATE_SUFFIX = '-state';

/**
 * English → Spanish translation map for SEO slug segments
 */
const SLUG_EN_TO_ES: Record<string, string> = {
  'apartments': 'apartamentos',
  'houses': 'casas',
  'land': 'terrenos',
  'commercial': 'comercial',
  'office': 'oficinas',
  'bedroom': 'habitaciones',
};

/**
 * English listing slug markers
 */
const ENGLISH_LISTING_MARKERS = ['-bed-', 'for-sale', 'for-rent'];
const LISTING_EN_TO_ES: Record<string, string> = {
  '-bed-': '-hab-',
  'for-sale': 'en-venta',
  'for-rent': 'en-alquiler',
  'apartment': 'apartamento',
  'house': 'casa',
  'land': 'terreno',
  'commercial': 'comercial',
  'office': 'oficina',
};

/**
 * Guide slug mapping (English → Spanish)
 */
const GUIDE_EN_TO_ES: Record<string, string> = {
  'how-to-buy-property-in-venezuela-as-a-foreigner': 'como-comprar-propiedad-en-venezuela-siendo-extranjero',
  'caracas-neighborhoods-guide-expats': 'guia-barrios-caracas-expatriados',
  'margarita-island-real-estate-guide': 'guia-inmobiliaria-isla-margarita',
  'venezuela-property-laws-foreign-buyers': 'leyes-propiedad-venezuela-compradores-extranjeros',
  'is-it-safe-to-buy-property-in-venezuela': 'es-seguro-comprar-propiedad-en-venezuela',
  'caracas-vs-valencia-where-to-buy': 'caracas-vs-valencia-donde-comprar',
  'beachfront-property-venezuela-guide': 'guia-propiedades-playa-venezuela',
  'venezuela-property-prices-2026': 'precios-propiedades-venezuela-2026',
  'renting-vs-buying-in-venezuela': 'alquilar-vs-comprar-en-venezuela',
  'venezuela-real-estate-taxes-foreigners': 'impuestos-inmobiliarios-venezuela-extranjeros',
  'buying-property-in-caracas-neighborhood-guide': 'guia-comprar-propiedad-caracas-por-barrio',
  'best-areas-to-buy-property-in-venezuela-2026': 'mejores-zonas-comprar-propiedad-venezuela-2026',
  'foreigners-guide-to-buying-property-in-venezuela': 'guia-extranjeros-comprar-propiedad-venezuela',
  'venezuela-real-estate-market-outlook-2026': 'panorama-mercado-inmobiliario-venezuela-2026',
};

/**
 * Check if a root path contains English SEO keywords
 */
function isEnglishSEOSlug(pathname: string): boolean {
  const slug = pathname.slice(1); // Remove leading /
  const parts = slug.split('-');
  return parts.some(part => ENGLISH_SEO_KEYWORDS.includes(part)) ||
    pathname.endsWith(ENGLISH_STATE_SUFFIX);
}

/**
 * Translate an English SEO slug to Spanish (pure string ops, no DB)
 */
function translateSEOSlugToSpanish(pathname: string): string {
  // Strip leading / for clean segment matching, re-add after
  let slug = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  // Replace English keywords with Spanish equivalents
  for (const [en, es] of Object.entries(SLUG_EN_TO_ES)) {
    // Use word-boundary-aware replacement to avoid partial matches
    slug = slug.replace(new RegExp(`(^|-)${en}(-|$)`, 'g'), `$1${es}$2`);
  }
  // Handle -state suffix → -estado
  if (slug.endsWith('-state')) {
    slug = slug.slice(0, -6) + '-estado';
  }
  return '/' + slug;
}

/**
 * Check if a listing slug contains English markers
 */
function isEnglishListingSlug(slug: string): boolean {
  return ENGLISH_LISTING_MARKERS.some(marker => slug.includes(marker));
}

/**
 * Translate an English listing slug to Spanish
 */
function translateListingSlugToSpanish(slug: string): string {
  let result = slug;
  for (const [en, es] of Object.entries(LISTING_EN_TO_ES)) {
    result = result.replace(en, es);
  }
  return result;
}

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip /en/ paths — English paths keep English slugs
  if (pathname.startsWith('/en/') || pathname === '/en') {
    return intlMiddleware(request);
  }

  // Redirect old English slugs at root (Spanish locale) → /en/ (English locale)
  // Rationale: Google already indexed these root URLs for English queries.
  // Redirecting to /en/ preserves the English intent and link equity.
  // New Spanish URLs (/apartamentos-caracas) will be discovered via sitemaps.

  // 1. SEO pages: English slug at root → /en/ with same English slug
  if (!pathname.startsWith('/property/') &&
      !pathname.startsWith('/guides/') &&
      !pathname.startsWith('/search') &&
      !pathname.startsWith('/browse-by-area') &&
      !pathname.startsWith('/find-property') &&
      !pathname.startsWith('/list-your-property') &&
      !pathname.startsWith('/about') &&
      !pathname.startsWith('/disclaimer') &&
      !pathname.startsWith('/takedown') &&
      !pathname.startsWith('/listing/') &&
      pathname !== '/' &&
      isEnglishSEOSlug(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${pathname}`;
    return NextResponse.redirect(url, 301);
  }

  // 2. Listing pages: English listing slug at root → /en/ with same path
  if (pathname.startsWith('/property/')) {
    const parts = pathname.split('/');
    if (parts.length >= 5) {
      const listingSlug = parts[4];
      if (isEnglishListingSlug(listingSlug)) {
        const url = request.nextUrl.clone();
        url.pathname = `/en${pathname}`;
        return NextResponse.redirect(url, 301);
      }
    }
  }

  // 3. Guide pages: English guide slug at root → /en/ with same path
  if (pathname.startsWith('/guides/')) {
    const guideSlug = pathname.replace('/guides/', '');
    if (GUIDE_EN_TO_ES[guideSlug]) {
      const url = request.nextUrl.clone();
      url.pathname = `/en${pathname}`;
      return NextResponse.redirect(url, 301);
    }
  }

  // Pass through to next-intl middleware for everything else
  return intlMiddleware(request);
}

export const config = {
  // Match all pathnames except for:
  // - API routes (/api/...)
  // - Next.js internals (/_next/...)
  // - Vercel internals (/_vercel/...)
  // - Static files (files with extensions like .jpg, .css, .js, etc.)
  // - Sitemap and robots files
  matcher: [
    '/((?!api|_next|_vercel|sitemap|robots\\.txt|favicon\\.ico|icon\\.svg|og-image\\.jpg|.*\\..*).*)',
  ],
};
