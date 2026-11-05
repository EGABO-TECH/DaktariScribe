import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

// Service worker (spec Phase 4). Built with webpack (`next build --webpack`); disabled in dev.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
  cacheOnNavigation: false,
  reloadOnOnline: false,
  // Fonts, logos and label catalogues are precached; never anything with patient data.
  globPublicPatterns: ["fonts/*.ttf", "assets/report-mark.png", "icons/*.png"],
  additionalPrecacheEntries: [{ url: "/~offline", revision: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" }],
});

// Security headers (spec Phase 6.4). The Content-Security-Policy (with a per-request nonce) is
// set in proxy.ts by Clerk's middleware, because it must change on every request.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "microphone=(self), camera=(self), geolocation=(), payment=(), usb=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  // Dev runs on Turbopack (the service worker is disabled in dev); production builds use webpack.
  turbopack: {},
  // Export routes read fonts and the report logo from disk; ship them with the functions.
  outputFileTracingIncludes: {
    "/api/exports": ["./public/fonts/*.ttf", "./public/assets/report-mark.png"],
    "/api/exports/\\[id\\]": ["./public/fonts/*.ttf", "./public/assets/report-mark.png"],
    "/api/billing/receipts/\\[reference\\]": ["./public/fonts/*.ttf"],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }, { key: "Service-Worker-Allowed", value: "/" }] },
    ];
  },
};

export default withSerwist(nextConfig);
