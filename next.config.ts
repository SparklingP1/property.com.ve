import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 've.green-acres.com',
      },
      {
        protocol: 'https',
        hostname: '*.green-acres.com',
      },
      {
        protocol: 'https',
        hostname: 'venezuela.bienesonline.com',
      },
      {
        protocol: 'https',
        hostname: '*.bienesonline.com',
      },
      {
        protocol: 'https',
        hostname: 'rentahouse.com.ve',
      },
      {
        protocol: 'https',
        hostname: '*.rentahouse.com.ve',
      },
      {
        protocol: 'https',
        hostname: 'cdn.photos.sparkplatform.com',
      },
      {
        protocol: 'https',
        hostname: 'cdn.resize.sparkplatform.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 86400, // Cache images for 24 hours
  },
  compress: true,
  poweredByHeader: false,
};

export default nextConfig;
