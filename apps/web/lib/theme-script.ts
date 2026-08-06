/**
 * Runs before first paint to stop the dark-mode flash.
 *
 * The theme used to be applied from a `useEffect`, which only runs after
 * hydration — so anyone who prefers a dark UI got a white flash on every single
 * page load. For a product whose users sit in a dark room next to OBS at
 * midnight (NFR-30), that flash is the most visible defect on the site.
 *
 * This is injected as an inline <script> in <head>, so it executes before the
 * browser paints anything. It is deliberately tiny and dependency-free: it runs
 * on the critical path of every page.
 */
export const THEME_STORAGE_KEY = 'livenova-theme';

export const themeInitScript = `
(function () {
  try {
    var stored = localStorage.getItem('${THEME_STORAGE_KEY}');
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
  } catch (e) {
    // Private mode can throw on localStorage. A missing theme is survivable;
    // a thrown error before hydration is not.
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
`.trim();
