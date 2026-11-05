/// <reference lib="webworker" />
/**
 * Service worker (spec §5 Phase 4.1), built by @serwist/next.
 *
 * Privacy rule: the Cache Storage is NOT encrypted, so it must never hold patient data.
 * - Precached: the build's static assets (JS/CSS), fonts, logos, message catalogues.
 * - Runtime: static assets cache-first; the capture shell (/field-entry) network-first so the
 *   app opens offline after the first visit (it contains no patient data: drafts live in the
 *   encrypted IndexedDB).
 * - Never cached: /api/** (records, media, exports, billing) and every other page (record
 *   pages contain patient data). Offline navigations to them show /~offline.
 * - Background Sync: wakes open clients to run the encrypted outbox (the worker cannot read it).
 */
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { CacheFirst, ExpirationPlugin, NetworkFirst, NetworkOnly, Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const SHELL_PATHS = ['/field-entry', '/~offline'];

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    { matcher: ({ url }) => url.pathname.startsWith('/api/'), handler: new NetworkOnly() },
    {
      matcher: ({ request, url }) => request.mode === 'navigate' && SHELL_PATHS.includes(url.pathname),
      handler: new NetworkFirst({ cacheName: 'ds-shell', networkTimeoutSeconds: 4, plugins: [new ExpirationPlugin({ maxEntries: 4 })] }),
    },
    { matcher: ({ request }) => request.mode === 'navigate', handler: new NetworkOnly() },
    {
      matcher: ({ url }) =>
        url.origin === self.location.origin && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/') || url.pathname.startsWith('/assets/')),
      handler: new CacheFirst({ cacheName: 'ds-static', plugins: [new ExpirationPlugin({ maxEntries: 300, maxAgeSeconds: 60 * 24 * 3600 })] }),
    },
    {
      matcher: ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
      handler: new CacheFirst({ cacheName: 'ds-google-fonts', plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 365 * 24 * 3600 })] }),
    },
  ],
  fallbacks: {
    entries: [{ url: '/~offline', matcher: ({ request }) => request.destination === 'document' }],
  },
});

serwist.addEventListeners();

// Background Sync: ask open pages to run the outbox (only they hold the device key).
self.addEventListener('sync', (event: Event) => {
  const e = event as Event & { tag: string; waitUntil(p: Promise<unknown>): void };
  if (e.tag !== 'ds-outbox') return;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) c.postMessage({ type: 'ds-sync' });
    }),
  );
});
