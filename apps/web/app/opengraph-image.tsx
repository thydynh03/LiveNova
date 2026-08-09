import { ImageResponse } from 'next/og';
import { SITE_NAME, SITE_DESCRIPTION } from '../lib/site';

/**
 * The card people see before they see the site.
 *
 * `twitter.card` was already declared as `summary_large_image` while no image
 * existed anywhere in the project, so every link pasted into Facebook, Zalo or
 * X rendered an empty preview — the worst version of a share, because the space
 * is reserved and then left blank.
 *
 * Generated rather than committed as a PNG: the text comes from the same
 * constants the page uses, so it cannot drift from the product's own name and
 * description the way a hand-exported image does.
 */

export const runtime = 'edge';
export const alt = `${SITE_NAME} — Tự động hoá livestream TikTok`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          // The dark theme's own background and accent, so the card and the
          // site it opens look like the same product.
          background: 'linear-gradient(135deg, #16120f 0%, #241318 55%, #3b1220 100%)',
          color: '#f7f0ec',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 36 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 18,
              background: 'linear-gradient(135deg, #ef4a6b, #f0806a)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 38,
            }}
          >
            👑
          </div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1 }}>{SITE_NAME}</div>
        </div>

        <div
          style={{
            fontSize: 68,
            fontWeight: 800,
            lineHeight: 1.15,
            letterSpacing: -2,
            maxWidth: 900,
          }}
        >
          Tự động hoá livestream TikTok
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 30,
            lineHeight: 1.4,
            color: '#c9bcb6',
            maxWidth: 880,
          }}
        >
          {SITE_DESCRIPTION}
        </div>
      </div>
    ),
    size,
  );
}
