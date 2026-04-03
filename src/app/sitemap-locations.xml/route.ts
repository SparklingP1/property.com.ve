import { createServiceClient } from '@/lib/supabase/server';
import { slugify } from '@/lib/slug';

/**
 * Location-based aggregate pages sitemap with hreflang
 * Points to /property/[state] and /property/[state]/[city] pages
 * Regenerated every 6 hours
 */
export const revalidate = 21600; // 6 hours

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  const paths: string[] = [];

  try {
    const supabase = createServiceClient();

    // Get unique states with active listings
    const { data: statesData } = await supabase
      .from('listings')
      .select('state')
      .eq('active', true)
      .not('state', 'is', null);

    const uniqueStates = [...new Set(statesData?.map((s) => s.state) || [])];

    uniqueStates.forEach((state) => {
      if (state) {
        paths.push(`/property/${slugify(state)}`);
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

    uniqueCities.forEach((cityState) => {
      const [city, state] = cityState.split('|');
      if (city && state) {
        paths.push(`/property/${slugify(state)}/${slugify(city)}`);
      }
    });
  } catch (error) {
    console.error('Sitemap: Unable to fetch locations from Supabase', error);
  }

  const now = new Date().toISOString();

  const urls = paths.flatMap((path) => {
    const esUrl = `${baseUrl}${path}`;
    const enUrl = `${baseUrl}/en${path}`;
    const priority = path.split('/').length > 3 ? 0.7 : 0.8; // city = 0.7, state = 0.8
    const hreflang = `
    <xhtml:link rel="alternate" hreflang="es" href="${esUrl}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />`;

    return [
      `  <url>
    <loc>${esUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>${hreflang}
  </url>`,
      `  <url>
    <loc>${enUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${priority}</priority>${hreflang}
  </url>`,
    ];
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=21600, stale-while-revalidate=3600',
    },
  });
}
