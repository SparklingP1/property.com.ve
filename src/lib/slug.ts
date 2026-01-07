/**
 * SEO-friendly URL slug generation for property listings
 *
 * Format: {bedrooms}-bed-{property_type}-{neighborhood}-for-sale-{short_id}
 * Example: 3-bed-apartment-cumbres-de-curumo-for-sale-abc123
 */

import type { Listing } from '@/types/listing';

/**
 * Slugify a string (remove accents, lowercase, replace spaces with hyphens)
 */
export function slugify(text: string): string {
  return text
    .toString()
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, '') // Remove non-word chars except hyphens
    .replace(/\-\-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-+/, '') // Trim hyphens from start
    .replace(/-+$/, ''); // Trim hyphens from end
}

/**
 * Generate a short unique ID from the listing ID
 * Takes last 8 characters of the ID
 */
export function getShortId(id: string): string {
  return id.slice(-8).toLowerCase();
}

/**
 * Generate SEO-friendly URL slug for a listing
 *
 * Format: {bedrooms}-bed-{property_type}-{neighborhood}-for-sale-{short_id}
 *
 * Examples:
 * - 3-bed-apartment-cumbres-de-curumo-for-sale-abc12345
 * - 4-bed-house-valencia-for-sale-def67890
 * - apartment-caracas-for-sale-ghi11223 (when bedrooms is null)
 */
export function generateListingSlug(listing: Listing | {
  id: string;
  bedrooms: number | null;
  property_type: string | null;
  neighborhood: string | null;
  city: string | null;
  transaction_type?: string | null;
}): string {
  const parts: string[] = [];

  // Add bedrooms if available
  if (listing.bedrooms) {
    parts.push(`${listing.bedrooms}-bed`);
  }

  // Add property type
  if (listing.property_type) {
    parts.push(slugify(listing.property_type));
  }

  // Add neighborhood, fallback to city
  const location = listing.neighborhood || listing.city;
  if (location) {
    parts.push(slugify(location));
  }

  // Add transaction type (for-sale or for-rent)
  const transactionType = listing.transaction_type || 'sale';
  parts.push(`for-${transactionType}`);

  // Add short ID for uniqueness
  parts.push(getShortId(listing.id));

  return parts.join('-');
}

/**
 * Generate the full URL path for a listing
 *
 * Format: /property/{state}/{city}/{slug}
 *
 * Examples:
 * - /property/miranda/caracas/3-bed-apartment-cumbres-de-curumo-for-sale-abc12345
 * - /property/carabobo/valencia/4-bed-house-for-sale-def67890
 */
export function getListingUrl(listing: Listing | {
  id: string;
  state: string | null;
  city: string | null;
  bedrooms: number | null;
  property_type: string | null;
  neighborhood: string | null;
  transaction_type?: string | null;
  url_slug?: string | null;
}): string {
  // Use pre-generated slug if available
  const slug = listing.url_slug || generateListingSlug(listing);

  // Get state and city (use 'venezuela' as fallback)
  const state = listing.state ? slugify(listing.state) : 'venezuela';
  const city = listing.city ? slugify(listing.city) : 'property';

  return `/property/${state}/${city}/${slug}`;
}

/**
 * Parse a listing slug to extract the ID
 * Used for reverse lookups when we have a URL slug
 */
export function parseListingSlug(slug: string): { shortId: string } {
  // Slug format: {bedrooms}-bed-{property_type}-{location}-for-sale-{short_id}
  // Extract the last segment (short ID)
  const parts = slug.split('-');
  const shortId = parts[parts.length - 1];

  return { shortId };
}
