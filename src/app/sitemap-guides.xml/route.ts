import { MetadataRoute } from 'next';
import { getAllGuides } from '@/lib/guides';

/**
 * Guide pages sitemap with hreflang for bilingual support
 * Uses locale-specific slugs: Spanish slugs for ES, English slugs for EN
 * Cached for 7 days since guides don't change often
 */
export const revalidate = 604800; // 7 days

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  const guides = getAllGuides();

  const urls = guides.flatMap((guide) => {
    const lastMod = new Date(guide.publishedAt).toISOString();
    const esSlug = guide.slug_es || guide.slug;
    const enSlug = guide.slug;
    const esUrl = `${baseUrl}/guides/${esSlug}`;
    const enUrl = `${baseUrl}/en/guides/${enSlug}`;
    const hreflang = `
    <xhtml:link rel="alternate" hreflang="es" href="${esUrl}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />`;

    return [
      `  <url>
    <loc>${esUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>${hreflang}
  </url>`,
      `  <url>
    <loc>${enUrl}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>${hreflang}
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
      'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
    },
  });
}
