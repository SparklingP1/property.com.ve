import type { Listing } from '@/types/listing';

/**
 * Get the localized title for a listing.
 * Spanish uses the original scraped title; English uses the translated title.
 */
export function getLocalizedTitle(listing: Listing, locale: string): string {
  if (locale === 'en') {
    return listing.title_en || listing.title;
  }
  return listing.title_es || listing.title;
}

/**
 * Get the localized short description for a listing.
 */
export function getLocalizedShortDescription(listing: Listing, locale: string): string {
  if (locale === 'en') {
    return listing.description_short_en || listing.description_short || '';
  }
  return listing.description_short_es || listing.description_short || '';
}

/**
 * Get the localized full description for a listing.
 */
export function getLocalizedFullDescription(listing: Listing, locale: string): string {
  if (locale === 'en') {
    return listing.description_full_en || listing.description_full || '';
  }
  return listing.description_full_es || listing.description_full || '';
}
