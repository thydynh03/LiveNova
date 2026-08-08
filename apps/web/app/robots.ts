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
          // Added after an audit found four authenticated areas missing from
          // this list. `/admin` is the worst of them: the users and audit
          // screens are staff-only, and a crawler advertising their existence
          // is an invitation to probe them.
          '/admin',
          '/templates',
          '/settings',
          '/battle',
          // One-time flows reached from an emailed link. They carry a token,
          // they are worthless in results, and an indexed one is a stale link
          // that lands a searcher on an error.
          '/verify-otp',
          '/reset-password',
          '/forgot-password',
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
