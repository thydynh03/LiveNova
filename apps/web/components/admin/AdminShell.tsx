'use client';

import React from 'react';
import { Icon, type IconName } from '../ui/Icon';

/**
 * Các mảnh dựng nên khu quản trị.
 *
 * Lý do tách ra thành file này chứ không viết thẳng trong từng trang: trước đó
 * mỗi trang tự viết style inline cho tiêu đề, thẻ số liệu và khung panel, nên
 * bốn trang có bốn cỡ chữ tiêu đề khác nhau, ba kiểu bo góc và hai thang khoảng
 * cách. Giao diện quản trị trông thiếu chuyên nghiệp gần như luôn vì lý do đó —
 * không phải vì thiếu hiệu ứng, mà vì các phần không khớp nhau.
 *
 * Style nằm trong `globals.css` dưới tiền tố `admin-`, không phải inline: chỉ
 * như vậy thì hai trang mới chắc chắn giống nhau, và sửa một chỗ là sửa tất cả.
 */

export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="admin-header">
      <div className="admin-header__text">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="admin-header__actions">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  subtitle,
  tone = 'default',
  children,
}: {
  title?: string;
  subtitle?: string;
  tone?: 'default' | 'muted' | 'notice' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <section className={`admin-panel admin-panel--${tone}`}>
      {(title || subtitle) && (
        <div className="admin-panel__head">
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

/**
 * Một con số, và điều kiện để đọc nó.
 *
 * `hint` không phải trang trí. Một ô ghi "1.240" mà không nói là lượt xem hay
 * lượt khách, trong bao lâu, thì người đọc sẽ tự điền giả định — và giả định
 * của họ thường rộng rãi hơn sự thật.
 */
export function StatTile({
  icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: IconName;
  label: string;
  value: string;
  hint?: string;
  tone?: 'good' | 'warn' | 'bad';
}) {
  return (
    <div className={`admin-tile${tone ? ` admin-tile--${tone}` : ''}`}>
      <div className="admin-tile__top">
        <span className="admin-tile__icon">
          <Icon name={icon} size={18} weight="duotone" />
        </span>
        <span className="admin-tile__label">{label}</span>
      </div>
      <div className="admin-tile__value tabular">{value}</div>
      {hint && <div className="admin-tile__hint">{hint}</div>}
    </div>
  );
}

/** Nhãn trạng thái. Màu đi kèm chữ, không thay cho chữ. */
export function StatusPill({
  tone,
  children,
}: {
  tone: 'good' | 'warn' | 'bad' | 'neutral';
  children: React.ReactNode;
}) {
  return <span className={`admin-pill admin-pill--${tone}`}>{children}</span>;
}
