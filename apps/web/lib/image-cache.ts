'use client';

/**
 * Image loader for the canvas renderer.
 *
 * Deliberately not a React hook. The draw loop runs on `requestAnimationFrame`
 * outside React, and it needs to ask "is this sprite ready?" sixty times a
 * second — routing that through state would re-render the tree on every load
 * and give back exactly the cost the canvas exists to avoid.
 *
 * A failed load is remembered as failed. Without that, a broken URL is retried
 * on every frame, which turns one bad asset into a request storm on the
 * streamer's machine.
 */

type Entry =
  | { status: 'loading' }
  | { status: 'ready'; image: HTMLImageElement }
  | { status: 'failed' };

const cache = new Map<string, Entry>();

/**
 * The decoded image for `url`, or null while it loads or if it never will.
 *
 * Callers draw their fallback when this returns null, so a missing sprite
 * degrades to the built-in shape rather than to a hole on the broadcast.
 */
export function getImage(url: string | undefined): HTMLImageElement | null {
  if (!url) return null;

  const entry = cache.get(url);
  if (entry) return entry.status === 'ready' ? entry.image : null;

  if (typeof window === 'undefined') return null;

  cache.set(url, { status: 'loading' });
  const image = new Image();
  // The assets are on Cloudinary; without this the canvas is tainted and
  // anything that later reads pixels back throws a security error.
  image.crossOrigin = 'anonymous';
  image.onload = () => cache.set(url, { status: 'ready', image });
  image.onerror = () => cache.set(url, { status: 'failed' });
  image.src = url;

  return null;
}

/**
 * Start loading without needing the result yet.
 *
 * Called when a round starts so the dragon is decoded before the gift that
 * summons it arrives. A sprite that finishes loading after its moment has
 * passed may as well not exist.
 */
export function preload(urls: (string | undefined)[]): void {
  for (const url of urls) getImage(url);
}

/** Test seam. */
export function resetImageCache(): void {
  cache.clear();
}
