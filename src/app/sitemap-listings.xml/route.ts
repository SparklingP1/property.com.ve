import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

/**
 * Property listings sitemap
 * Regenerated every hour since listings change frequently
 * Includes up to 50,000 listings (sitemap limit)
 */
export const revalidate = 3600; // 1 hour

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  let listingPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = await createClient();

    // Fetch all active listings (up to 50,000 - sitemap limit)
    // Prioritize recently updated listings
    const { data: listings } = await supabase
      .from('listings')
      .select('id, scraped_at, last_seen_at, active')
      .eq('active', true)
      .order('last_seen_at', { ascending: false })
      .limit(50000); // Sitemap max limit

    if (listings) {
      listingPages = listings.map((listing) => ({
        url: `${baseUrl}/listing/${listing.id}`,
        // Use last_seen_at for more accurate "when was this last confirmed"
        lastModified: new Date(listing.last_seen_at || listing.scraped_at),
        changeFrequency: 'daily' as const,
        priority: 0.8,
      }));
    }
  } catch (error) {
    console.error('Sitemap: Unable to fetch listings from Supabase', error);
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${listingPages
  .map(
    (page) => {
      const lastMod = page.lastModified instanceof Date
        ? page.lastModified.toISOString()
        : page.lastModified;
      return `  <url>
    <loc>${page.url}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
    }
  )
  .join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      // Cache for 1 hour, allow stale content for 30 min while revalidating
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800',
    },
  });
}
