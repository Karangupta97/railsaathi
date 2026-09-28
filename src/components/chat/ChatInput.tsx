"use client";

import { useCallback, useId, useLayoutEffect, useRef, useState } from "react";
import { Send, Square } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ChatStrings } from "@/lib/i18n";
import type { Language } from "@/lib/languages";
import { EMERGENCY_NUMBER, MAX_MESSAGE_CHARS, MESSAGE_COUNTER_FROM } from "@/lib/site";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { VoiceButton } from "./VoiceButton";

/**
 * Sticky input dock: auto-growing textarea (1–5 rows), mic, and send/stop.
 * Enter sends, Shift+Enter inserts a newline. Voice transcripts append to the
 * typed text (interim shown live, muted); nothing auto-sends.
 */
export function ChatInput({
  strings,
  language,
  isStreaming,
  onSend,
  onStop,
}: {
  strings: ChatStrings;
  language: Language;
  isStreaming: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showVoicePrivacy, setShowVoicePrivacy] = useState(false);
  const liveRegionId = useId();

  const speech = useSpeechRecognition({
    language,
    onFinalTranscript: useCallback((text: string) => {
      // Append the finalised segment to whatever is already typed.
      setValue((prev) => (prev ? `${prev.replace(/\s+$/, "")} ${text}` : text).slice(0, MAX_MESSAGE_CHARS));
    }, []),
  });

  // Auto-grow the textarea up to ~5 rows, then scroll.
  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 5 * 24 + 24; // ~5 lines + padding
    el.style.height = `${Math.min(el.scrollHeight, max)}px`;
  }, [value, speech.interimTranscript]);

  const submit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isStreaming) return;
    onSend(trimmed.slice(0, MAX_MESSAGE_CHARS));
    setValue("");
    // Return focus so the next message can be typed straight away.
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [value, isStreaming, onSend]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const toggleVoice = () => {
    if (!speech.isActive) setShowVoicePrivacy(true);
    speech.toggle();
  };

  const displayValue = speech.interimTranscript
    ? `${value ? `${value} ` : ""}${speech.interimTranscript}`
    : value;

  const count = value.length;
  const showCounter = count >= MESSAGE_COUNTER_FROM;
  const canSend = value.trim().length > 0 && !isStreaming;

  return (
    <div className="glass border-t border-border">
      <div
        className="mx-auto w-full max-w-[720px] px-4 pt-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        {/* Voice state announcements. */}
        <VoiceStatusLine id={liveRegionId} speech={speech} strings={strings} />

        {showVoicePrivacy && speech.isSupported && (
          <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-surface-muted px-3 py-1.5 text-xs text-muted">
            <span>{strings.voice.privacy}</span>
            <button
              type="button"
              onClick={() => setShowVoicePrivacy(false)}
              className="shrink-0 font-medium text-primary-ink hover:underline"
            >
              {strings.voice.gotIt}
            </button>
          </div>
        )}

        <div
          className={cn(
            "flex items-end gap-2 rounded-2xl border bg-surface p-2 transition-colors",
            "focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/30",
            speech.isActive ? "border-primary" : "border-border",
          )}
        >
          <VoiceButton
            status={speech.status}
            errorKind={speech.errorKind}
            strings={strings}
            onToggle={toggleVoice}
          />

          <label htmlFor="chat-input" className="sr-only">
            {strings.inputLabel}
          </label>
          <textarea
            id="chat-input"
            ref={textareaRef}
            rows={1}
            value={displayValue}
            onChange={(e) => setValue(e.target.value.slice(0, MAX_MESSAGE_CHARS))}
            onKeyDown={onKeyDown}
            placeholder={strings.placeholder}
            aria-describedby={`chat-help ${showCounter ? "chat-count" : ""}`.trim()}
            enterKeyHint="send"
            className={cn(
              "max-h-[9rem] min-h-[2.75rem] flex-1 resize-none self-center bg-transparent px-1 py-2.5 text-[15px] leading-6 outline-none placeholder:text-muted",
              speech.interimTranscript && "text-muted",
            )}
          />

          {isStreaming ? (
            <button
              type="button"
              onClick={onStop}
              aria-label={strings.stop}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-muted text-foreground transition-colors hover:bg-border-strong/20"
            >
              <Square className="size-5 fill-current" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              aria-label={strings.send}
              className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary text-on-primary transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="size-5" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="mt-1.5 flex items-center justify-between gap-3 px-1">
          <p id="chat-help" className="text-xs text-muted">
            {strings.helperBefore}{" "}
            <a href={`tel:${EMERGENCY_NUMBER}`} className="font-mono font-medium text-primary-ink hover:underline">
              {EMERGENCY_NUMBER}
            </a>
            {strings.helperAfter}
          </p>
          {showCounter && (
            <span
              id="chat-count"
              className={cn("shrink-0 font-mono text-xs", count >= MAX_MESSAGE_CHARS ? "text-emergency-ink" : "text-muted")}
            >
              {count}/{MAX_MESSAGE_CHARS}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Live region + visible listening hint for the mic. */
function VoiceStatusLine({
  id,
  speech,
  strings,
}: {
  id: string;
  speech: ReturnType<typeof useSpeechRecognition>;
  strings: ChatStrings;
}) {
  // Derive the announcement from status directly; no effect/state needed.
  let announced = "";
  if (speech.status === "listening") announced = strings.voice.listening;
  else if (speech.status === "idle") announced = strings.voice.stopped;
  else if (speech.status === "error" && speech.errorKind) announced = strings.voice.errors[speech.errorKind];

  const showError = speech.status === "error" && speech.errorKind;

  return (
    <>
      <p id={id} role="status" aria-live="assertive" className="sr-only">
        {announced}
      </p>
      {speech.status === "listening" && (
        <div className="mb-2 flex items-center gap-2 px-1 text-sm text-primary-ink">
          <EqualizerBars />
          <span>{strings.voice.listening}</span>
          <span className="text-muted">{strings.voice.listeningHint}</span>
        </div>
      )}
      {showError && (
        <p className="mb-2 px-1 text-sm text-warning-ink">{strings.voice.errors[speech.errorKind!]}</p>
      )}
    </>
  );
}

function EqualizerBars() {
  return (
    <span className="flex items-end gap-0.5" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className="w-0.5 rounded-full bg-primary [animation:var(--animate-eq)]"
          style={{ height: "14px", animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}
