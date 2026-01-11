/**
 * Tests for SEO URL parser
 */

import { parseSEOUrl, generateSEOUrl, getPageTitle, getMetaDescription } from './seo-url-parser';

// Test cases from actual analysis results
const testCases = [
  {
    url: '/apartments-caracas',
    expected: { city: 'Caracas', property_type: 'apartment' },
    title: 'Apartments in Caracas',
  },
  {
    url: '/2-bedroom-apartments-caracas',
    expected: { city: 'Caracas', property_type: 'apartment', bedrooms: 2 },
    title: '2 Bedroom Apartments in Caracas',
  },
  {
    url: '/houses-valencia',
    expected: { city: 'Valencia', property_type: 'house' },
    title: 'Houses in Valencia',
  },
  {
    url: '/3-bedroom-houses-caracas',
    expected: { city: 'Caracas', property_type: 'house', bedrooms: 3 },
    title: '3 Bedroom Houses in Caracas',
  },
  {
    url: '/land-margarita',
    expected: { city: 'Margarita', property_type: 'land' },
    title: 'Land in Margarita',
  },
  {
    url: '/apartments-distrito-metropolitano-state',
    expected: { state: 'Distrito Metropolitano', property_type: 'apartment' },
    title: 'Apartments in Distrito Metropolitano',
  },
  {
    url: '/4-bedroom-apartments-los-teques',
    expected: { city: 'Los Teques', property_type: 'apartment', bedrooms: 4 },
    title: '4 Bedroom Apartments in Los Teques',
  },
];

console.log('🧪 Testing SEO URL Parser\n');

let passed = 0;
let failed = 0;

testCases.forEach((test, index) => {
  const result = parseSEOUrl(test.url);

  console.log(`Test ${index + 1}: ${test.url}`);

  if (!result.isValid) {
    console.log(`  ❌ FAILED: ${result.error}`);
    failed++;
    return;
  }

  const filtersMatch =
    JSON.stringify(result.filters) === JSON.stringify(test.expected);

  const titleMatch = getPageTitle(result.filters) === test.title;

  if (filtersMatch && titleMatch) {
    console.log(`  ✅ PASSED`);
    console.log(`     Filters: ${JSON.stringify(result.filters)}`);
    console.log(`     Title: ${getPageTitle(result.filters)}`);
    passed++;
  } else {
    console.log(`  ❌ FAILED`);
    console.log(`     Expected: ${JSON.stringify(test.expected)}`);
    console.log(`     Got: ${JSON.stringify(result.filters)}`);
    console.log(`     Expected title: ${test.title}`);
    console.log(`     Got title: ${getPageTitle(result.filters)}`);
    failed++;
  }

  // Test round-trip (generate URL from filters)
  const generated = generateSEOUrl(result.filters);
  if (generated === test.url) {
    console.log(`     Round-trip: ✅ ${generated}`);
  } else {
    console.log(`     Round-trip: ⚠️  ${test.url} → ${generated}`);
  }

  console.log('');
});

console.log(`\n📊 Results: ${passed} passed, ${failed} failed`);

// Test meta descriptions
console.log('\n📝 Sample Meta Descriptions:\n');
console.log(getMetaDescription({ city: 'Caracas', property_type: 'apartment' }, 252));
console.log(getMetaDescription({ city: 'Caracas', property_type: 'apartment', bedrooms: 2 }, 52));
console.log(getMetaDescription({ city: 'Valencia', property_type: 'house' }, 0));

process.exit(failed > 0 ? 1 : 0);
