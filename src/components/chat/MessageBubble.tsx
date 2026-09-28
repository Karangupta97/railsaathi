"use client";

import { memo, useState } from "react";
import { Check, Copy, RotateCcw, ThumbsDown, ThumbsUp, TriangleAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";
import type { Feedback, Message } from "@/lib/chat-types";
import type { ChatStrings } from "@/lib/i18n";
import { RichText } from "./RichText";
import { ThinkingIndicator } from "./ThinkingIndicator";

/**
 * A single chat bubble. Memoised so streaming one message doesn't re-render the
 * rest of the list. `isLast` gates the "always visible" action row on mobile.
 */
type Props = {
  message: Message;
  strings: ChatStrings;
  isLast: boolean;
  onRetry: () => void;
  onCancel: () => void;
  onFeedback: (id: string, feedback: Feedback) => void;
};

function MessageBubbleImpl({ message, strings, isLast, onRetry, onCancel, onFeedback }: Props) {
  if (message.role === "user") return <UserBubble message={message} />;
  if (message.status === "error") return <ErrorBubble message={message} strings={strings} onRetry={onRetry} />;
  return (
    <AssistantBubble
      message={message}
      strings={strings}
      isLast={isLast}
      onCancel={onCancel}
      onFeedback={onFeedback}
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
  isLast,
  onCancel,
  onFeedback,
}: {
  message: Message;
  strings: ChatStrings;
  isLast: boolean;
  onCancel: () => void;
  onFeedback: (id: string, feedback: Feedback) => void;
}) {
  const thinking = message.status === "thinking" && message.content.length === 0;
  const streaming = message.status === "streaming";

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
              <RichText text={message.content} />
              {streaming && (
                <span
                  aria-hidden="true"
                  className="ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-primary [animation:var(--animate-caret)]"
                />
              )}
              {message.stopped && <span className="mt-2 block text-xs text-muted">{strings.stopped}</span>}
            </div>
          )}
        </div>

        {message.status === "done" && (
          <AssistantActions message={message} strings={strings} isLast={isLast} onFeedback={onFeedback} />
        )}
      </div>
    </div>
  );
}

function AssistantActions({
  message,
  strings,
  isLast,
  onFeedback,
}: {
  message: Message;
  strings: ChatStrings;
  isLast: boolean;
  onFeedback: (id: string, feedback: Feedback) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (insecure context): silently ignore.
    }
  };

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
