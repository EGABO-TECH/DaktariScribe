import type { MetadataRoute } from 'next';

/** Web app manifest so DaktariScribe installs as an app (spec §5 Phase 4.1). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DaktariScribe',
    short_name: 'DaktariScribe',
    description: 'Field notes to finished reports, for frontline health teams.',
    start_url: '/field-entry',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6fafd',
    theme_color: '#001d3d',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
