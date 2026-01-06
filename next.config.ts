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
    ],
  },
};

export default nextConfig;
