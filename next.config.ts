import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow Next.js Image optimization for local public assets
  images: {
    formats: ["image/avif", "image/webp"],
  },
  // Strict mode for better React dev-time warnings
  reactStrictMode: true,
  // The PDF route reads the report logo from disk; make sure it ships with the function.
  outputFileTracingIncludes: {
    "/api/exports/\\[id\\]": ["./public/assets/report-mark.png"],
  },
};

export default nextConfig;
