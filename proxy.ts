import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// Next.js 16 renamed middleware.ts to proxy.ts (node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
// Optimistic page redirect only. API routes are not listed: their handlers call lib/auth.ts and
// return 401 JSON (a redirect is useless to fetch). Every query is also scoped by lib/auth.ts.
const isProtectedRoute = createRouteMatcher([
  '/field-entry(.*)',
  '/saved-records(.*)',
  '/records(.*)',
  '/reports(.*)',
  '/insights(.*)',
  '/billing(.*)',
  '/admin(.*)',
]);

const isDev = process.env.NODE_ENV === 'development';

export default clerkMiddleware(
  async (auth, req) => {
    if (isProtectedRoute(req)) {
      await auth.protect();
    }
  },
  {
    // Strict CSP with a fresh nonce per request (spec Phase 6.4). Clerk adds its own domains and
    // exposes the nonce as a request header that app/layout.tsx reads. No third-party analytics.
    contentSecurityPolicy: {
      strict: true,
      directives: {
        'default-src': ["'self'"],
        'script-src': isDev ? ["'unsafe-eval'"] : [],
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': ["'self'", 'data:', 'blob:', 'https://img.clerk.com'],
        'media-src': ["'self'", 'blob:'],
        'connect-src': ["'self'"],
        'worker-src': ["'self'", 'blob:'],
        'manifest-src': ["'self'"],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
      },
    },
  },
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|sw.js|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
