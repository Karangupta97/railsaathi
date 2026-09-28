"use client";

import { Moon, Sun } from "lucide-react";
import { setTheme, useIsDark } from "@/lib/preferences";

/** Dark-mode toggle. The persisted preference is applied pre-paint by ThemeScript. */
export function ThemeToggle({ label }: { label: string }) {
  const isDark = useIsDark();

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label={label}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="inline-flex size-11 items-center justify-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-muted"
    >
      {isDark ? <Moon className="size-5" aria-hidden="true" /> : <Sun className="size-5" aria-hidden="true" />}
    </button>
  );
}
