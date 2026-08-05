/**
 * Nav registry — frozen after Sprint 0.
 *
 * `Navbar.tsx` renders whatever this registry contains. Adding a feature means
 * adding one `*.nav.ts` file and one export line in `index.ts`, never editing
 * the Navbar component. That is what keeps two developers out of the same file.
 */
export interface NavItem {
  /** Stable id — also the React key. */
  id: string;
  label: string;
  href: string;
  /** Lower sorts first. Leave gaps so items can be inserted later. */
  order: number;
  /** Which developer owns the feature this item belongs to. Documentation only. */
  owner?: 'A' | 'B';
  /** Hide until the feature ships. */
  enabled?: boolean;
}
