import { THEME_KEY } from "@/lib/preferences";

/**
 * Applies the persisted theme before first paint, so there is no flash of the
 * wrong theme. Must run in <head> before the body renders. Kept dependency-free
 * and inlined; the string is static, not user input.
 *
 * Default is LIGHT: dark mode only turns on when the user has explicitly saved
 * it (via the theme toggle). The OS `prefers-color-scheme` is intentionally
 * ignored so first-time visitors always start in light.
 */
export function ThemeScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_KEY)};document.documentElement.classList.toggle('dark',localStorage.getItem(k)==='dark');}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
