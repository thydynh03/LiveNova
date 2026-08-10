import type { MetadataRoute } from 'next';
import { absoluteUrl } from '../lib/site';
import { GUIDES } from '../lib/guides';

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
    {
      // Was missing. Sign-up is the page a searcher who has already decided is
      // looking for, and it was the only public route not listed.
      url: absoluteUrl('/register'),
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: absoluteUrl('/huong-dan'),
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    // Derived from the guide list rather than typed out again. A hand-written
    // copy drifts on the second article added, and the drift is silent: Google
    // still accepts the sitemap, it just never learns the new page exists.
    ...GUIDES.map((guide) => ({
      url: absoluteUrl(`/huong-dan/${guide.slug}`),
      lastModified: new Date(guide.updated),
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}
