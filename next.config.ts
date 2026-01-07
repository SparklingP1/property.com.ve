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
  },
};

export default nextConfig;
