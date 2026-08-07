'use client';

import React, { useEffect, useRef, useState } from 'react';

/**
 * Inline confirmation for a destructive action.
 *
 * Replaces `window.confirm()`. Native dialogs are suppressed outright in
 * several embedded browsers — the app shell, OBS's browser source, some
 * in-app webviews — and when they are suppressed `confirm()` returns false,
 * so the guarded action silently does nothing. "Ngắt kênh" looked broken for
 * exactly that reason: the click landed, the handler ran, and the first line
 * returned early.
 *
 * Confirming in the page also lets the question carry consequences the OS
 * dialog cannot style, and keeps the destructive control next to the thing it
 * destroys.
 */
export interface ConfirmActionProps {
  /** Label for the resting state. */
  label: React.ReactNode;
  /** Short question shown once armed. Keep it to one line. */
  question: string;
  /** Label of the button that carries out the action. */
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  /** Shown while the action is running. */
  busyLabel?: string;
  disabled?: boolean;
  /** Styling for the resting trigger. */
  style?: React.CSSProperties;
  className?: string;
  title?: string;
}

export function ConfirmAction({
  label,
  question,
  confirmLabel,
  onConfirm,
  busyLabel = 'Đang xử lý…',
  disabled,
  style,
  className,
  title,
}: ConfirmActionProps) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  // Focus follows the question, so a keyboard user is not left on a button that
  // has just been replaced by two different ones.
  useEffect(() => {
    if (armed) confirmRef.current?.focus();
  }, [armed]);

  // Escape backs out, matching what the native dialog did.
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) setArmed(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [armed, busy]);

  if (!armed) {
    return (
      <button
        type="button"
        className={className}
        style={style}
        disabled={disabled}
        title={title}
        onClick={() => setArmed(true)}
      >
        {label}
      </button>
    );
  }

  return (
    <span
      role="group"
      aria-label={question}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}
    >
      <span style={{ fontSize: '0.875rem', color: 'hsl(var(--muted-foreground))' }}>
        {question}
      </span>
      <button
        ref={confirmRef}
        type="button"
        className="btn btn-danger"
        style={{ minHeight: '36px', padding: '0.4rem 0.85rem', fontSize: '0.875rem' }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onConfirm();
            setArmed(false);
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? busyLabel : confirmLabel}
      </button>
      <button
        type="button"
        className="btn btn-secondary"
        style={{ minHeight: '36px', padding: '0.4rem 0.85rem', fontSize: '0.875rem' }}
        disabled={busy}
        onClick={() => setArmed(false)}
      >
        Huỷ
      </button>
    </span>
  );
}
