/**
 * Parse flat SEO URLs to extract filter parameters
 * Examples:
 *   /apartments-caracas → {city: "Caracas", property_type: "apartment"}
 *   /2-bedroom-apartments-caracas → {city: "Caracas", property_type: "apartment", bedrooms: 2}
 *   /apartments-miranda-state → {state: "Miranda", property_type: "apartment"}
 */

export interface SEOPageFilters {
  city?: string;
  state?: string;
  property_type?: 'apartment' | 'house' | 'land' | 'commercial' | 'office';
  bedrooms?: number;
}

export interface ParsedSEOURL {
  filters: SEOPageFilters;
  slug: string;  // The full original slug
  isValid: boolean;
  error?: string;
}

/**
 * Property type mapping: URL slug → database value
 */
const PROPERTY_TYPE_MAP: Record<string, 'apartment' | 'house' | 'land' | 'commercial' | 'office'> = {
  'apartments': 'apartment',
  'apartment': 'apartment',
  'houses': 'house',
  'house': 'house',
  'land': 'land',
  'commercial': 'commercial',
  'office': 'office',
};

/**
 * Capitalize each word in a string
 */
function capitalize(str: string): string {
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Parse a flat SEO URL slug into filters
 */
export function parseSEOUrl(slug: string): ParsedSEOURL {
  // Remove leading slash if present
  const cleanSlug = slug.startsWith('/') ? slug.slice(1) : slug;

  // Split by hyphens
  const parts = cleanSlug.split('-');

  const filters: SEOPageFilters = {};
  let isValid = false;
  let error: string | undefined;

  try {
    // Check if this is a bedroom-specific page
    // Format: {number}-bedroom-{type}-{city}
    if (parts.length >= 4 && parts[1] === 'bedroom') {
      const bedrooms = parseInt(parts[0], 10);
      if (isNaN(bedrooms) || bedrooms < 1 || bedrooms > 10) {
        error = `Invalid bedroom count: ${parts[0]}`;
        return { filters, slug: cleanSlug, isValid: false, error };
      }

      filters.bedrooms = bedrooms;

      // Extract property type (parts[2])
      const typeSlug = parts[2];
      const propertyType = PROPERTY_TYPE_MAP[typeSlug];

      if (!propertyType) {
        error = `Invalid property type: ${typeSlug}`;
        return { filters, slug: cleanSlug, isValid: false, error };
      }

      filters.property_type = propertyType;

      // Remaining parts are location (city or state)
      const locationParts = parts.slice(3);

      // Check if it's a state page (ends with "state")
      if (locationParts[locationParts.length - 1] === 'state') {
        filters.state = capitalize(locationParts.slice(0, -1).join('-'));
      } else {
        filters.city = capitalize(locationParts.join('-'));
      }

      isValid = true;
    }
    // Format: {type}-{city/state}
    else if (parts.length >= 2) {
      const typeSlug = parts[0];
      const propertyType = PROPERTY_TYPE_MAP[typeSlug];

      if (!propertyType) {
        error = `Invalid property type: ${typeSlug}`;
        return { filters, slug: cleanSlug, isValid: false, error };
      }

      filters.property_type = propertyType;

      // Remaining parts are location
      const locationParts = parts.slice(1);

      // Check if it's a state page (ends with "state")
      if (locationParts[locationParts.length - 1] === 'state') {
        filters.state = capitalize(locationParts.slice(0, -1).join('-'));
      } else {
        filters.city = capitalize(locationParts.join('-'));
      }

      isValid = true;
    } else {
      error = 'URL format not recognized';
    }
  } catch (e) {
    error = e instanceof Error ? e.message : 'Unknown parsing error';
    isValid = false;
  }

  return {
    filters,
    slug: cleanSlug,
    isValid,
    error,
  };
}

/**
 * Generate a flat SEO URL from filters
 * Inverse of parseSEOUrl
 */
export function generateSEOUrl(filters: SEOPageFilters): string {
  const parts: string[] = [];

  // Add bedroom count if present
  if (filters.bedrooms && filters.bedrooms > 0) {
    parts.push(`${filters.bedrooms}-bedroom`);
  }

  // Add property type (plural form for URL)
  if (filters.property_type) {
    const typeSlug =
      filters.property_type === 'apartment' ? 'apartments' :
      filters.property_type === 'house' ? 'houses' :
      filters.property_type;
    parts.push(typeSlug);
  }

  // Add location (city or state)
  if (filters.city) {
    const citySlug = filters.city.toLowerCase().replace(/\s+/g, '-');
    parts.push(citySlug);
  } else if (filters.state) {
    const stateSlug = filters.state.toLowerCase().replace(/\s+/g, '-');
    parts.push(stateSlug, 'state');
  }

  return '/' + parts.join('-');
}

/**
 * Get human-readable page title from filters
 */
export function getPageTitle(filters: SEOPageFilters): string {
  const parts: string[] = [];

  // Bedrooms
  if (filters.bedrooms) {
    parts.push(`${filters.bedrooms} Bedroom`);
  }

  // Property type
  if (filters.property_type) {
    const type =
      filters.property_type === 'apartment' ? 'Apartments' :
      filters.property_type === 'house' ? 'Houses' :
      filters.property_type === 'land' ? 'Land' :
      filters.property_type === 'commercial' ? 'Commercial Properties' :
      filters.property_type === 'office' ? 'Office Spaces' :
      filters.property_type;
    parts.push(type);
  }

  // Location
  if (filters.city) {
    parts.push('in', filters.city);
  } else if (filters.state) {
    parts.push('in', filters.state);
  }

  return parts.join(' ');
}

/**
 * Get meta description template from filters
 */
export function getMetaDescription(filters: SEOPageFilters, listingCount: number): string {
  const title = getPageTitle(filters);

  if (listingCount === 0) {
    return `Explore ${title.toLowerCase()} on Property.com.ve. New listings added regularly.`;
  }

  return `Browse ${listingCount} ${title.toLowerCase()} for sale on Property.com.ve. Find your dream property in Venezuela today.`;
}
