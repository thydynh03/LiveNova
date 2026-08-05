import type { NavItem } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// APPEND-ONLY. Add one import + one array entry per feature, keep alphabetical.
// Do not reorder, reformat, or refactor this file — that is how merge conflicts
// get manufactured. Ordering on screen comes from NavItem.order, not from here.
// ─────────────────────────────────────────────────────────────────────────────
import { billingNav } from './billing.nav';
import { channelsNav } from './channels.nav';
import { dashboardNav } from './dashboard.nav';
import { overlaysNav } from './overlays.nav';
import { rulesNav } from './rules.nav';
import { ttsNav } from './tts.nav';

const registry: NavItem[] = [
  billingNav,
  channelsNav,
  dashboardNav,
  overlaysNav,
  rulesNav,
  ttsNav,
];

export type { NavItem };

/** Visible items, in display order. */
export function getNavItems(): NavItem[] {
  return registry
    .filter((item) => item.enabled !== false)
    .sort((a, b) => a.order - b.order);
}
