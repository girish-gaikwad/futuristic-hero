import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Add your config options here
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

