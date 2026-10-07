"use client";

import { useEffect, useRef, useState } from "react";
import { PanelLeftClose, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { ChatStrings } from "@/lib/i18n";
import type { DateGroupKey } from "@/lib/group-by-date";
import { SITE_NAME } from "@/lib/site";
import { useChatHistory, useAnnouncer } from "@/hooks/useChatHistory";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { ChatHistoryItem } from "./ChatHistoryItem";
import { ChatSearch } from "./ChatSearch";
import { ConfirmDialog } from "./ConfirmDialog";

/**
 * Conversation history sidebar. On desktop it is an inline collapsible column
 * (width handled by the parent grid). On mobile (`asDrawer`) it renders as an
 * off-canvas drawer with a dim backdrop and trapped focus.
 */
export function ChatSidebar({
  strings,
  activeId,
  onOpenChat,
  onNewChat,
  onCollapse,
  asDrawer = false,
  onCloseDrawer,
}: {
  strings: ChatStrings;
  activeId: string | null;
  onOpenChat: (id: string) => void;
  onNewChat: () => void;
  onCollapse?: () => void;
  asDrawer?: boolean;
  onCloseDrawer?: () => void;
}) {
  const history = useChatHistory();
  const { message: liveMessage, announce } = useAnnouncer();
  const searchRef = useRef<HTMLInputElement>(null);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [clearOpen, setClearOpen] = useState(false);

  // Cmd/Ctrl+K focuses search while the sidebar is present.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const groupLabels: Record<DateGroupKey, string> = strings.history.groups;

  const confirmDelete = async () => {
    if (!deleteId) return;
    await history.remove(deleteId);
    setDeleteId(null);
    announce(strings.history.deleted);
  };

  const confirmClear = async () => {
    await history.clearAll();
    setClearOpen(false);
    announce(strings.history.deleted);
  };

  const rename = (id: string, title: string) => {
    void history.rename(id, title);
    announce(strings.history.renamed);
  };

  const content = (
    <div className="flex h-full flex-col bg-surface-muted">
      {/* Header: logo + collapse/close */}
      <div className="flex h-16 items-center justify-between px-3">
        <span className="flex items-center gap-2 font-display font-bold text-foreground">
          <Logo size={26} />
          <span className="tracking-tight">{SITE_NAME}</span>
        </span>
        <button
          type="button"
          onClick={asDrawer ? onCloseDrawer : onCollapse}
          aria-label={asDrawer ? strings.history.close : strings.history.toggle}
          className="grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-surface hover:text-foreground"
        >
          <PanelLeftClose className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* New chat */}
      <div className="px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="flex h-11 w-full items-center gap-2 rounded-xl border border-border bg-surface px-3 text-sm font-semibold text-foreground transition-colors hover:border-border-strong hover:bg-surface-muted"
        >
          <Plus className="size-4" aria-hidden="true" />
          {strings.newChat}
        </button>
      </div>

      {/* Search */}
      <div className="px-3 pt-3">
        <ChatSearch ref={searchRef} value={history.query} onChange={history.setQuery} strings={strings} />
      </div>

      {/* List */}
      <nav aria-label={strings.history.title} className="mt-3 min-h-0 flex-1 overflow-y-auto pb-2">
        {!history.hasAny ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{strings.history.empty}</p>
        ) : !history.hasResults ? (
          <p className="px-4 py-6 text-center text-sm text-muted">{strings.history.noResults}</p>
        ) : (
          history.groups.map((group) => (
            <div key={group.key} className="mb-2">
              <h2 className="px-4 py-1 text-xs font-medium uppercase tracking-wide text-muted">
                {groupLabels[group.key]}
              </h2>
              <ul>
                {group.items.map((summary) => (
                  <ChatHistoryItem
                    key={summary.id}
                    summary={summary}
                    active={summary.id === activeId}
                    strings={strings}
                    onOpen={onOpenChat}
                    onRename={rename}
                    onRequestDelete={setDeleteId}
                  />
                ))}
              </ul>
            </div>
          ))
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-3 py-3">
        {!history.storageAvailable && (
          <p className="mb-2 rounded-lg bg-warning/15 px-2.5 py-1.5 text-xs text-warning-ink">
            {strings.history.storageUnavailable}
          </p>
        )}
        <div className="flex items-center gap-2">
          <ThemeToggle label={strings.theme.dark} />
          {history.hasAny && (
            <button
              type="button"
              onClick={() => setClearOpen(true)}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-border px-3 text-sm font-medium text-muted transition-colors hover:bg-surface hover:text-foreground"
            >
              <Trash2 className="size-4" aria-hidden="true" />
              {strings.history.clearAll}
            </button>
          )}
        </div>
        <p className="mt-2 flex items-center gap-1.5 px-1 text-xs text-muted">
          <ShieldCheck className="size-3.5 shrink-0" aria-hidden="true" />
          {strings.history.deviceOnly}
        </p>
      </div>

      {/* Live region for delete/rename announcements. */}
      <p role="status" aria-live="polite" className="sr-only">
        {liveMessage}
      </p>

      <ConfirmDialog
        open={deleteId !== null}
        title={strings.history.confirmDeleteTitle}
        body={strings.history.confirmDeleteBody}
        confirmLabel={strings.history.confirm}
        cancelLabel={strings.cancel}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteId(null)}
      />
      <ConfirmDialog
        open={clearOpen}
        title={strings.history.confirmClearTitle}
        body={strings.history.confirmClearBody}
        confirmLabel={strings.history.clearAll}
        cancelLabel={strings.cancel}
        onConfirm={confirmClear}
        onCancel={() => setClearOpen(false)}
      />
    </div>
  );

  if (!asDrawer) return content;

  return <MobileDrawer onClose={onCloseDrawer ?? (() => {})} label={strings.history.title}>{content}</MobileDrawer>;
}

/** Off-canvas drawer wrapper with backdrop, focus trap and body scroll lock. */
function MobileDrawer({
  children,
  onClose,
  label,
}: {
  children: React.ReactNode;
  onClose: () => void;
  label: string;
}) {
  const trapRef = useFocusTrap<HTMLDivElement>(true, onClose);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[60] lg:hidden">
      <div className="absolute inset-0 bg-black/40 motion-safe:animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="absolute inset-y-0 left-0 w-[85vw] max-w-[320px] border-r border-border shadow-lift motion-safe:animate-fade-in"
      >
        {children}
      </div>
    </div>
  );
}
