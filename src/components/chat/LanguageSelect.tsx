"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Languages as LanguagesIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { LANGUAGE_CODES, LANGUAGES, type LanguageCode } from "@/lib/languages";

/**
 * Language menu (English / हिन्दी / मराठी). Controlled by the parent so the
 * choice can drive both speech recognition and the reply language.
 *
 * Implemented as a labelled button + menu with roving focus, Esc to close,
 * outside-click to dismiss, and focus returning to the trigger.
 */
export function LanguageSelect({
  value,
  onChange,
  label,
}: {
  value: LanguageCode;
  onChange: (code: LanguageCode) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // Focus the active item when the menu opens.
    const activeIndex = Math.max(0, LANGUAGE_CODES.indexOf(value));
    itemsRef.current[activeIndex]?.focus();
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, value]);

  const focusItem = (index: number) => {
    const count = LANGUAGE_CODES.length;
    const next = (index + count) % count;
    itemsRef.current[next]?.focus();
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${label}: ${LANGUAGES[value].label}`}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-11 items-center gap-1.5 rounded-xl border border-border px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
      >
        <LanguagesIcon className="size-4" aria-hidden="true" />
        <span className="min-w-[2.5ch] text-center">{LANGUAGES[value].label}</span>
        <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="menu"
          aria-label={label}
          className="absolute right-0 z-50 mt-2 min-w-[9rem] animate-fade-in rounded-xl border border-border bg-surface p-1 shadow-lift"
        >
          {LANGUAGE_CODES.map((code, index) => {
            const selected = code === value;
            return (
              <button
                key={code}
                ref={(el) => {
                  itemsRef.current[index] = el;
                }}
                role="menuitemradio"
                aria-checked={selected}
                type="button"
                onClick={() => {
                  onChange(code);
                  setOpen(false);
                  buttonRef.current?.focus();
                }}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    focusItem(index + 1);
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    focusItem(index - 1);
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  selected ? "bg-primary-soft text-primary-ink" : "text-foreground hover:bg-surface-muted",
                )}
              >
                <span>{LANGUAGES[code].label}</span>
                {selected && <Check className="size-4" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
