import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: [
      `${baseUrl}/sitemap-static.xml`,
      `${baseUrl}/sitemap-guides.xml`,
      `${baseUrl}/sitemap-locations.xml`,
      `${baseUrl}/sitemap-seo-pages.xml`,
    ],
  };
}
