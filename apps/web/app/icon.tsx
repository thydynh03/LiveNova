import { ImageResponse } from 'next/og';

/**
 * Favicon.
 *
 * There was none, so browsers fell back to a blank sheet in the tab and in
 * bookmarks — and a streamer keeping the dashboard, the simulator and OBS open
 * at once has no way to tell which tab is which.
 */

export const runtime = 'edge';
export const size = { width: 64, height: 64 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #ef4a6b, #f0806a)',
          borderRadius: 14,
          fontSize: 40,
        }}
      >
        👑
      </div>
    ),
    size,
  );
}
