import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://iazujqtkfaqbupcdbrjp.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenVqcXRrZmFxYnVwY2RicmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY3ODgzMDAsImV4cCI6MjA1MjM2NDMwMH0.1uM_czzOGPRUMYHSEOBamwCbVA6wL6Eq1ZdY8T_LjQQ';

const supabase = createClient(supabaseUrl, supabaseKey);

interface FieldAnalysis {
  field: string;
  populated: number;
  empty: number;
  populationRate: string;
  uniqueValues?: number;
  sampleValues?: any[];
  dataType?: string;
  notes?: string;
}

async function comprehensiveGapAnalysis() {
  console.log('\n🔍 COMPREHENSIVE DATA GAP ANALYSIS\n');
  console.log('='.repeat(80));
  console.log('\n');

  // 1. Get total listing count
  const { data: listings, error, count } = await supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('active', true);

  if (error) {
    console.error('❌ Error fetching listings:', error);
    return;
  }

  console.log(`📊 TOTAL ACTIVE LISTINGS: ${count}\n`);

  if (!listings || listings.length === 0) {
    console.log('⚠️  No listings found in database\n');
    return;
  }

  // 2. Analyze all fields
  const allFields = [
    // Core fields
    'source',
    'source_url',
    'title',
    'price',
    'currency',

    // Location fields
    'location',
    'region',
    'city',
    'state',
    'neighborhood',

    // Property details
    'property_type',
    'transaction_type',
    'property_style',
    'condition',
    'furnished',

    // Size fields
    'bedrooms',
    'bathrooms',
    'parking_spaces',
    'area_sqm',
    'total_area_sqm',
    'land_area_sqm',

    // Media
    'thumbnail_url',
    'image_urls',
    'photo_count',

    // Descriptions
    'description_short',
    'description_full',

    // Agent/Reference
    'agent_name',
    'agent_office',
    'reference_code',

    // Rich data
    'amenities',
    'features',
  ];

  const analysis: FieldAnalysis[] = [];

  for (const field of allFields) {
    const populated = listings.filter((l: any) => {
      const value = l[field];
      if (value === null || value === undefined || value === '') return false;
      if (Array.isArray(value) && value.length === 0) return false;
      if (typeof value === 'object' && Object.keys(value).length === 0)
        return false;
      return true;
    });

    const empty = listings.length - populated.length;
    const rate = ((populated.length / listings.length) * 100).toFixed(1);

    const fieldAnalysis: FieldAnalysis = {
      field,
      populated: populated.length,
      empty,
      populationRate: `${rate}%`,
    };

    // Get sample values for categorical fields
    if (
      [
        'source',
        'property_type',
        'transaction_type',
        'currency',
        'city',
        'state',
        'condition',
        'property_style',
      ].includes(field)
    ) {
      const uniqueVals = new Set(populated.map((l: any) => l[field]));
      fieldAnalysis.uniqueValues = uniqueVals.size;
      fieldAnalysis.sampleValues = Array.from(uniqueVals).slice(0, 5);
    }

    // Get range for numeric fields
    if (
      [
        'price',
        'bedrooms',
        'bathrooms',
        'parking_spaces',
        'area_sqm',
        'photo_count',
      ].includes(field)
    ) {
      const values = populated
        .map((l: any) => l[field])
        .filter((v) => v !== null && v > 0);
      if (values.length > 0) {
        const min = Math.min(...values);
        const max = Math.max(...values);
        const avg = (
          values.reduce((a, b) => a + b, 0) / values.length
        ).toFixed(0);
        fieldAnalysis.notes = `Min: ${min}, Max: ${max}, Avg: ${avg}`;
      }
    }

    // Boolean fields
    if (['furnished'].includes(field)) {
      const trueCount = populated.filter((l: any) => l[field] === true).length;
      const falseCount = populated.length - trueCount;
      fieldAnalysis.notes = `True: ${trueCount}, False: ${falseCount}`;
    }

    analysis.push(fieldAnalysis);
  }

  // 3. Print analysis table
  console.log('\n📋 FIELD POPULATION ANALYSIS\n');
  console.log(
    'Field'.padEnd(25) +
      'Populated'.padEnd(12) +
      'Empty'.padEnd(10) +
      'Rate'.padEnd(10) +
      'Details'
  );
  console.log('-'.repeat(100));

  // Group by category
  const categories = {
    '🏷️  CORE FIELDS': ['source', 'source_url', 'title', 'price', 'currency'],
    '📍 LOCATION FIELDS': [
      'location',
      'region',
      'city',
      'state',
      'neighborhood',
    ],
    '🏠 PROPERTY DETAILS': [
      'property_type',
      'transaction_type',
      'property_style',
      'condition',
      'furnished',
    ],
    '📏 SIZE & CAPACITY': [
      'bedrooms',
      'bathrooms',
      'parking_spaces',
      'area_sqm',
      'total_area_sqm',
      'land_area_sqm',
    ],
    '📸 MEDIA': ['thumbnail_url', 'image_urls', 'photo_count'],
    '📝 DESCRIPTIONS': ['description_short', 'description_full'],
    '👤 AGENT/REFERENCE': ['agent_name', 'agent_office', 'reference_code'],
    '✨ RICH DATA': ['amenities', 'features'],
  };

  for (const [category, fields] of Object.entries(categories)) {
    console.log(`\n${category}`);
    for (const field of fields) {
      const data = analysis.find((a) => a.field === field);
      if (!data) continue;

      let details = '';
      if (data.sampleValues) {
        details = `Values: ${data.sampleValues.join(', ')}`;
        if (data.uniqueValues && data.uniqueValues > 5) {
          details += ` (+${data.uniqueValues - 5} more)`;
        }
      } else if (data.notes) {
        details = data.notes;
      }

      console.log(
        field.padEnd(25) +
          String(data.populated).padEnd(12) +
          String(data.empty).padEnd(10) +
          data.populationRate.padEnd(10) +
          details
      );
    }
  }

  // 4. Identify critical gaps
  console.log('\n\n⚠️  CRITICAL GAPS (Fields with <80% population)\n');
  console.log('-'.repeat(80));

  const criticalGaps = analysis.filter(
    (a) => parseFloat(a.populationRate) < 80
  );
  if (criticalGaps.length === 0) {
    console.log('✅ No critical gaps found - all fields have 80%+ population');
  } else {
    for (const gap of criticalGaps.sort(
      (a, b) =>
        parseFloat(a.populationRate) - parseFloat(b.populationRate)
    )) {
      console.log(
        `❌ ${gap.field.padEnd(25)} ${gap.populationRate.padStart(7)} populated`
      );
    }
  }

  // 5. Source breakdown
  console.log('\n\n📊 BREAKDOWN BY SOURCE\n');
  console.log('-'.repeat(80));

  const sourceBreakdown = listings.reduce((acc: any, l: any) => {
    const source = l.source || 'unknown';
    if (!acc[source]) {
      acc[source] = {
        count: 0,
        avgPrice: [],
        propertyTypes: new Set(),
        cities: new Set(),
      };
    }
    acc[source].count++;
    if (l.price) acc[source].avgPrice.push(l.price);
    if (l.property_type) acc[source].propertyTypes.add(l.property_type);
    if (l.city) acc[source].cities.add(l.city);
    return acc;
  }, {});

  for (const [source, data] of Object.entries(sourceBreakdown) as any) {
    const avgPrice = data.avgPrice.length
      ? (
          data.avgPrice.reduce((a: number, b: number) => a + b, 0) /
          data.avgPrice.length
        ).toFixed(0)
      : 'N/A';
    console.log(`\n${source.toUpperCase()}`);
    console.log(`  Count: ${data.count}`);
    console.log(`  Avg Price: $${avgPrice}`);
    console.log(`  Property Types: ${data.propertyTypes.size} types`);
    console.log(`  Cities: ${data.cities.size} unique cities`);
  }

  // 6. Sample listings for manual inspection
  console.log('\n\n🔎 SAMPLE LISTINGS FOR INSPECTION\n');
  console.log('-'.repeat(80));

  const samples = listings.slice(0, 3);
  for (const sample of samples) {
    console.log(`\nTitle: ${sample.title}`);
    console.log(`Source: ${sample.source}`);
    console.log(`URL: ${sample.source_url}`);
    console.log(`Price: ${sample.price} ${sample.currency}`);
    console.log(`Location: ${sample.city || sample.location}, ${sample.state || sample.region}`);
    console.log(
      `Property: ${sample.property_type} | ${sample.bedrooms}br ${sample.bathrooms}ba | ${sample.area_sqm}m²`
    );
    console.log(`Agent: ${sample.agent_name || 'N/A'}`);
    console.log(`Reference: ${sample.reference_code || 'N/A'}`);
    console.log(`Photos: ${sample.photo_count || 0}`);
    console.log(`Amenities: ${sample.amenities?.length || 0} items`);
  }

  // 7. Recommendations
  console.log('\n\n💡 GAP ANALYSIS RECOMMENDATIONS\n');
  console.log('='.repeat(80));

  console.log('\n1. SCRAPER EXTRACTION REVIEW:');
  if (criticalGaps.some((g) => g.field === 'transaction_type')) {
    console.log(
      '   ❌ Transaction type missing - review extraction for sale/rent indication'
    );
  }
  if (criticalGaps.some((g) => g.field === 'city')) {
    console.log(
      '   ❌ City field low - verify location parsing is extracting city correctly'
    );
  }
  if (criticalGaps.some((g) => g.field === 'amenities')) {
    console.log(
      '   ⚠️  Amenities sparse - check if source site has amenity lists to extract'
    );
  }
  if (criticalGaps.some((g) => g.field === 'agent_name')) {
    console.log(
      '   ⚠️  Agent name missing - verify if source displays agent information'
    );
  }

  console.log('\n2. SOURCE DATA LIMITATIONS:');
  console.log(
    '   • Some fields may not exist on source sites (expected gaps)'
  );
  console.log(
    '   • Manual verification needed to distinguish scraper vs. source gaps'
  );

  console.log('\n3. NEXT STEPS:');
  console.log('   a) Visit sample listing URLs manually to verify available data');
  console.log('   b) Compare scraped data against source HTML');
  console.log('   c) Update extraction logic for missing fields if data exists');
  console.log('   d) Document expected gaps where source data is unavailable');

  console.log('\n\n✅ Analysis complete!\n');
}

comprehensiveGapAnalysis().catch(console.error);
