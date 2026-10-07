"use client";

import { MessageSquareDashed, Plus } from "lucide-react";
import type { ChatStrings } from "@/lib/i18n";

/** Shown when /chat/[id] refers to a conversation that isn't on this device. */
export function ChatNotFound({ strings, onNewChat }: { strings: ChatStrings; onNewChat: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="grid size-14 place-items-center rounded-2xl border border-border bg-surface">
        <MessageSquareDashed className="size-7 text-muted" aria-hidden="true" />
      </span>
      <div>
        <h1 className="font-display text-xl font-bold text-foreground">{strings.history.notFound}</h1>
        <p className="mt-1.5 max-w-sm text-sm text-muted">{strings.history.notFoundBody}</p>
      </div>
      <button
        type="button"
        onClick={onNewChat}
        className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 font-semibold text-on-primary transition-colors hover:bg-primary-hover"
      >
        <Plus className="size-4" aria-hidden="true" />
        {strings.newChat}
      </button>
    </div>
  );
}
