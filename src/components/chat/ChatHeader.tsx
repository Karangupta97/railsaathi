"use client";

import { PanelLeftOpen, SquarePen } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ChatStrings } from "@/lib/i18n";
import type { LanguageCode } from "@/lib/languages";
import { EmergencyButton } from "./EmergencyButton";
import { LanguageSelect } from "./LanguageSelect";

/**
 * Chat top bar. Left side has the sidebar controls: a collapse/expand toggle on
 * desktop (shown when the sidebar is collapsed) and a history/drawer button on
 * mobile. Right side keeps language, theme and the always-visible Emergency.
 */
export function ChatHeader({
  strings,
  language,
  onLanguageChange,
  onNewChat,
  canClear,
  sidebarOpen,
  onToggleSidebar,
  onOpenDrawer,
}: {
  strings: ChatStrings;
  language: LanguageCode;
  onLanguageChange: (code: LanguageCode) => void;
  onNewChat: () => void;
  canClear: boolean;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenDrawer: () => void;
}) {
  return (
    <header className="glass z-30 border-b border-border">
      <div className="flex h-16 items-center gap-2 px-3 sm:px-4">
        {/* Mobile: open the history drawer. */}
        <button
          type="button"
          onClick={onOpenDrawer}
          aria-label={strings.history.open}
          className="grid size-11 place-items-center rounded-xl text-foreground transition-colors hover:bg-surface-muted lg:hidden"
        >
          <PanelLeftOpen className="size-5" aria-hidden="true" />
        </button>

        {/* Desktop: expand the sidebar when it is collapsed. */}
        {!sidebarOpen && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label={strings.history.toggle}
            aria-expanded={sidebarOpen}
            className="hidden size-11 place-items-center rounded-xl text-foreground transition-colors hover:bg-surface-muted lg:grid"
          >
            <PanelLeftOpen className="size-5" aria-hidden="true" />
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onNewChat}
            disabled={!canClear}
            aria-label={strings.newChat}
            title={strings.newChat}
            className="grid size-11 place-items-center rounded-xl border border-border text-foreground transition-colors hover:bg-surface-muted disabled:opacity-40"
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
