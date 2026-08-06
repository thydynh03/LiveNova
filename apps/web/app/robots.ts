import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/site';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          // Behind auth — nothing here is useful to a crawler and some of it
          // names the user's channels.
          '/dashboard',
          '/channels',
          '/rules',
          '/tts',
          '/billing',
          // Overlay URLs embed a secret token. A crawler that indexed one would
          // publish a working handle to someone's live overlay.
          '/overlays/',
          // BFF auth endpoints.
          '/api/',
        ],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: absoluteUrl('/'),
  };
}
