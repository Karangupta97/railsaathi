"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";
import { useFocusTrap } from "@/hooks/useFocusTrap";

/**
 * Accessible confirmation dialog (role="dialog" aria-modal). Focus is trapped
 * while open, Esc and backdrop click cancel, and focus returns to the trigger.
 * Used for delete and clear-all.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const trapRef = useFocusTrap<HTMLDivElement>(open, onCancel);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/40 motion-safe:animate-fade-in"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-5 shadow-lift motion-safe:animate-fade-in"
      >
        <h2 id={titleId} className="font-display text-lg font-bold text-foreground">
          {title}
        </h2>
        <p id={bodyId} className="mt-1.5 text-sm text-muted">
          {body}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-10 rounded-xl border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(
              "h-10 rounded-xl px-4 text-sm font-semibold text-white transition-colors",
              destructive ? "bg-emergency hover:bg-emergency-strong" : "bg-primary hover:bg-primary-hover",
            )}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
