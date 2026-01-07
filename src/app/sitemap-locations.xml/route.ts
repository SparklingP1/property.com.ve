import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

/**
 * Location-based search pages sitemap
 * These pages rank well for "apartments in [city]" queries
 * Regenerated every 6 hours
 */
export const revalidate = 21600; // 6 hours

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  const locationPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();

    // Get unique states with active listings
    const { data: statesData } = await supabase
      .from('listings')
      .select('state')
      .eq('active', true)
      .not('state', 'is', null);

    const uniqueStates = [...new Set(statesData?.map((s) => s.state) || [])];

    // Add state-level search pages
    uniqueStates.forEach((state) => {
      if (state) {
        locationPages.push({
          url: `${baseUrl}/search?state=${encodeURIComponent(state)}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.8,
        });
      }
    });

    // Get unique cities with active listings
    const { data: citiesData } = await supabase
      .from('listings')
      .select('city, state')
      .eq('active', true)
      .not('city', 'is', null);

    const uniqueCities = [
      ...new Set(
        citiesData?.map((c) => `${c.city}|${c.state}`).filter((c) => c && !c.startsWith('|')) || []
      ),
    ];

    // Add city-level search pages (top cities only to avoid bloat)
    uniqueCities.slice(0, 100).forEach((cityState) => {
      const [city, state] = cityState.split('|');
      if (city && state) {
        locationPages.push({
          url: `${baseUrl}/search?state=${encodeURIComponent(state)}&city=${encodeURIComponent(city)}`,
          lastModified: new Date(),
          changeFrequency: 'daily' as const,
          priority: 0.7,
        });
      }
    });

    // Add property type combinations for major states
    const propertyTypes = ['apartment', 'house', 'land'];
    const majorStates = uniqueStates.slice(0, 10); // Top 10 states

    majorStates.forEach((state) => {
      propertyTypes.forEach((type) => {
        if (state) {
          locationPages.push({
            url: `${baseUrl}/search?state=${encodeURIComponent(state)}&property_type=${type}`,
            lastModified: new Date(),
            changeFrequency: 'daily' as const,
            priority: 0.7,
          });
        }
      });
    });
  } catch (error) {
    console.error('Sitemap: Unable to fetch locations from Supabase', error);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locationPages
  .map(
    (page) => `  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.lastModified?.toISOString()}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=21600, stale-while-revalidate=3600',
    },
  });
}
