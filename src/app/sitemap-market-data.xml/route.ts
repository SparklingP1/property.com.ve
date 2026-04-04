import { getValidCities } from '@/lib/supabase/market-data-queries';

export const revalidate = 86400; // 24 hours

function slugify(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';
  const now = new Date().toISOString();

  const cities = await getValidCities();

  // Static pages: hub + methodology
  const staticPages = [
    {
      esPath: '/precios-de-casas-en-venezuela',
      enPath: '/en/property-prices-in-venezuela',
      priority: 0.9,
      changefreq: 'monthly',
    },
    {
      esPath: '/precios-de-casas-en-venezuela/metodologia',
      enPath: '/en/property-prices-in-venezuela/methodology',
      priority: 0.5,
      changefreq: 'yearly',
    },
  ];

  // City pages
  const cityPages = cities.map(c => ({
    esPath: `/precios-de-casas-en-${slugify(c.city)}`,
    enPath: `/en/property-prices-in-${slugify(c.city)}`,
    priority: 0.8,
    changefreq: 'monthly',
  }));

  const allPages = [...staticPages, ...cityPages];

  const urls = allPages.flatMap(page => {
    const esUrl = `${baseUrl}${page.esPath}`;
    const enUrl = `${baseUrl}${page.enPath}`;
    const hreflang = `
    <xhtml:link rel="alternate" hreflang="es" href="${esUrl}" />
    <xhtml:link rel="alternate" hreflang="en" href="${enUrl}" />`;

    return [
      `  <url>
    <loc>${esUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>${hreflang}
  </url>`,
      `  <url>
    <loc>${enUrl}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
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
