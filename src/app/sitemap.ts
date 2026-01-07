import { MetadataRoute } from 'next';

/**
 * Sitemap Index
 * Points to segmented sitemaps for better performance and caching
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://property.com.ve';

  return [
    {
      url: `${baseUrl}/sitemap-static.xml`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/sitemap-guides.xml`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/sitemap-listings.xml`,
      lastModified: new Date(),
    },
    {
      url: `${baseUrl}/sitemap-locations.xml`,
      lastModified: new Date(),
    },
  ];
}
