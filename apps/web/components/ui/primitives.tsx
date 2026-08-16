'use client';

import React, { forwardRef, useId } from 'react';

/**
 * Bộ điều khiển dùng chung.
 *
 * Trước đây `components/ui/` chỉ có `Icon` và `motion-primitives`, nên mọi nút
 * và ô nhập đều được dựng tay bằng `style={{}}` ngay tại chỗ dùng — hơn một
 * nghìn khối như thế trong dự án. Hệ quả không phải là xấu mã nguồn mà là xấu
 * giao diện: mỗi nút một cỡ chữ, một khoảng đệm, một bo góc, và trạng thái focus
 * thì tuỳ nơi có tuỳ nơi không.
 *
 * Mọi màu ở đây đều đọc từ token trong `globals.css`, nên đổi chủ đề là đổi một
 * chỗ. Chiều cao tối thiểu 40px (`sm` là 34px) để đạt vùng chạm tối thiểu.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Button
// ─────────────────────────────────────────────────────────────────────────────

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ControlSize = 'sm' | 'md';

const SIZE_STYLE: Record<ControlSize, React.CSSProperties> = {
  sm: { minHeight: 34, padding: '0.3rem 0.65rem', fontSize: '0.8125rem' },
  md: { minHeight: 40, padding: '0.5rem 0.9rem', fontSize: '0.875rem' },
};

const VARIANT_STYLE: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: 'hsl(var(--primary))',
    color: 'hsl(var(--primary-foreground))',
    border: '1px solid transparent',
  },
  secondary: {
    background: 'hsl(var(--secondary))',
    color: 'hsl(var(--secondary-foreground))',
    border: '1px solid hsl(var(--border))',
  },
  ghost: {
    background: 'transparent',
    color: 'hsl(var(--foreground))',
    border: '1px solid transparent',
  },
  // Đỏ phá huỷ khác đỏ nhấn: hai màu này không được đọc như nhau, nếu không
  // người dùng sẽ ngần ngại trước nút chính và bấm bừa nút xoá.
  danger: {
    background: 'hsl(var(--destructive))',
    color: 'hsl(var(--destructive-foreground))',
    border: '1px solid transparent',
  },
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ControlSize;
  /**
   * Đang xử lý.
   *
   * Vô hiệu hoá nút và đặt `aria-busy`, để cú nhấp thứ hai không gửi thêm một
   * yêu cầu nữa — chuyện thường xảy ra khi mạng chậm và nút không phản hồi gì.
   */
  loading?: boolean;
  /** Chiếm hết chiều ngang khối cha. */
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading = false, block = false, disabled, style, children, ...rest },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      style={{
        display: block ? 'flex' : 'inline-flex',
        width: block ? '100%' : undefined,
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.4rem',
        borderRadius: 'var(--radius-sm)',
        fontWeight: 600,
        lineHeight: 1.2,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.6 : 1,
        transition: 'background 0.15s ease, opacity 0.15s ease',
        ...SIZE_STYLE[size],
        ...VARIANT_STYLE[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? <span className="ln-spinner ln-spinner-inline" aria-hidden="true" /> : null}
      {children}
    </button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Field + Input
// ─────────────────────────────────────────────────────────────────────────────

const CONTROL_BASE: React.CSSProperties = {
  width: '100%',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid hsl(var(--input))',
  background: 'hsl(var(--background))',
  color: 'hsl(var(--foreground))',
  font: 'inherit',
};

export interface FieldProps {
  label: string;
  /** Câu giải thích dưới nhãn. Chỗ dành cho phần từng bị nhét vào ngoặc đơn của nhãn. */
  hint?: string;
  error?: string;
  children: (props: { id: string; 'aria-describedby'?: string; 'aria-invalid'?: boolean }) => React.ReactNode;
}

/**
 * Nhãn + gợi ý + lỗi, nối đúng bằng `aria-describedby`.
 *
 * Dùng render prop để component con nhận được `id` đã sinh — nếu để chỗ gọi tự
 * đặt `id` thì sớm muộn cũng có màn hình quên, và nhãn mất liên kết với ô nhập.
 */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
      <label htmlFor={id} style={{ fontSize: '0.8125rem', fontWeight: 600 }}>
        {label}
      </label>

      {hint ? (
        <p id={hintId} style={{ margin: 0, fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>
          {hint}
        </p>
      ) : null}

      {children({ id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })}

      {error ? (
        <p id={errorId} role="alert" style={{ margin: 0, fontSize: '0.75rem', color: 'hsl(var(--destructive))' }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * `size` gốc của <input> là số ký tự hiển thị, gần như không ai dùng, nên nó
 * được thay bằng cỡ điều khiển. Loại kiểu cũ ra để hai nghĩa không lẫn nhau.
 */
export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  size?: ControlSize;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', style, ...rest },
  ref,
) {
  return <input ref={ref} style={{ ...CONTROL_BASE, ...SIZE_STYLE[size], ...style }} {...rest} />;
});

export interface SelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: ControlSize;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { size = 'md', style, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      style={{
        ...CONTROL_BASE,
        ...SIZE_STYLE[size],
        // Chừa chỗ cho mũi tên gốc của trình duyệt: `appearance` để nguyên vì
        // danh sách chọn tự vẽ trông ổn tới khi gặp màn cảm ứng và trình đọc
        // màn hình, rồi hỏng theo những cách khó thấy.
        paddingRight: '2rem',
        cursor: 'pointer',
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
});

/**
 * Nút chỉ có biểu tượng.
 *
 * Bắt buộc có `label`: một nút chỉ mang hình vẽ mà không có tên thì trình đọc
 * màn hình đọc ra là "button", vô nghĩa. Nhãn cũng dùng làm tooltip.
 */
export function IconButton({
  label,
  children,
  style,
  ...rest
}: Omit<ButtonProps, 'children'> & { label: string; children: React.ReactNode }) {
  return (
    <Button
      aria-label={label}
      title={label}
      variant={rest.variant ?? 'ghost'}
      style={{ width: 36, height: 36, padding: 0, flex: 'none', ...style }}
      {...rest}
    >
      {children}
    </Button>
  );
}

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ style, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        style={{ ...CONTROL_BASE, padding: '0.5rem 0.75rem', fontSize: '0.875rem', minHeight: 88, ...style }}
        {...rest}
      />
    );
  },
);

// ─────────────────────────────────────────────────────────────────────────────
// Card / Badge
// ─────────────────────────────────────────────────────────────────────────────

export interface CardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Tiêu đề khối. Kèm `<h2>` nên đừng lồng thêm tiêu đề bên trong. */
  title?: React.ReactNode;
  /** Nút hoặc trạng thái nằm cùng hàng với tiêu đề. */
  actions?: React.ReactNode;
  padded?: boolean;
}

export function Card({ title, actions, padded = true, style, children, ...rest }: CardProps) {
  return (
    <section
      style={{
        background: 'hsl(var(--card))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius)',
        padding: padded ? '1rem 1.25rem' : 0,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.875rem',
        minWidth: 0,
        ...style,
      }}
      {...rest}
    >
      {title || actions ? (
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.5rem',
            flexWrap: 'wrap',
          }}
        >
          {title ? (
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700 }}>{title}</h2>
          ) : (
            <span />
          )}
          {actions}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'accent';

const BADGE_TONE: Record<BadgeTone, { bg: string; fg: string }> = {
  neutral: { bg: 'hsl(var(--secondary))', fg: 'hsl(var(--secondary-foreground))' },
  success: { bg: 'hsl(var(--success) / 0.14)', fg: 'hsl(var(--success))' },
  warning: { bg: 'hsl(var(--warning) / 0.16)', fg: 'hsl(var(--warning-foreground))' },
  danger: { bg: 'hsl(var(--destructive) / 0.14)', fg: 'hsl(var(--destructive))' },
  accent: { bg: 'hsl(var(--accent-surface))', fg: 'hsl(var(--primary-hover))' },
};

export function Badge({
  tone = 'neutral',
  children,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
}) {
  const palette = BADGE_TONE[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.3rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 600,
        background: palette.bg,
        color: palette.fg,
      }}
    >
      {children}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tabs
// ─────────────────────────────────────────────────────────────────────────────

export interface TabItem {
  id: string;
  label: string;
}

/**
 * Thanh tab điều hướng bằng bàn phím.
 *
 * Mũi tên trái/phải chuyển tab, đúng mẫu ARIA tablist — người dùng bàn phím
 * không phải Tab qua từng tab một để tới nội dung.
 */
export function Tabs({
  items,
  value,
  onChange,
  label,
}: {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const move = (delta: number) => {
    const index = items.findIndex((i) => i.id === value);
    if (index < 0) return;
    // Vòng lại đầu/cuối thay vì dừng, để không có ngõ cụt.
    const next = (index + delta + items.length) % items.length;
    onChange(items[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          move(1);
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          move(-1);
        }
      }}
      style={{
        display: 'flex',
        gap: '0.25rem',
        padding: '0.25rem',
        borderRadius: 'var(--radius)',
        background: 'hsl(var(--secondary))',
        overflowX: 'auto',
      }}
    >
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            style={{
              flex: '0 0 auto',
              minHeight: 36,
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: active ? 700 : 500,
              background: active ? 'hsl(var(--card))' : 'transparent',
              color: active ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              boxShadow: active ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

/** Khung nội dung của một tab. Ẩn hẳn khi không được chọn. */
export function TabPanel({
  id,
  value,
  children,
}: {
  id: string;
  value: string;
  children: React.ReactNode;
}) {
  if (id !== value) return null;
  return (
    <div role="tabpanel" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {children}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Switch
// ─────────────────────────────────────────────────────────────────────────────

export function Switch({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.75rem',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', minWidth: 0 }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{label}</span>
        {hint ? (
          <span style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{hint}</span>
        ) : null}
      </span>

      {/*
        Dùng checkbox thật thay vì div có `role="switch"`: nó đã có sẵn tiêu điểm
        bàn phím, phím Space, và được mọi trình đọc màn hình hiểu đúng.
      */}
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 40, height: 22, flex: 'none', accentColor: 'hsl(var(--primary))', cursor: 'inherit' }}
      />
    </label>
  );
}
