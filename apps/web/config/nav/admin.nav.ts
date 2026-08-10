import type { IconName } from '../../components/ui/Icon';

export interface AdminNavItem {
  id: string;
  href: string;
  label: string;
  icon: IconName;
  badge?: string;
  category: 'overview' | 'operations' | 'users' | 'system';
}

export const ADMIN_NAV_CATEGORIES = [
  { id: 'overview', label: 'TỔNG QUAN & PHÂN TÍCH' },
  { id: 'operations', label: 'VẬN HÀNH LIVE & GAME' },
  { id: 'users', label: 'NGƯỜI DÙNG & TÀI CHÍNH' },
  { id: 'system', label: 'HẠ TẦNG & BẢO MẬT' },
] as const;

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  // I. Tổng quan & phân tích
  {
    id: 'admin-dashboard',
    href: '/admin',
    label: 'Dashboard Tổng Quan',
    icon: 'home',
    category: 'overview',
  },
  {
    id: 'admin-analytics',
    href: '/admin/analytics',
    label: 'Lưu Lượng & Hành Vi',
    icon: 'chart',
    category: 'overview',
  },
  {
    id: 'admin-seo',
    href: '/admin/seo',
    label: 'Sức Khoẻ SEO',
    icon: 'search',
    category: 'overview',
  },
  // II. Vận hành Live & Game
  {
    id: 'admin-games',
    href: '/battle/simulator',
    label: 'Đại Chiến & Sàn Đấu',
    icon: 'versus',
    badge: '4-Way',
    category: 'operations',
  },
  {
    id: 'admin-templates',
    href: '/admin/templates',
    label: 'Kho Mẫu & Widgets',
    icon: 'spark',
    category: 'operations',
  },
  // III. Người dùng & tài chính
  {
    id: 'admin-users',
    href: '/admin/users',
    label: 'Streamers & Tài khoản',
    icon: 'user',
    category: 'users',
  },
  // IV. Hạ tầng & bảo mật
  {
    id: 'admin-audit',
    href: '/admin/audit',
    label: 'Nhật Ký Quản Trị',
    icon: 'queue',
    category: 'system',
  },
];
