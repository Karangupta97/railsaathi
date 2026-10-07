"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Check, MoreHorizontal, Pencil, Trash2, X } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ChatSummary } from "@/lib/chat-types";
import type { ChatStrings } from "@/lib/i18n";

/**
 * One row in the history list. Memoised so streaming (which never changes the
 * summaries snapshot) doesn't re-render rows. Supports inline rename and a
 * per-row options menu (Rename / Delete). The whole row is a link-like button
 * with aria-current when active; active state is a background, not colour only.
 */
type Props = {
  summary: ChatSummary;
  active: boolean;
  strings: ChatStrings;
  onOpen: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onRequestDelete: (id: string) => void;
};

function ChatHistoryItemImpl({ summary, active, strings, onOpen, onRename, onRequestDelete }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(summary.title);
  const rootRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const startEditing = () => {
    setDraft(summary.title);
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  // Close the menu on outside click / Esc.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [menuOpen]);

  const commitRename = () => {
    const next = draft.trim();
    if (next) onRename(summary.id, next); // empty name not allowed
    setEditing(false);
  };

  if (editing) {
    return (
      <li ref={rootRef} className="px-1">
        <div className="flex items-center gap-1 rounded-xl border border-primary bg-surface px-2 py-1">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitRename();
              } else if (e.key === "Escape") {
                e.preventDefault();
                setEditing(false);
              }
            }}
            aria-label={strings.history.rename}
            className="h-8 flex-1 bg-transparent text-sm text-foreground outline-none"
          />
          <button
            type="button"
            onClick={commitRename}
            aria-label={strings.history.save}
            className="grid size-8 place-items-center rounded-lg text-primary-ink hover:bg-surface-muted"
          >
            <Check className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            aria-label={strings.cancel}
            className="grid size-8 place-items-center rounded-lg text-muted hover:bg-surface-muted"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </li>
    );
  }

  return (
    <li ref={rootRef} className="group/row relative px-1">
      <div
        className={cn(
          "flex items-center rounded-xl transition-colors",
          active ? "bg-primary-soft" : "hover:bg-surface-muted",
        )}
      >
        <button
          type="button"
          onClick={() => onOpen(summary.id)}
          aria-current={active ? "page" : undefined}
          className="flex min-h-[44px] flex-1 items-center truncate rounded-xl px-3 text-left text-sm text-foreground"
        >
          <span className="truncate">{summary.title || strings.history.untitled}</span>
        </button>

        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label={strings.history.rowMenu}
          className={cn(
            "mr-1 grid size-9 shrink-0 place-items-center rounded-lg text-muted transition-opacity hover:bg-surface-muted hover:text-foreground",
            // Always visible on touch; hover/focus-reveal on desktop.
            "opacity-100 sm:opacity-0 sm:group-hover/row:opacity-100 sm:group-focus-within/row:opacity-100",
            menuOpen && "sm:opacity-100",
          )}
        >
          <MoreHorizontal className="size-4" aria-hidden="true" />
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          aria-label={strings.history.rowMenu}
          className="absolute right-2 top-full z-20 mt-1 min-w-[10rem] rounded-xl border border-border bg-surface p-1 shadow-lift motion-safe:animate-fade-in"
        >
          <MenuItem
            onClick={() => {
              setMenuOpen(false);
              startEditing();
            }}
          >
            <Pencil className="size-4" aria-hidden="true" />
            {strings.history.rename}
          </MenuItem>
          <MenuItem
            destructive
            onClick={() => {
              setMenuOpen(false);
              onRequestDelete(summary.id);
            }}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            {strings.history.delete}
          </MenuItem>
        </div>
      )}
    </li>
  );
}

function MenuItem({
  children,
  onClick,
  destructive,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-surface-muted",
        destructive ? "text-emergency-ink" : "text-foreground",
      )}
    >
      {children}
    </button>
  );
}

export const ChatHistoryItem = memo(ChatHistoryItemImpl);
