import { createServiceClient } from '@/lib/supabase/server';

/**
 * Programmatic SEO pages sitemap with hreflang
 * Uses locale-specific slugs: Spanish slugs for ES, English slugs for EN
 * Regenerated every 24 hours
 */
export const revalidate = 86400; // 24 hours

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  const urls: string[] = [];

  try {
    const supabase = createServiceClient();

    // Fetch both English and Spanish slugs
    const { data: pages, error } = await supabase
      .from('seo_page_content')
      .select('page_slug, page_slug_es, updated_at, listing_count')
      .gt('listing_count', 0)
      .order('listing_count', { ascending: false });

    if (error) {
      console.error('Sitemap SEO Pages: Error fetching from database', error);
    } else if (pages) {
      pages.forEach((page) => {
        const lastMod = new Date(page.updated_at).toISOString();
        const priority = page.listing_count > 50 ? 0.9 : page.listing_count > 20 ? 0.8 : 0.7;

        // Use Spanish slug for ES URL, English slug for EN URL
        const esSlug = page.page_slug_es || page.page_slug;
        const enSlug = page.page_slug;
        const esUrl = `${baseUrl}${esSlug}`;
        const enUrl = `${baseUrl}/en${enSlug}`;

        const hreflang = `
    <xhtml:link rel="alternate" hreflang="es" href="${esUrl}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />`;

        // Spanish version (default, no prefix) — uses Spanish slug
        urls.push(`  <url>
    <loc>${esUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>${hreflang}
  </url>`);

        // English version (/en/ prefix) — uses English slug
        urls.push(`  <url>
    <loc>${enUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>${hreflang}
  </url>`);
      });
    }
  } catch (error) {
    console.error('Sitemap SEO Pages: Unexpected error', error);
  }

  if (urls.length === 0) {
    console.warn('Sitemap SEO Pages: No pages found in seo_page_content table');
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.join('\n')}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  });
}
