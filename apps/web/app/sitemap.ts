import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/site';

/**
 * Generated at build time, so it can never go stale the way a hand-written file
 * does. The audited competitor shipped a sitemap produced by a free online tool
 * in 2021 that did not even contain its flagship product page.
 *
 * Only public marketing routes belong here. Dashboard pages are behind auth and
 * overlay routes carry a secret token — indexing either would be a leak, not a
 * ranking opportunity.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return [
    {
      url: absoluteUrl('/'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: absoluteUrl('/login'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
  ];
}
