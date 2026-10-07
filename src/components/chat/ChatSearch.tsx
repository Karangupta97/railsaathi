"use client";

import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import type { ChatStrings } from "@/lib/i18n";

/**
 * Search input for the history list. Controlled by useChatHistory; debouncing
 * happens there. Cmd/Ctrl+K focuses it (handled in ChatSidebar).
 */
export const ChatSearch = forwardRef<HTMLInputElement, {
  value: string;
  onChange: (value: string) => void;
  strings: ChatStrings;
}>(function ChatSearch({ value, onChange, strings }, ref) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
      <input
        ref={ref}
        type="search"
        role="searchbox"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={strings.history.searchPlaceholder}
        aria-label={strings.history.search}
        className="h-10 w-full rounded-xl border border-border bg-surface pl-9 pr-9 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/30"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={strings.cancel}
          className="absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
});
