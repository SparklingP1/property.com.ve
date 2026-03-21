import { MetadataRoute } from 'next';

/**
 * Static pages sitemap with hreflang for bilingual support
 * Cached longer since these rarely change
 */
export const revalidate = 86400; // 24 hours

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  const staticPages: MetadataRoute.Sitemap = [
    { url: '', changeFrequency: 'daily' as const, priority: 1.0 },
    { url: '/search', changeFrequency: 'daily' as const, priority: 0.9 },
    { url: '/guides', changeFrequency: 'weekly' as const, priority: 0.9 },
    { url: '/browse-by-area', changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: '/find-property', changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: '/list-your-property', changeFrequency: 'monthly' as const, priority: 0.7 },
    { url: '/about', changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: '/disclaimer', changeFrequency: 'yearly' as const, priority: 0.3 },
    { url: '/takedown', changeFrequency: 'yearly' as const, priority: 0.3 },
  ];

  const now = new Date().toISOString();

  const urls = staticPages.flatMap((page) => {
    const esUrl = `${baseUrl}${page.url}`;
    const enUrl = `${baseUrl}/en${page.url}`;
    const hreflang = `
    <xhtml:link rel="alternate" hreflang="es" href="${esUrl}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />`;

    return [
      `  <url>
    <loc>${esUrl || baseUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>${hreflang}
  </url>`,
      `  <url>
    <loc>${enUrl || `${baseUrl}/en`}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changeFrequency}</changefreq>
    <priority>${page.priority}</priority>${hreflang}
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
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=43200',
    },
  });
}
