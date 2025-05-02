import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      'enjqmxzkuhkswoboalwm.supabase.co',
      'enjqmxzkuhkswoboalwm.supabase.in',
      'supabase.co',
      'supabase.in',
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.in',
      },
    ],
  },
};

export default nextConfig;
