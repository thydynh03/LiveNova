'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

/**
 * Thông báo nổi.
 *
 * Trước đây dự án không có cơ chế nào để báo lỗi cho người dùng: hơn hai chục
 * chỗ `catch` rồi `console.error` là hết. Người dùng bấm nút, không có gì xảy
 * ra, và kết luận là app hỏng. Đây là chỗ duy nhất để nói ra chuyện đó.
 */

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
}

interface ToastApi {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** Lỗi hiển thị lâu hơn: người dùng cần thời gian đọc rồi mới xử lý được. */
const DURATION_MS: Record<ToastTone, number> = {
  success: 3200,
  info: 4000,
  error: 7000,
};

/** Số thông báo tối đa hiện cùng lúc, để một vòng lặp lỗi không phủ kín màn hình. */
const MAX_VISIBLE = 4;

const TONE_STYLE: Record<ToastTone, { border: string; icon: string; label: string }> = {
  success: { border: 'hsl(142 70% 45%)', icon: '✓', label: 'Thành công' },
  error: { border: 'hsl(0 72% 58%)', icon: '!', label: 'Lỗi' },
  info: { border: 'hsl(210 90% 60%)', icon: 'i', label: 'Thông tin' },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, detail?: string) => {
      // Bộ đếm chứ không phải Date.now(): hai lỗi trong cùng một mili-giây sẽ
      // trùng khoá React và chỉ một cái hiện ra.
      counter.current += 1;
      const id = `toast_${counter.current}`;

      setItems((prev) => [...prev, { id, tone, title, detail }].slice(-MAX_VISIBLE));

      const timer = setTimeout(() => dismiss(id), DURATION_MS[tone]);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  // Dọn hẹn giờ khi provider bị gỡ, tránh setState trên component đã unmount.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, detail) => push('success', title, detail),
      error: (title, detail) => push('error', title, detail),
      info: (title, detail) => push('info', title, detail),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastViewport items={items} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  items,
  onDismiss,
}: {
  items: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      // `aria-live="polite"` chứ không phải "assertive": thông báo không nên cắt
      // ngang câu mà trình đọc màn hình đang đọc dở.
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '1.25rem',
        right: '1.25rem',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        maxWidth: 'min(380px, calc(100vw - 2.5rem))',
        pointerEvents: 'none',
      }}
    >
      {items.map((item) => {
        const tone = TONE_STYLE[item.tone];
        return (
          <div
            key={item.id}
            style={{
              pointerEvents: 'auto',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.625rem',
              padding: '0.75rem 0.875rem',
              borderRadius: 'var(--radius)',
              background: 'hsl(var(--card))',
              color: 'hsl(var(--foreground))',
              border: '1px solid hsl(var(--border))',
              borderLeft: `3px solid ${tone.border}`,
              boxShadow: '0 8px 24px rgba(0,0,0,0.22)',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                flex: 'none',
                width: 20,
                height: 20,
                marginTop: 1,
                display: 'grid',
                placeItems: 'center',
                borderRadius: '50%',
                background: tone.border,
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
              }}
            >
              {tone.icon}
            </span>

            <div style={{ flex: 1, minWidth: 0 }}>
              <span className="ln-visually-hidden">{tone.label}: </span>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>{item.title}</p>
              {item.detail ? (
                <p
                  style={{
                    fontSize: '0.8125rem',
                    color: 'hsl(var(--muted-foreground))',
                    margin: '0.25rem 0 0',
                  }}
                >
                  {item.detail}
                </p>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              aria-label="Đóng thông báo"
              style={{
                flex: 'none',
                width: 28,
                height: 28,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: 'transparent',
                color: 'hsl(var(--muted-foreground))',
                cursor: 'pointer',
                fontSize: '1rem',
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Truy cập hệ thống thông báo.
 *
 * Trả về API rỗng thay vì ném lỗi khi không có provider: một trang overlay chạy
 * trong OBS không có provider, và làm sập cả trang phát sóng chỉ vì không hiện
 * được thông báo là cái giá quá đắt.
 */
const NOOP_API: ToastApi = {
  success: () => undefined,
  error: () => undefined,
  info: () => undefined,
  dismiss: () => undefined,
};

export function useToast(): ToastApi {
  return useContext(ToastContext) ?? NOOP_API;
}
