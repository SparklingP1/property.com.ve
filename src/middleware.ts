import createMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { NextRequest, NextResponse } from 'next/server';
import { routing } from './i18n/routing';

const ENGLISH_SEO_KEYWORDS = [
  'apartments',
  'houses',
  'land',
  'commercial',
  'office',
  'bedroom',
];
const ENGLISH_STATE_SUFFIX = '-state';

const ENGLISH_LISTING_MARKERS = ['-bed-', 'for-sale', 'for-rent'];

const SPANISH_SEO_KEYWORDS = [
  'apartamentos',
  'casas',
  'terrenos',
  'comercial',
  'oficinas',
  'habitaciones',
];
const SPANISH_STATE_SUFFIX = '-estado';

const SPANISH_LISTING_MARKERS = ['-hab-', 'en-venta', 'en-alquiler'];

const MARKET_DATA_HUB_ES_PATH = '/precios-de-casas-en-venezuela';
const MARKET_DATA_HUB_EN_PATH = '/property-prices-in-venezuela';
const MARKET_DATA_METHODOLOGY_ES_PATH = `${MARKET_DATA_HUB_ES_PATH}/metodologia`;
const MARKET_DATA_METHODOLOGY_EN_PATH = `${MARKET_DATA_HUB_EN_PATH}/methodology`;

const GUIDE_EN_TO_ES: Record<string, string> = {
  'how-to-buy-property-in-venezuela-as-a-foreigner':
    'como-comprar-propiedad-en-venezuela-siendo-extranjero',
  'caracas-neighborhoods-guide-expats': 'guia-barrios-caracas-expatriados',
  'margarita-island-real-estate-guide': 'guia-inmobiliaria-isla-margarita',
  'venezuela-property-laws-foreign-buyers':
    'leyes-propiedad-venezuela-compradores-extranjeros',
  'is-it-safe-to-buy-property-in-venezuela':
    'es-seguro-comprar-propiedad-en-venezuela',
  'caracas-vs-valencia-where-to-buy': 'caracas-vs-valencia-donde-comprar',
  'beachfront-property-venezuela-guide':
    'guia-propiedades-playa-venezuela',
  'venezuela-property-prices-2026': 'precios-propiedades-venezuela-2026',
  'renting-vs-buying-in-venezuela': 'alquilar-vs-comprar-en-venezuela',
  'venezuela-real-estate-taxes-foreigners':
    'impuestos-inmobiliarios-venezuela-extranjeros',
  'buying-property-in-caracas-neighborhood-guide':
    'guia-comprar-propiedad-caracas-por-barrio',
  'best-areas-to-buy-property-in-venezuela-2026':
    'mejores-zonas-comprar-propiedad-venezuela-2026',
  'foreigners-guide-to-buying-property-in-venezuela':
    'guia-extranjeros-comprar-propiedad-venezuela',
  'venezuela-real-estate-market-outlook-2026':
    'panorama-mercado-inmobiliario-venezuela-2026',
};

const GUIDE_ES_TO_EN: Record<string, string> = Object.fromEntries(
  Object.entries(GUIDE_EN_TO_ES).map(([en, es]) => [es, en])
);

function isEnglishSEOSlug(pathname: string): boolean {
  const slug = pathname.slice(1);
  const parts = slug.split('-');

  return (
    parts.some((part) => ENGLISH_SEO_KEYWORDS.includes(part)) ||
    pathname.endsWith(ENGLISH_STATE_SUFFIX)
  );
}

function isSpanishSEOSlug(pathname: string): boolean {
  const slug = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const parts = slug.split('-');

  return (
    parts.some((part) => SPANISH_SEO_KEYWORDS.includes(part)) ||
    pathname.endsWith(SPANISH_STATE_SUFFIX)
  );
}

function isSpanishListingSlug(slug: string): boolean {
  return SPANISH_LISTING_MARKERS.some((marker) => slug.includes(marker));
}

function isEnglishListingSlug(slug: string): boolean {
  return ENGLISH_LISTING_MARKERS.some((marker) => slug.includes(marker));
}

function normalizePathname(pathname: string): string {
  return pathname !== '/' && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname;
}

function isEnglishMarketDataCityPath(pathname: string): boolean {
  const normalizedPathname = normalizePathname(pathname);
  return (
    /^\/property-prices-in-[^/]+$/.test(normalizedPathname) &&
    normalizedPathname !== MARKET_DATA_HUB_EN_PATH
  );
}

function getEnglishInternalMarketDataCitySlug(pathname: string): string | null {
  const prefix = `/en${MARKET_DATA_HUB_ES_PATH}/`;
  const normalizedPathname = normalizePathname(pathname);

  if (!normalizedPathname.startsWith(prefix)) {
    return null;
  }

  const citySlug = normalizedPathname.slice(prefix.length);
  if (!citySlug || citySlug === 'metodologia' || citySlug.includes('/')) {
    return null;
  }

  return citySlug;
}

function getSpanishInternalMarketDataCitySlug(pathname: string): string | null {
  const prefix = `${MARKET_DATA_HUB_ES_PATH}/`;
  const normalizedPathname = normalizePathname(pathname);

  if (!normalizedPathname.startsWith(prefix)) {
    return null;
  }

  const citySlug = normalizedPathname.slice(prefix.length);
  if (!citySlug || citySlug === 'metodologia' || citySlug.includes('/')) {
    return null;
  }

  return citySlug;
}

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const normalizedPathname = normalizePathname(pathname);

  const authCookiesToSet: Array<{
    name: string;
    value: string;
    options?: Record<string, unknown>;
  }> = [];
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          authCookiesToSet.push(...cookiesToSet);
        },
      },
    }
  );
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (pathname.match(/^\/(en\/)?dashboard/) && !user) {
    const locale = pathname.startsWith('/en') ? 'en' : 'es';
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = locale === 'en' ? '/en/login' : '/login';
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    authCookiesToSet.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options as Record<string, string>);
    });
    return response;
  }

  if (
    normalizedPathname === MARKET_DATA_HUB_EN_PATH ||
    normalizedPathname === MARKET_DATA_METHODOLOGY_EN_PATH ||
    isEnglishMarketDataCityPath(normalizedPathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${normalizedPathname}`;
    return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
  }

  if (normalizedPathname === `/en${MARKET_DATA_HUB_ES_PATH}`) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${MARKET_DATA_HUB_EN_PATH}`;
    return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
  }

  if (normalizedPathname === `/en${MARKET_DATA_METHODOLOGY_ES_PATH}`) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${MARKET_DATA_METHODOLOGY_EN_PATH}`;
    return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
  }

  const englishInternalMarketDataCitySlug =
    getEnglishInternalMarketDataCitySlug(normalizedPathname);

  if (englishInternalMarketDataCitySlug) {
    const url = request.nextUrl.clone();
    url.pathname = `/en/property-prices-in-${englishInternalMarketDataCitySlug}`;
    return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
  }

  if (pathname.startsWith('/en/')) {
    const enPath = normalizedPathname.slice(3);

    if (isSpanishSEOSlug(enPath)) {
      const url = request.nextUrl.clone();
      url.pathname = enPath;
      return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
    }

    if (enPath.startsWith('/property/')) {
      const parts = enPath.split('/');
      if (parts.length >= 5 && isSpanishListingSlug(parts[4])) {
        const url = request.nextUrl.clone();
        url.pathname = enPath;
        return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
      }
    }

    if (enPath.startsWith('/guides/')) {
      const guideSlug = enPath.replace('/guides/', '');
      if (GUIDE_ES_TO_EN[guideSlug]) {
        const url = request.nextUrl.clone();
        url.pathname = enPath;
        return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
      }
    }

    return applyAuthCookies(intlMiddleware(request), authCookiesToSet);
  }

  if (normalizedPathname === '/en') {
    return applyAuthCookies(intlMiddleware(request), authCookiesToSet);
  }

  if (
    !pathname.startsWith('/property/') &&
    !pathname.startsWith('/guides/') &&
    !pathname.startsWith('/search') &&
    !pathname.startsWith('/browse-by-area') &&
    !pathname.startsWith('/find-property') &&
    !pathname.startsWith('/list-your-property') &&
    !pathname.startsWith('/about') &&
    !pathname.startsWith('/disclaimer') &&
    !pathname.startsWith('/takedown') &&
    !pathname.startsWith('/listing/') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/register') &&
    !pathname.startsWith('/dashboard') &&
    pathname !== '/' &&
    isEnglishSEOSlug(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${pathname}`;
    return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
  }

  if (pathname.startsWith('/property/')) {
    const parts = pathname.split('/');
    if (parts.length >= 5 && isEnglishListingSlug(parts[4])) {
      const url = request.nextUrl.clone();
      url.pathname = `/en${pathname}`;
      return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
    }
  }

  if (pathname.startsWith('/guides/')) {
    const guideSlug = pathname.replace('/guides/', '');
    if (GUIDE_EN_TO_ES[guideSlug]) {
      const url = request.nextUrl.clone();
      url.pathname = `/en${pathname}`;
      return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
    }
  }

  const spanishInternalMarketDataCitySlug =
    getSpanishInternalMarketDataCitySlug(normalizedPathname);

  if (spanishInternalMarketDataCitySlug) {
    const url = request.nextUrl.clone();
    url.pathname = `/precios-de-casas-en-${spanishInternalMarketDataCitySlug}`;
    return applyAuthCookies(NextResponse.redirect(url, 301), authCookiesToSet);
  }

  return applyAuthCookies(intlMiddleware(request), authCookiesToSet);
}

function applyAuthCookies(
  response: NextResponse,
  cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>
): NextResponse {
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Record<string, string>);
  });
  return response;
}

export const config = {
  matcher: [
    '/((?!api|auth/callback|_next|_vercel|sitemap|robots\\.txt|favicon\\.ico|icon\\.svg|og-image\\.jpg|.*\\..*).*)',
  ],
};
