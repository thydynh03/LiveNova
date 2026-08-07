import type { NavItem } from './types';

// Pinned near the foot: read once during setup, rarely after.
export const guideNav: NavItem = {
  id: 'guide',
  label: 'Hướng dẫn',
  href: '/huong-dan',
  order: 80,
  icon: 'info',
  placement: 'bottom',
};
