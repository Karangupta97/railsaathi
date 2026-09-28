import { THEME_KEY } from "@/lib/preferences";

/**
 * Applies the persisted (or system) theme before first paint, so there is no
 * flash of the wrong theme. Must run in <head> before the body renders.
 * Kept dependency-free and inlined; the string is static, not user input.
 */
export function ThemeScript() {
  const script = `(function(){try{var k=${JSON.stringify(THEME_KEY)};var s=localStorage.getItem(k);var d=s?s==='dark':matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.classList.toggle('dark',d);}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
