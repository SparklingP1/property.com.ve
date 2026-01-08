/**
 * Smart search parser for natural language property queries
 * Extracts structured filters from user input like "2 bedroom apartment Caracas"
 */

export interface ParsedSearchQuery {
  bedrooms?: number;
  bathrooms?: number;
  propertyType?: string;
  transactionType?: 'sale' | 'rent';
  furnished?: boolean;
  remainingKeywords: string;
}

// Number word mappings (English and Spanish)
const numberWords: Record<string, number> = {
  // English
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  // Spanish
  un: 1,
  una: 1,
  uno: 1,
  dos: 2,
  tres: 3,
  cuatro: 4,
  cinco: 5,
  seis: 6,
};

// Property type patterns (English and Spanish)
const propertyTypePatterns = [
  { pattern: /\b(apartment|apartments|apto|aptos|apartamento|apartamentos)\b/gi, type: 'apartment' },
  { pattern: /\b(house|houses|casa|casas)\b/gi, type: 'house' },
  { pattern: /\b(land|terreno|terrenos)\b/gi, type: 'land' },
  { pattern: /\b(commercial|comercial|comerciales)\b/gi, type: 'commercial' },
  { pattern: /\b(office|offices|oficina|oficinas)\b/gi, type: 'office' },
];

// Transaction type patterns (English and Spanish)
const transactionTypePatterns = [
  { pattern: /\b(for rent|to rent|rental|rentals|alquiler|en alquiler|para alquilar)\b/gi, type: 'rent' as const },
  { pattern: /\b(for sale|to buy|sale|venta|en venta|para vender)\b/gi, type: 'sale' as const },
];

// Furnished patterns (English and Spanish)
const furnishedPatterns = {
  yes: /\b(furnished|amueblado|amueblada|amueblados|con muebles)\b/gi,
  no: /\b(unfurnished|sin muebles|sin amueblar)\b/gi,
};

// Bedroom pattern (combined - removed global flag to avoid state issues)
const bedroomPattern = /\b(\d+|one|two|three|four|five|six|un|una|uno|dos|tres|cuatro|cinco|seis)\s*(?:bedroom|bedrooms|br|bed|hab|habitacion|habitaciones)\b/i;

// Bathroom pattern (combined - removed global flag to avoid state issues)
const bathroomPattern = /\b(\d+|one|two|three|four|five|six|un|una|uno|dos|tres|cuatro|cinco|seis)\s*(?:bathroom|bathrooms|ba|bath|baño|baños)\b/i;

export function parseSearchQuery(query: string): ParsedSearchQuery {
  if (!query || typeof query !== 'string') {
    return { remainingKeywords: '' };
  }

  let remaining = query.toLowerCase();
  const result: ParsedSearchQuery = {
    remainingKeywords: '',
  };

  // Extract property type
  for (const { pattern, type } of propertyTypePatterns) {
    if (pattern.test(remaining)) {
      result.propertyType = type;
      remaining = remaining.replace(pattern, ' ');
      break; // Only match first property type
    }
  }

  // Extract transaction type
  for (const { pattern, type } of transactionTypePatterns) {
    if (pattern.test(remaining)) {
      result.transactionType = type;
      remaining = remaining.replace(pattern, ' ');
      break; // Only match first transaction type
    }
  }

  // Extract furnished status
  if (furnishedPatterns.yes.test(remaining)) {
    result.furnished = true;
    remaining = remaining.replace(furnishedPatterns.yes, ' ');
  } else if (furnishedPatterns.no.test(remaining)) {
    result.furnished = false;
    remaining = remaining.replace(furnishedPatterns.no, ' ');
  }

  // Bedroom/bathroom parsing disabled - too confusing for users
  // (they expect exact matches, not "1+ bedrooms")
  // Users can still use the manual filter dropdowns for precise bedroom/bathroom filtering

  // Extract bedrooms - DISABLED
  // const bedroomMatch = bedroomPattern.exec(remaining);
  // if (bedroomMatch) {
  //   const value = bedroomMatch[1];
  //   const numValue = parseInt(value, 10);
  //   if (!isNaN(numValue)) {
  //     result.bedrooms = numValue;
  //   } else {
  //     const wordNum = numberWords[value.toLowerCase()];
  //     if (wordNum) {
  //       result.bedrooms = wordNum;
  //     }
  //   }
  //   remaining = remaining.replace(bedroomMatch[0], ' ');
  // }

  // Extract bathrooms - DISABLED
  // const bathroomMatch = bathroomPattern.exec(remaining);
  // if (bathroomMatch) {
  //   const value = bathroomMatch[1];
  //   const numValue = parseInt(value, 10);
  //   if (!isNaN(numValue)) {
  //     result.bathrooms = numValue;
  //   } else {
  //     const wordNum = numberWords[value.toLowerCase()];
  //     if (wordNum) {
  //       result.bathrooms = wordNum;
  //     }
  //   }
  //   remaining = remaining.replace(bathroomMatch[0], ' ');
  // }

  // Clean up remaining keywords (remove extra spaces)
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
 */
