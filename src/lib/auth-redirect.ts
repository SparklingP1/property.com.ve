const BASE_URL = 'https://property.com.ve';

function normalizePathnameForLocale(pathname: string, locale: string): string {
  if (locale === 'en') {
    if (pathname === '/en' || pathname.startsWith('/en/')) {
      return pathname;
    }

    return pathname === '/' ? '/en' : `/en${pathname}`;
  }

  if (pathname === '/en') {
    return '/';
  }

  if (pathname.startsWith('/en/')) {
    return pathname.slice(3);
  }

  return pathname;
}

export function getDefaultDashboardRedirect(locale: string, localized = false): string {
  if (localized && locale === 'en') {
    return '/en/dashboard';
  }

  return '/dashboard';
}

export function sanitizeInternalRedirect(redirectTo: string | null | undefined): string | null {
  if (!redirectTo || !redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return null;
  }

  try {
    const parsed = new URL(redirectTo, BASE_URL);

    if (parsed.origin !== BASE_URL) {
      return null;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

export function getLocalizedRedirect(redirectTo: string | null | undefined, locale: string): string {
  const safeRedirect = sanitizeInternalRedirect(redirectTo);

  if (!safeRedirect) {
    return getDefaultDashboardRedirect(locale, true);
  }

  const parsed = new URL(safeRedirect, BASE_URL);
  const localizedPathname = normalizePathnameForLocale(parsed.pathname, locale);

  return `${localizedPathname}${parsed.search}${parsed.hash}`;
}
