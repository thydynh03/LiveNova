import type { NavItem } from './types';

// "Luật" tested badly: people read it as a rulebook they were being held to.
// "Kịch bản" is the word streamers already use for a planned sequence.
export const rulesNav: NavItem = {
  id: 'rules',
  label: 'Kịch bản',
  href: '/rules',
  order: 30,
  owner: 'A',
  icon: 'rule',
};
