import type { NavItem } from './types';

// Pinned to the foot of the sidebar: visited occasionally, not daily.
export const settingsNav: NavItem = {
  id: 'settings',
  label: 'Cài đặt',
  href: '/settings/profile',
  order: 90,
  owner: 'A',
  icon: 'gear',
  placement: 'bottom',
};
