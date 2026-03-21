import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from './config';

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'as-needed', // No prefix for Spanish (default), /en/ for English
  localeDetection: false, // Don't auto-redirect based on browser language
});
