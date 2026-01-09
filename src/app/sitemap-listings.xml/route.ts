import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';
import { getListingUrl } from '@/lib/slug';
import type { Listing } from '@/types/listing';

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
    const supabase = createServiceClient();

    // First, get total count of active listings
    const { count } = await supabase
      .from('listings')
      .select('*', { count: 'exact', head: true })
      .eq('active', true);

    if (!count || count === 0) {
      return new Response(`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=1800',
        },
      });
    }

    // Supabase has a 1000 row limit per query, so we need to paginate
    // Fetch in batches of 1000 up to sitemap limit of 50,000
    const batchSize = 1000;
    const maxListings = Math.min(count, 50000); // Sitemap limit
    const allListings = [];

    for (let offset = 0; offset < maxListings; offset += batchSize) {
      const { data: batch } = await supabase
        .from('listings')
        .select('id, state, city, bedrooms, property_type, neighborhood, transaction_type, url_slug, scraped_at, last_seen_at')
        .eq('active', true)
        .order('last_seen_at', { ascending: false })
        .range(offset, offset + batchSize - 1);

      if (batch && batch.length > 0) {
        allListings.push(...batch);
      }

      // If we got fewer than batchSize, we've reached the end
      if (!batch || batch.length < batchSize) {
        break;
      }
    }

    if (allListings.length > 0) {
      listingPages = allListings.map((listing) => ({
        url: `${baseUrl}${getListingUrl(listing as Listing)}`,
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
