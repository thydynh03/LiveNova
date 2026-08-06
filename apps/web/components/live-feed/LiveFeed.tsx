'use client';

import React, { useMemo } from 'react';
import { LiveEvent, LiveEventType } from '@livenova/shared';

/** How many events stay on screen. Older ones are dropped by the caller. */
export const LIVE_FEED_LIMIT = 60;

const LABEL: Record<LiveEventType, string> = {
  [LiveEventType.COMMENT]: 'bình luận',
  [LiveEventType.GIFT]: 'tặng quà',
  [LiveEventType.LIKE]: 'thả tim',
  [LiveEventType.FOLLOW]: 'theo dõi',
  [LiveEventType.SHARE]: 'chia sẻ',
  [LiveEventType.JOIN]: 'vào phòng',
};

const ACCENT: Record<LiveEventType, string> = {
  [LiveEventType.COMMENT]: 'hsl(var(--muted-foreground))',
  [LiveEventType.GIFT]: '#f43f5e',
  [LiveEventType.LIKE]: '#ec4899',
  [LiveEventType.FOLLOW]: '#10b981',
  [LiveEventType.SHARE]: '#3b82f6',
  [LiveEventType.JOIN]: '#a78bfa',
};

/**
 * `occurredAt` is typed as a Date but arrives as an ISO string over Socket.IO,
 * so both shapes must be handled.
 */
function toDate(value: LiveEvent['occurredAt']): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value: LiveEvent['occurredAt']): string {
  const date = toDate(value);
  return date ? date.toLocaleTimeString('vi-VN', { hour12: false }) : '';
}

/**
 * `<time dateTime>` requires a valid machine-readable datetime. `String(date)`
 * yields "Mon Aug 06 2026 …", which no parser and no screen reader can use.
 */
function toIsoAttribute(value: LiveEvent['occurredAt']): string | undefined {
  return toDate(value)?.toISOString();
}

function describe(event: LiveEvent): string {
  switch (event.type) {
    case LiveEventType.COMMENT:
      return event.content ?? '';
    case LiveEventType.GIFT:
      return `${event.giftName ?? 'quà'}${
        event.giftCoinValue ? ` · ${event.giftCoinValue.toLocaleString('vi-VN')} coin` : ''
      }`;
    case LiveEventType.LIKE:
      return event.likeCount ? `${event.likeCount.toLocaleString('vi-VN')} tim` : '';
    default:
      return '';
  }
}

export function LiveFeed({ events }: { events: LiveEvent[] }) {
  // Newest first: during a busy stream the top of the list is the only part
  // anyone reads.
  const ordered = useMemo(() => [...events].reverse(), [events]);

  if (ordered.length === 0) {
    return (
      <p style={{ color: 'hsl(var(--muted-foreground))', padding: '1.5rem 0' }}>
        Chưa có sự kiện nào. Sự kiện sẽ xuất hiện ở đây khi kênh bắt đầu livestream.
      </p>
    );
  }

  return (
    // aria-live="polite" rather than "assertive": a busy stream produces several
    // events per second, and interrupting a screen reader that often would make
    // the page unusable.
    <ul
      aria-live="polite"
      aria-relevant="additions"
      style={{
        listStyle: 'none',
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        maxHeight: '520px',
        overflowY: 'auto',
      }}
    >
      {ordered.map((event) => {
        const detail = describe(event);
        return (
          <li
            key={event.id}
            style={{
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'baseline',
              flexWrap: 'wrap',
              padding: '0.6rem 0.75rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--muted) / 0.25)',
              fontSize: '0.9rem',
            }}
          >
            <time
              dateTime={toIsoAttribute(event.occurredAt)}
              style={{
                color: 'hsl(var(--muted-foreground))',
                fontVariantNumeric: 'tabular-nums',
                fontSize: '0.8rem',
              }}
            >
              {formatTime(event.occurredAt)}
            </time>

            <span style={{ color: ACCENT[event.type], fontWeight: 600, whiteSpace: 'nowrap' }}>
              {LABEL[event.type]}
            </span>

            {/* Display names come from TikTok and can be arbitrarily long.
                `nowrap` pushed the row past the viewport on narrow screens. */}
            <strong style={{ wordBreak: 'break-word', minWidth: 0 }}>
              {event.senderDisplayName}
            </strong>

            {detail && (
              <span style={{ color: 'hsl(var(--muted-foreground))', wordBreak: 'break-word' }}>
                {detail}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
