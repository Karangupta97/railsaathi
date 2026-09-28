"use client";

import Link from "next/link";
import { SquarePen } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ChatStrings } from "@/lib/i18n";
import type { LanguageCode } from "@/lib/languages";
import { SITE_NAME } from "@/lib/site";
import { EmergencyButton } from "./EmergencyButton";
import { LanguageSelect } from "./LanguageSelect";

/**
 * Minimal chat header (no shared Navbar exists yet): logo + wordmark, New chat,
 * language selector, theme toggle and the always-visible Emergency button.
 */
export function ChatHeader({
  strings,
  language,
  onLanguageChange,
  onNewChat,
  canClear,
}: {
  strings: ChatStrings;
  language: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  onNewChat: () => void;
  canClear: boolean;
}) {
  return (
    <header className="glass z-30 border-b border-border">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4">
        <Link href="/" className="flex items-center gap-2 rounded-lg pr-1 font-display font-bold text-foreground">
          <Logo size={28} />
          <span className="text-lg tracking-tight">{SITE_NAME}</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onNewChat}
            disabled={!canClear}
            className="hidden h-11 items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted disabled:opacity-40 sm:inline-flex"
          >
            <SquarePen className="size-4" aria-hidden="true" />
            {strings.newChat}
          </button>
          <button
            type="button"
            onClick={onNewChat}
            disabled={!canClear}
            aria-label={strings.newChat}
            className="grid size-11 place-items-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-muted disabled:opacity-40 sm:hidden"
          >
            <SquarePen className="size-5" aria-hidden="true" />
          </button>

          <LanguageSelect value={language} onChange={onLanguageChange} label={strings.language} />
          <ThemeToggle label={strings.theme.dark} />
          <EmergencyButton label={strings.emergency} callLabel={strings.emergencyCall(strings.emergency)} />
        </div>
      </div>
    </header>
  );
}
