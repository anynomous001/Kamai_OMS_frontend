import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Kamai — The Baker Cockpit',
    short_name: 'Kamai',
    description: 'Run your home bakery like a real business.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F5F0',
    theme_color: '#2D1B14',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
