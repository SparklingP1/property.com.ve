/**
 * Smart search parser for natural language property queries.
 * Extracts structured filters from user input like "apartment Caracas for rent".
 */

export interface ParsedSearchQuery {
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  transactionType?: 'sale' | 'rent';
  furnished?: boolean;
  remainingKeywords: string;
}

const propertyTypePatterns = [
  { pattern: /\b(apartment|apartments|apto|aptos|apartamento|apartamentos)\b/gi, type: 'apartment' },
  { pattern: /\b(house|houses|casa|casas)\b/gi, type: 'house' },
  { pattern: /\b(land|terreno|terrenos)\b/gi, type: 'land' },
  { pattern: /\b(commercial|comercial|comerciales)\b/gi, type: 'commercial' },
  { pattern: /\b(office|offices|oficina|oficinas)\b/gi, type: 'office' },
];

const transactionTypePatterns = [
  {
    pattern: /\b(for rent|to rent|rental|rentals|alquiler|en alquiler|para alquilar)\b/gi,
    type: 'rent' as const,
  },
  {
    pattern: /\b(for sale|to buy|sale|venta|en venta|para vender)\b/gi,
    type: 'sale' as const,
  },
];

const furnishedPatterns = {
  yes: /\b(furnished|amueblado|amueblada|amueblados|con muebles)\b/gi,
  no: /\b(unfurnished|sin muebles|sin amueblar)\b/gi,
};

export function parseSearchQuery(query: string): ParsedSearchQuery {
  if (!query || typeof query !== 'string') {
    return { remainingKeywords: '' };
  }

  let remaining = query.toLowerCase();
  const result: ParsedSearchQuery = {
    remainingKeywords: '',
  };

  for (const { pattern, type } of propertyTypePatterns) {
    if (pattern.test(remaining)) {
      result.propertyType = type;
      remaining = remaining.replace(pattern, ' ');
      break;
    }
  }

  for (const { pattern, type } of transactionTypePatterns) {
    if (pattern.test(remaining)) {
      result.transactionType = type;
      remaining = remaining.replace(pattern, ' ');
      break;
    }
  }

  if (furnishedPatterns.yes.test(remaining)) {
    result.furnished = true;
    remaining = remaining.replace(furnishedPatterns.yes, ' ');
  } else if (furnishedPatterns.no.test(remaining)) {
    result.furnished = false;
    remaining = remaining.replace(furnishedPatterns.no, ' ');
  }

  result.remainingKeywords = remaining.trim().replace(/\s+/g, ' ');

  return result;
}

/**
 * Example usage:
 *
 * parseSearchQuery("2 bedroom apartment Caracas")
 * => { bedrooms: 2, propertyType: 'apartment', remainingKeywords: 'caracas' }
 *
 * parseSearchQuery("casa de 3 habitaciones en venta Valencia")
 * => { bedrooms: 3, propertyType: 'house', transactionType: 'sale', remainingKeywords: 'valencia' }
 *
 * parseSearchQuery("furnished 1br for rent")
 * => { bedrooms: 1, furnished: true, transactionType: 'rent', remainingKeywords: '' }
 *
 * parseSearchQuery("apartamento amueblado ba\u00f1o caracas")
 * => { furnished: true, remainingKeywords: 'ba\u00f1o caracas' }
 */
