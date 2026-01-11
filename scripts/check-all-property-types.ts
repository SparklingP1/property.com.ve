import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function check() {
  // Fetch ALL listings (Supabase defaults to 1000 limit)
  let allData: any[] = [];
  let from = 0;
  const pageSize = 1000;

  while (true) {
    const { data, error } = await supabase
      .from('listings')
      .select('property_type')
      .eq('active', true)
      .range(from, from + pageSize - 1);

    if (error) {
      console.error('Error:', error);
      break;
    }

    if (!data || data.length === 0) break;

    allData = allData.concat(data);
    console.log(`Fetched ${allData.length} listings...`);

    if (data.length < pageSize) break;
    from += pageSize;
  }

  const data = allData;

  const counts: Record<string, number> = {};
  data?.forEach(l => {
    const type = l.property_type || 'null';
    counts[type] = (counts[type] || 0) + 1;
  });

  console.log('All property types and counts:');
  Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      console.log(`${type}: ${count}`);
    });

  console.log('\nTotal:', data?.length);
}

check();
