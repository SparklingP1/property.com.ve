import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

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
