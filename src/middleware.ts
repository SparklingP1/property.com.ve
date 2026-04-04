import createMiddleware from 'next-intl/middleware';
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

const GUIDE_EN_TO_ES: Record<string, string> = {
  'how-to-buy-property-in-venezuela-as-a-foreigner':
    'como-comprar-propiedad-en-venezuela-siendo-extranjero',
  'caracas-neighborhoods-guide-expats': 'guia-barrios-caracas-expatriados',
  'margarita-island-real-estate-guide': 'guia-inmobiliaria-isla-margarita',
  'venezuela-property-laws-foreign-buyers':
    'leyes-propiedad-venezuela-compradores-extranjeros',
  'is-it-safe-to-buy-property-in-venezuela': 'es-seguro-comprar-propiedad-en-venezuela',
  'caracas-vs-valencia-where-to-buy': 'caracas-vs-valencia-donde-comprar',
  'beachfront-property-venezuela-guide': 'guia-propiedades-playa-venezuela',
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

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Market data: rewrite to canonical route paths by mutating the URL,
  // then return intlMiddleware immediately (don't fall through — the stale
  // `pathname` const would match later conditions and cause redirects).
  if (pathname.startsWith('/en/property-prices-in-')) {
    const rest = pathname.slice('/en/property-prices-in-'.length);

    if (rest === 'venezuela' || rest === 'venezuela/') {
      request.nextUrl.pathname = '/en/precios-de-casas-en-venezuela';
    } else if (rest === 'venezuela/methodology' || rest === 'venezuela/methodology/') {
      request.nextUrl.pathname = '/en/precios-de-casas-en-venezuela/metodologia';
    } else {
      const citySlug = rest.replace(/\/$/, '');
      request.nextUrl.pathname = `/en/precios-de-casas-en-venezuela/${citySlug}`;
    }
    return intlMiddleware(request);
  }

  // Spanish city URLs: /precios-de-casas-en-caracas → /precios-de-casas-en-venezuela/caracas
  if (pathname.startsWith('/precios-de-casas-en-') && pathname !== '/precios-de-casas-en-venezuela' && !pathname.startsWith('/precios-de-casas-en-venezuela/')) {
    const citySlug = pathname.slice('/precios-de-casas-en-'.length).replace(/\/$/, '');
    if (citySlug) {
      request.nextUrl.pathname = `/precios-de-casas-en-venezuela/${citySlug}`;
      return intlMiddleware(request);
    }
  }

  if (pathname.startsWith('/en/')) {
    const enPath = pathname.slice(3);

    if (isSpanishSEOSlug(enPath)) {
      const url = request.nextUrl.clone();
      url.pathname = enPath;
      return NextResponse.redirect(url, 301);
    }

    if (enPath.startsWith('/property/')) {
      const parts = enPath.split('/');
      if (parts.length >= 5 && isSpanishListingSlug(parts[4])) {
        const url = request.nextUrl.clone();
        url.pathname = enPath;
        return NextResponse.redirect(url, 301);
      }
    }

    if (enPath.startsWith('/guides/')) {
      const guideSlug = enPath.replace('/guides/', '');
      if (GUIDE_ES_TO_EN[guideSlug]) {
        const url = request.nextUrl.clone();
        url.pathname = enPath;
        return NextResponse.redirect(url, 301);
      }
    }

    return intlMiddleware(request);
  }

  if (pathname === '/en') {
    return intlMiddleware(request);
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
    pathname !== '/' &&
    isEnglishSEOSlug(pathname)
  ) {
    const url = request.nextUrl.clone();
    url.pathname = `/en${pathname}`;
    return NextResponse.redirect(url, 301);
  }

  if (pathname.startsWith('/property/')) {
    const parts = pathname.split('/');
    if (parts.length >= 5 && isEnglishListingSlug(parts[4])) {
      const url = request.nextUrl.clone();
      url.pathname = `/en${pathname}`;
      return NextResponse.redirect(url, 301);
    }
  }

  if (pathname.startsWith('/guides/')) {
    const guideSlug = pathname.replace('/guides/', '');
    if (GUIDE_EN_TO_ES[guideSlug]) {
      const url = request.nextUrl.clone();
      url.pathname = `/en${pathname}`;
      return NextResponse.redirect(url, 301);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    '/((?!api|_next|_vercel|sitemap|robots\\.txt|favicon\\.ico|icon\\.svg|og-image\\.jpg|.*\\..*).*)',
  ],
};
