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

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
