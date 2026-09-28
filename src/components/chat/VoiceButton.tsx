"use client";

import { Mic, MicOff } from "lucide-react";
import { cn } from "@/lib/cn";
import type { SpeechErrorKind, SpeechStatus } from "@/hooks/useSpeechRecognition";
import type { ChatStrings } from "@/lib/i18n";

/**
 * Mic button for voice input. Presentational: all recognition state lives in
 * useSpeechRecognition and is passed in. When listening it fills and shows a
 * pulse ring; when unsupported it is disabled with an explanatory tooltip.
 *
 * aria-pressed reflects the listening state and aria-label changes with it, so
 * screen-reader users hear the current action.
 */
export function VoiceButton({
  status,
  errorKind,
  strings,
  onToggle,
}: {
  status: SpeechStatus;
  errorKind: SpeechErrorKind | null;
  strings: ChatStrings;
  onToggle: () => void;
}) {
  const unsupported = status === "unsupported";
  const active = status === "listening" || status === "requesting";

  const label = unsupported
    ? strings.voice.unsupported
    : active
      ? strings.voice.stop
      : errorKind
        ? strings.voice.errors[errorKind]
        : strings.voice.start;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={unsupported}
      aria-pressed={active}
      aria-label={label}
      title={label}
      className={cn(
        "relative grid size-11 shrink-0 place-items-center rounded-xl transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "bg-primary text-on-primary"
          : "border border-border text-muted hover:bg-surface-muted hover:text-foreground",
      )}
    >
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-0 rounded-xl bg-primary/40 motion-safe:animate-ping"
        />
      )}
      {unsupported ? (
        <MicOff className="relative size-5" aria-hidden="true" />
      ) : (
        <Mic className="relative size-5" aria-hidden="true" />
      )}
    </button>
  );
}
