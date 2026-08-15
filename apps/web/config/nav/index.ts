import type { NavItem } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// APPEND-ONLY. Add one import + one array entry per feature, keep alphabetical.
// Do not reorder, reformat, or refactor this file — that is how merge conflicts
// get manufactured. Ordering on screen comes from NavItem.order, not from here.
// ─────────────────────────────────────────────────────────────────────────────
import { battleNav } from './battle.nav';
import { billingNav } from './billing.nav';
import { channelsNav } from './channels.nav';
import { dashboardNav } from './dashboard.nav';
import { discoNav } from './disco.nav';
import { overlaysNav } from './overlays.nav';
import { rulesNav } from './rules.nav';
import { settingsNav } from './settings.nav';
import { templatesNav } from './templates.nav';
import { ttsNav } from './tts.nav';

const registry: NavItem[] = [
  battleNav,
  billingNav,
  channelsNav,
  dashboardNav,
  discoNav,
  overlaysNav,
  rulesNav,
  settingsNav,
  templatesNav,
  ttsNav,
];

export type { NavItem };

/** Visible items, in display order. */
export function getNavItems(): NavItem[] {
  return registry
    .filter((item) => item.enabled !== false)
    .sort((a, b) => a.order - b.order);
}

/** Daily destinations — the main body of the sidebar. */
export function getPrimaryNavItems(): NavItem[] {
  return getNavItems().filter((item) => item.placement !== 'bottom');
}

/** Pinned to the foot of the sidebar. */
export function getBottomNavItems(): NavItem[] {
  return getNavItems().filter((item) => item.placement === 'bottom');
}

/**
 * Nhóm hiển thị trong sidebar.
 *
 * Mười mục ngang hàng thì không mục nào nổi lên, và người dùng mới không đoán
 * được thứ nào cần trước. Ba cụm phản ánh cách công việc thật diễn ra: dựng
 * trước buổi live (Nội dung), chạy trong buổi live (Vận hành), phần còn lại.
 *
 * Suy ra từ `order` chứ không thêm trường mới vào mười file `*.nav.ts` — những
 * file đó là append-only có chủ đích, và sửa cả mười là cách chế tạo xung đột
 * merge. Khoảng `order` đã sẵn phản ánh đúng cách nhóm này.
 */
export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

const GROUP_RANGES: ReadonlyArray<{ id: string; label: string; max: number }> = [
  { id: 'operate', label: 'Vận hành', max: 29 },
  { id: 'content', label: 'Nội dung', max: 59 },
  { id: 'account', label: 'Tài khoản', max: Number.POSITIVE_INFINITY },
];

export function getNavGroups(): NavGroup[] {
  const primary = getPrimaryNavItems();

  return GROUP_RANGES.map((range, index) => {
    const min = index === 0 ? -Infinity : GROUP_RANGES[index - 1].max;
    return {
      id: range.id,
      label: range.label,
      items: primary.filter((item) => item.order > min && item.order <= range.max),
    };
    // Nhóm rỗng bị loại bên dưới: một tiêu đề không có mục nào chỉ tổ gây khó hiểu.
  }).filter((group) => group.items.length > 0);
}
