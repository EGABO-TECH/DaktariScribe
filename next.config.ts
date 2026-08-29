import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js Image optimization for local public assets
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Strict mode for better React dev-time warnings
  reactStrictMode: true,
};

export default nextConfig;
