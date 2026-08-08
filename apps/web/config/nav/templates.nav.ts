import type { NavItem } from './types';

// "Kho mẫu" chứ không phải "Template": người dùng là streamer, không phải dev.
export const templatesNav: NavItem = {
  id: 'templates',
  label: 'Kho mẫu',
  href: '/templates',
  order: 35,
  owner: 'B',
  icon: 'spark',
};
