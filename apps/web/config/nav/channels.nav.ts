import type { NavItem } from './types';

// F02 — Dev B. Hidden until the channel-connect UI ships.
export const channelsNav: NavItem = {
  id: 'channels',
  label: 'Kênh',
  href: '/channels',
  order: 20,
  owner: 'B',
  enabled: false,
};
