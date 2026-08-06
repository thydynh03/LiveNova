import type { NavItem } from './types';

// "Overlay" is OBS jargon. What the user is arranging is what viewers see.
export const overlaysNav: NavItem = {
  id: 'overlays',
  label: 'Hiệu ứng',
  href: '/overlays',
  order: 40,
  owner: 'B',
  icon: 'spark',
};
