"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from "./languages";

/*
 * Client preferences backed by localStorage / the <html> class list.
 * useSyncExternalStore renders the server default during hydration, then the
 * stored value, so there are no hydration mismatches.
 */

// ---------- Language ----------
const LANG_KEY = "railsaathi:lang";
const LANG_EVENT = "railsaathi:lang-change";

function subscribeLanguage(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(LANG_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(LANG_EVENT, callback);
  };
}

function readLanguage(): LanguageCode {
  try {
    const value = window.localStorage.getItem(LANG_KEY);
    return isLanguageCode(value) ? value : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

export function setLanguage(code: LanguageCode) {
  try {
    window.localStorage.setItem(LANG_KEY, code);
  } catch {
    // Ignore: preference simply won't persist.
  }
  window.dispatchEvent(new Event(LANG_EVENT));
}

export function useLanguage(): LanguageCode {
  return useSyncExternalStore(subscribeLanguage, readLanguage, () => DEFAULT_LANGUAGE);
}

// ---------- Theme ----------
export const THEME_KEY = "railsaathi:theme";

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

export function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

export function setTheme(theme: "light" | "dark") {
  const root = document.documentElement;
  // Avoid every colour transition firing at once during the switch.
  root.classList.add("no-transitions");
  root.classList.toggle("dark", theme === "dark");
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // Ignore.
  }
  requestAnimationFrame(() => root.classList.remove("no-transitions"));
}

// ---------- Connectivity ----------
function subscribeOnline(callback: () => void) {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
