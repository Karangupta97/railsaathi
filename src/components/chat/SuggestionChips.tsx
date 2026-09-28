"use client";

import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";
import type { FollowUpKind } from "@/lib/chat-types";

/**
 * Renders starter prompts and follow-up questions as chips.
 * - kind="suggestions": compact pills with an arrow.
 * - kind="choices": larger primary-outline buttons for clarifying questions
 *   (e.g. "Peak hours" / "Off-peak hours").
 * Tapping a chip sends its text as a user message immediately.
 */
export function SuggestionChips({
  items,
  onSelect,
  kind = "suggestions",
  label,
  disabled,
}: {
  items: string[];
  onSelect: (text: string) => void;
  kind?: FollowUpKind;
  label: string;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <ul aria-label={label} className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item}>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onSelect(item)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full text-left transition-colors disabled:opacity-50",
              kind === "choices"
                ? "border border-primary px-4 py-2 text-sm font-semibold text-primary-ink hover:bg-primary-soft"
                : "border border-border bg-surface px-3 py-1.5 text-[13px] text-foreground hover:border-border-strong hover:bg-surface-muted",
            )}
          >
            <span>{item}</span>
            <ArrowRight className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
