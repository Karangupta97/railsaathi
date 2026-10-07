"use client";

import { Fragment } from "react";
import type { Feedback, LanguageCode, Message } from "@/lib/chat-types";
import type { ChatStrings } from "@/lib/i18n";
import { LANGUAGES } from "@/lib/languages";
import { MessageBubble } from "./MessageBubble";
import { SuggestionChips } from "./SuggestionChips";

/**
 * Renders the conversation. It is a role="log" with aria-live="polite" so
 * screen readers hear completed messages (not every streamed token — the
 * streaming bubble itself is not announced word by word).
 *
 * A centred time divider is shown when the gap between consecutive messages
 * exceeds a few minutes. Follow-up chips render only under the latest
 * assistant message.
 */
const TIME_GAP_MS = 4 * 60 * 1000;

export function MessageList({
  messages,
  strings,
  currentLang,
  onSend,
  onRetry,
  onCancel,
  onFeedback,
  onTranslate,
}: {
  messages: readonly Message[];
  strings: ChatStrings;
  currentLang: LanguageCode;
  onSend: (text: string) => void;
  onRetry: () => void;
  onCancel: () => void;
  onFeedback: (id: string, feedback: Feedback) => void;
  onTranslate: (id: string) => void;
}) {
  const lastAssistantId = [...messages].reverse().find((m) => m.role === "assistant")?.id;

  return (
    <div role="log" aria-live="polite" aria-label={strings.pageTitle} className="flex flex-col">
      {messages.map((message, index) => {
        if (message.role === "notice") {
          return <NoticeDivider key={message.id} message={message} strings={strings} />;
        }

        const prev = messages[index - 1];
        const showDivider = prev && prev.role !== "notice" && message.createdAt - prev.createdAt > TIME_GAP_MS;
        const sameSenderAsPrev = prev?.role === message.role && !showDivider;
        const isLastAssistant = message.id === lastAssistantId;
        const showFollowUps =
          isLastAssistant && message.status === "done" && (message.followUps?.length ?? 0) > 0;

        return (
          <Fragment key={message.id}>
            {showDivider && <TimeDivider timestamp={message.createdAt} />}
            <div className={sameSenderAsPrev ? "mt-1" : "mt-4 first:mt-0"}>
              <div className="group">
                <MessageBubble
                  message={message}
                  strings={strings}
                  currentLang={currentLang}
                  isLast={message.id === messages[messages.length - 1]?.id}
                  onRetry={onRetry}
                  onCancel={onCancel}
                  onFeedback={onFeedback}
                  onTranslate={onTranslate}
                />
              </div>

              {showFollowUps && (
                <div className="mt-3 pl-[2.375rem]">
                  <SuggestionChips
                    items={message.followUps!}
                    onSelect={onSend}
                    kind={message.followUpKind ?? "suggestions"}
                    label={message.followUpKind === "choices" ? strings.choicesLabel : strings.followUpsLabel}
                  />
                </div>
              )}
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}

/** Centred "Language changed to X" divider. */
function NoticeDivider({ message, strings }: { message: Message; strings: ChatStrings }) {
  const langLabel = message.noticeLang ? LANGUAGES[message.noticeLang].label : "";
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-border" />
      <span>{strings.languageChangedTo(langLabel)}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function TimeDivider({ timestamp }: { timestamp: number }) {
  const label = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="my-4 flex items-center gap-3 text-xs text-muted">
      <span className="h-px flex-1 bg-border" />
      <time dateTime={new Date(timestamp).toISOString()}>{label}</time>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}
