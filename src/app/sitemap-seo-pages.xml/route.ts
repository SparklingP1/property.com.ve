import { MetadataRoute } from 'next';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Programmatic SEO pages sitemap
 * Includes all flat-URL landing pages like /apartments-caracas, /2-bedroom-houses-valencia
 * Generated from seo_page_content table
 * Regenerated every 24 hours (pages are relatively static)
 */
export const revalidate = 86400; // 24 hours

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  const seoPages: MetadataRoute.Sitemap = [];

  try {
    const supabase = createServiceClient();

    // Fetch all SEO pages from database
    const { data: pages, error } = await supabase
      .from('seo_page_content')
      .select('page_slug, updated_at, listing_count')
      .order('listing_count', { ascending: false }); // Highest traffic pages first

    if (error) {
      console.error('Sitemap SEO Pages: Error fetching from database', error);
    } else if (pages) {
      pages.forEach((page) => {
        seoPages.push({
          url: `${baseUrl}${page.page_slug}`,
          lastModified: new Date(page.updated_at),
          changeFrequency: 'weekly' as const,
          // Higher priority for pages with more listings (they're more valuable)
          priority: page.listing_count > 50 ? 0.9 : page.listing_count > 20 ? 0.8 : 0.7,
        });
      });
    }
  } catch (error) {
    console.error('Sitemap SEO Pages: Unexpected error', error);
  }

  // If no pages found, return minimal sitemap
  if (seoPages.length === 0) {
    console.warn('Sitemap SEO Pages: No pages found in seo_page_content table');
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${seoPages
  .map((page) => {
    const lastMod =
      page.lastModified instanceof Date ? page.lastModified.toISOString() : page.lastModified;
    return `  <url>
    <loc>${page.url}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>
  </url>`;
  })
  .join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  });
}
