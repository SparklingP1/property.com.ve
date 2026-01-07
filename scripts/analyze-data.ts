import { createClient } from '@supabase/supabase-js';

// Supabase credentials - use environment variables in production
const supabaseUrl = 'https://iazujqtkfaqbupcdbrjp.supabase.co';
const supabaseKey =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlhenVqcXRrZmFxYnVwY2RicmpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY3ODgzMDAsImV4cCI6MjA1MjM2NDMwMH0.1uM_czzOGPRUMYHSEOBamwCbVA6wL6Eq1ZdY8T_LjQQ';

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeListings() {
  console.log('📊 Analyzing listing data fields...\n');

  const { data: listings, error, count } = await supabase
    .from('listings')
    .select('*', { count: 'exact' })
    .eq('active', true);

  if (error) {
    console.error('Error fetching listings:', error);
    return;
  }

  console.log(`Total active listings: ${count}\n`);

  if (!listings || listings.length === 0) {
    console.log('No listings found');
    return;
  }

  // Fields to analyze
  const fields = [
    'price',
    'currency',
    'bedrooms',
    'bathrooms',
    'area_sqm',
    'total_area_sqm',
    'parking_spaces',
    'property_type',
    'transaction_type',
    'city',
    'state',
    'region',
    'location',
    'neighborhood',
    'condition',
    'furnished',
    'property_style',
    'amenities',
  ];

  const analysis: Record<string, any> = {};

  for (const field of fields) {
    const populated = listings.filter(
      (l: any) =>
        l[field] !== null &&
        l[field] !== undefined &&
        l[field] !== '' &&
        (Array.isArray(l[field]) ? l[field].length > 0 : true)
    );

    const percentage = ((populated.length / listings.length) * 100).toFixed(1);

    analysis[field] = {
      populated: populated.length,
      percentage: `${percentage}%`,
    };

    // For categorical fields, get unique values
    if (
      [
        'property_type',
        'transaction_type',
        'currency',
        'city',
        'state',
        'region',
        'condition',
        'property_style',
      ].includes(field)
    ) {
      const values = new Set(populated.map((l: any) => l[field]));
      analysis[field].uniqueValues = Array.from(values).slice(0, 10); // Top 10
    }

    // For numeric fields, get ranges
    if (
      ['price', 'bedrooms', 'bathrooms', 'area_sqm', 'parking_spaces'].includes(
        field
      )
    ) {
      const values = populated.map((l: any) => l[field]).filter((v) => v > 0);
      if (values.length > 0) {
        analysis[field].min = Math.min(...values);
        analysis[field].max = Math.max(...values);
        analysis[field].avg = (
          values.reduce((a, b) => a + b, 0) / values.length
        ).toFixed(0);
      }
    }

    // For boolean fields
    if (['furnished'].includes(field)) {
      const trueCount = populated.filter((l: any) => l[field] === true).length;
      analysis[field].true = trueCount;
      analysis[field].false = populated.length - trueCount;
    }
  }

  // Print analysis
  console.log('📈 Field Population Analysis:\n');
  console.log('Field                  | Populated  | %     | Details');
  console.log('─'.repeat(80));

  for (const [field, data] of Object.entries(analysis)) {
    const details = [];
    if (data.uniqueValues) {
      details.push(
        `${data.uniqueValues.length} unique: ${data.uniqueValues.slice(0, 3).join(', ')}...`
      );
    }
    if (data.min !== undefined) {
      details.push(`Range: ${data.min}-${data.max}, Avg: ${data.avg}`);
    }
    if (data.true !== undefined) {
      details.push(`Yes: ${data.true}, No: ${data.false}`);
    }

    console.log(
      `${field.padEnd(22)} | ${String(data.populated).padEnd(10)} | ${data.percentage.padEnd(5)} | ${details.join('; ')}`
    );
  }

  console.log('\n✅ Analysis complete!');
}

analyzeListings().catch(console.error);
