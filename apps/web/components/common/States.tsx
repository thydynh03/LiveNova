'use client';

import React from 'react';

/**
 * Shared loading / empty / error states — NFR-33.
 *
 * The audit's standing complaint was that no screen had any of these, so a slow
 * or failed request rendered a blank page with no way to tell which. One place
 * to define them means every screen gets the same behaviour for free.
 */

const box: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.75rem',
  padding: '3rem 1.5rem',
  textAlign: 'center',
  color: 'hsl(var(--muted-foreground))',
};

export function LoadingState({
  label = 'Đang tải…',
  /** Set false to hide the text while keeping it available to screen readers. */
  showLabel = true,
}: {
  label?: string;
  showLabel?: boolean;
}) {
  // Compact call sites used to pass label="" to hide the text, which also
  // stripped the accessible name and left the status silent to screen readers.
  const accessibleLabel = label.trim() === '' ? 'Đang tải…' : label;

  return (
    <div style={box} role="status" aria-live="polite" aria-busy="true">
      {/*
        The animation lives in a class, not an inline style: an inline
        `animation` wins over any stylesheet rule, so a prefers-reduced-motion
        media query could never switch it off.
      */}
      <span className="ln-spinner" aria-hidden="true" />

      {showLabel && label.trim() !== '' ? (
        <span>{label}</span>
      ) : (
        <span className="ln-visually-hidden">{accessibleLabel}</span>
      )}

      <style>{`
        .ln-spinner {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          border: 3px solid hsl(var(--border));
          border-top-color: hsl(var(--primary));
          animation: ln-spin 0.8s linear infinite;
        }
        @keyframes ln-spin { to { transform: rotate(360deg); } }
        .ln-visually-hidden {
          position: absolute;
          width: 1px; height: 1px;
          padding: 0; margin: -1px;
          overflow: hidden;
          clip: rect(0 0 0 0);
          white-space: nowrap;
          border: 0;
        }
        @media (prefers-reduced-motion: reduce) {
          .ln-spinner { animation: none; opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={box}>
      <strong style={{ fontSize: '1.05rem', color: 'hsl(var(--foreground))' }}>{title}</strong>
      {description && <span style={{ maxWidth: '40ch' }}>{description}</span>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    // role="alert" so screen readers announce it — audit finding A7 was toasts
    // that were invisible to assistive tech.
    <div style={box} role="alert">
      <strong style={{ color: 'hsl(var(--destructive))' }}>Đã xảy ra lỗi</strong>
      <span style={{ maxWidth: '48ch' }}>{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            marginTop: '0.5rem',
            padding: '0.5rem 1.25rem',
            borderRadius: 'var(--radius)',
            border: '1px solid hsl(var(--border))',
            background: 'hsl(var(--card))',
            color: 'hsl(var(--foreground))',
            cursor: 'pointer',
            minHeight: '44px',
          }}
        >
          Thử lại
        </button>
      )}
    </div>
  );
}
