"use client";

import { memo, useState } from "react";
import { Check, Copy, Languages, RotateCcw, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import type { Feedback, LanguageCode, Message } from "@/lib/chat-types";
import type { ChatStrings } from "@/lib/i18n";
import { RichText } from "./RichText";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { TrainResultCard } from "./TrainResultCard";

/**
 * A single chat bubble. Memoised so streaming one message doesn't re-render the
 * rest of the list. `isLast` gates the "always visible" action row on mobile.
 */
type Props = {
  message: Message;
  strings: ChatStrings;
  currentLang: LanguageCode;
  isLast: boolean;
  onRetry: () => void;
  onCancel: () => void;
  onFeedback: (id: string, feedback: Feedback) => void;
  onTranslate: (id: string) => void;
};

function MessageBubbleImpl({ message, strings, currentLang, isLast, onRetry, onCancel, onFeedback, onTranslate }: Props) {
  if (message.role === "user") return <UserBubble message={message} />;
  if (message.status === "error") return <ErrorBubble message={message} strings={strings} onRetry={onRetry} />;
  return (
    <AssistantBubble
      message={message}
      strings={strings}
      currentLang={currentLang}
      isLast={isLast}
      onCancel={onCancel}
      onFeedback={onFeedback}
      onTranslate={onTranslate}
    />
  );
}

function UserBubble({ message }: { message: Message }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%] rounded-2xl rounded-br-md bg-primary px-4 py-3 text-[15px] text-on-primary shadow-soft sm:max-w-[80%]">
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
      </div>
    </div>
  );
}

function AssistantBubble({
  message,
  strings,
  currentLang,
  isLast,
  onCancel,
  onFeedback,
  onTranslate,
}: {
  message: Message;
  strings: ChatStrings;
  currentLang: LanguageCode;
  isLast: boolean;
  onCancel: () => void;
  onFeedback: (id: string, feedback: Feedback) => void;
  onTranslate: (id: string) => void;
}) {
  const thinking = message.status === "thinking" && message.content.length === 0;
  const streaming = message.status === "streaming";

  // Show a translation if one is active for this message.
  const shown = message.shownLang;
  const displayText = shown && message.translations?.[shown] ? message.translations[shown]! : message.content;
  const isTranslated = Boolean(shown && shown !== message.lang && message.translations?.[shown]);

  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-border bg-surface">
        <Logo size={18} />
      </span>
      <div className="min-w-0 max-w-[85%]">
        <div className="rounded-2xl rounded-tl-md border border-border bg-surface px-4 py-3 text-[15px]">
          {thinking ? (
            <ThinkingIndicator strings={strings} stage={message.stage} onCancel={onCancel} />
          ) : (
            <div className="break-words">
              <RichText text={displayText} />
              {streaming && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-primary [animation:var(--animate-caret)]"
                />
              )}
              {isTranslated && <span className="mt-2 block text-xs text-muted">{strings.translatedNote}</span>}
              {message.stopped && <span className="mt-2 block text-xs text-muted">{strings.stopped}</span>}
            </div>
          )}
        </div>

        {/* Structured train results (from the [[TRAINS]] trailer). */}
        {message.status === "done" && message.trains && (
          <TrainResultCard payload={message.trains} strings={strings} />
        )}

        {message.status === "done" && (
          <AssistantActions
            message={message}
            strings={strings}
            currentLang={currentLang}
            isLast={isLast}
            onFeedback={onFeedback}
            onTranslate={onTranslate}
          />
        )}
      </div>
    </div>
  );
}

function AssistantActions({
  message,
  strings,
  currentLang,
  isLast,
  onFeedback,
  onTranslate,
}: {
  message: Message;
  strings: ChatStrings;
  currentLang: LanguageCode;
  isLast: boolean;
  onFeedback: (id: string, feedback: Feedback) => void;
  onTranslate: (id: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      const shown = message.shownLang;
      const text = shown && message.translations?.[shown] ? message.translations[shown]! : message.content;
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context): silently ignore.
    }
  };

  const translating = message.translating === true;
  // Offer Translate only when the current language differs from the reply's language.
  const canTranslate = currentLang !== message.lang;
  const isShowingTranslation = message.shownLang !== undefined && message.shownLang !== message.lang;

  return (
    <div
      className={cn(
        "mt-1.5 flex items-center gap-1 transition-opacity",
        // Always visible on the latest message and on touch; hover-reveal on desktop.
        isLast ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100",
      )}
    >
      <ActionButton label={copied ? strings.copied : strings.copy} onClick={copy} active={copied}>
        {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      </ActionButton>
      <ActionButton
        label={strings.helpful}
        onClick={() => onFeedback(message.id, "up")}
        active={message.feedback === "up"}
      >
        <ThumbsUp className="size-4" aria-hidden="true" />
      </ActionButton>
      <ActionButton
        label={strings.notHelpful}
        onClick={() => onFeedback(message.id, "down")}
        active={message.feedback === "down"}
      >
        <ThumbsDown className="size-4" aria-hidden="true" />
      </ActionButton>
      {(canTranslate || isShowingTranslation) && (
        <button
          type="button"
          onClick={() => onTranslate(message.id)}
          disabled={translating}
          className="ml-1 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-muted transition-colors hover:bg-surface-muted hover:text-foreground disabled:opacity-60"
        >
          <Languages className="size-3.5" aria-hidden="true" />
          {translating ? strings.translating : isShowingTranslation ? strings.showOriginal : strings.translate}
        </button>
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "grid size-9 place-items-center rounded-lg transition-colors hover:bg-surface-muted",
        active ? "text-primary-ink" : "text-muted",
      )}
    >
      {children}
    </button>
  );
}

function ErrorBubble({ message, strings, onRetry }: { message: Message; strings: ChatStrings; onRetry: () => void }) {
  const text = message.error ? strings.errors[message.error] : strings.errors.server;
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-warning-ink/30 bg-warning/10">
        <TriangleAlert className="size-4 text-warning-ink" aria-hidden="true" />
      </span>
      <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-warning-ink/25 bg-warning/10 px-4 py-3 text-[15px]">
        <p className="text-foreground">{text}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-muted"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          {strings.retry}
        </button>
      </div>
    </div>
  );
}

export const MessageBubble = memo(MessageBubbleImpl);
