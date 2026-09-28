"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowDown, WifiOff } from "lucide-react";
import type { ApiChatMessage, ChatErrorKind, Feedback, Message } from "@/lib/chat-types";
import { chatStore, createId } from "@/lib/chat-store";
import { CHAT_STRINGS } from "@/lib/i18n";
import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import { setLanguage, useLanguage, useOnline } from "@/lib/preferences";
import { detectUrgency } from "@/lib/urgency";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useChatStream } from "@/hooks/useChatStream";
import { useVisualViewportInset } from "@/hooks/useVisualViewport";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { EmergencyBanner } from "./EmergencyBanner";
import { EmptyState } from "./EmptyState";
import { MessageList } from "./MessageList";

/**
 * ChatShell owns the conversation state, streaming lifecycle, scroll behaviour
 * and page layout. The store lives in a module (chat-store) so it can persist
 * to sessionStorage and survive fast-refresh; we read it via
 * useSyncExternalStore for tear-free, hydration-safe rendering.
 */
export function ChatShell() {
  const language = useLanguage();
  const strings = CHAT_STRINGS[language];
  const online = useOnline();

  const messages = useSyncExternalStore(
    chatStore.subscribe,
    chatStore.getSnapshot,
    chatStore.getServerSnapshot,
  );

  const { send, stop, isStreaming } = useChatStream();
  const { scrollRef, showJumpButton, scrollToBottom, notifyContentChange } = useAutoScroll<HTMLDivElement>();
  const dockRef = useRef<HTMLDivElement>(null);
  useVisualViewportInset(dockRef);

  // Emergency banner visibility is independent of the LLM. It is render state,
  // so it lives in useState; a fresh urgent message re-shows a dismissed banner.
  const [showBanner, setShowBanner] = useState(false);

  const revealBanner = useCallback(() => setShowBanner(true), []);
  const dismissBanner = useCallback(() => setShowBanner(false), []);

  // Keep the newest content in view as it streams.
  useEffect(() => {
    notifyContentChange();
  }, [messages, notifyContentChange]);

  /** Runs one assistant turn against the given message history. */
  const runAssistantTurn = useCallback(
    (history: readonly Message[], lang: LanguageCode) => {
      const assistantId = createId();
      const assistant: Message = {
        id: assistantId,
        role: "assistant",
        content: "",
        status: "thinking",
        createdAt: Date.now(),
        lang,
        stage: 0,
      };
      chatStore.set((prev) => [...prev, assistant]);
      scrollToBottom("auto");

      const apiMessages: ApiChatMessage[] = history
        .filter((m) => m.status !== "error")
        .map((m) => ({ role: m.role, content: m.content }));

      void send(apiMessages, lang, {
        onUrgency: revealBanner,
        onFirstToken: () => {
          chatStore.update(assistantId, (m) => ({ ...m, status: "streaming", stage: 2 }));
        },
        onText: (text) => {
          chatStore.update(assistantId, (m) => ({ ...m, content: text }));
        },
        onDone: ({ text, followUps, followUpKind }) => {
          chatStore.update(assistantId, (m) => ({
            ...m,
            content: text || m.content,
            status: "done",
            followUps,
            followUpKind,
          }));
        },
        onAbort: (partial) => {
          chatStore.update(assistantId, (m) => ({
            ...m,
            content: partial || m.content,
            status: "done",
            stopped: true,
          }));
        },
        onError: (kind: ChatErrorKind) => {
          chatStore.update(assistantId, (m) => ({ ...m, status: "error", error: kind }));
        },
      });
    },
    [send, revealBanner, scrollToBottom],
  );

  const sendMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      const urgent = detectUrgency(trimmed);
      if (urgent) revealBanner();

      const userMessage: Message = {
        id: createId(),
        role: "user",
        content: trimmed,
        status: "done",
        createdAt: Date.now(),
        lang: language,
        ...(urgent ? { urgency: "high" as const } : {}),
      };

      const history = [...chatStore.getSnapshot(), userMessage];
      chatStore.set(() => history);
      scrollToBottom("smooth");
      runAssistantTurn(history, language);
    },
    [isStreaming, language, revealBanner, runAssistantTurn, scrollToBottom],
  );

  /** Retry: drop the trailing error bubble and re-run from the last user turn. */
  const retry = useCallback(() => {
    const snapshot = chatStore.getSnapshot();
    const last = snapshot[snapshot.length - 1];
    if (last?.status !== "error") return;
    const history = snapshot.slice(0, -1);
    chatStore.set(() => history);
    runAssistantTurn(history, language);
  }, [language, runAssistantTurn]);

  const newChat = useCallback(() => {
    stop();
    setShowBanner(false);
    chatStore.clear();
  }, [stop]);

  const onFeedback = useCallback((id: string, feedback: Feedback) => {
    chatStore.update(id, (m) => ({ ...m, feedback: m.feedback === feedback ? undefined : feedback }));
  }, []);

  const onLanguageChange = useCallback(
    (code: LanguageCode) => {
      if (code === language) return;
      setLanguage(code);
    },
    [language],
  );

  const isEmpty = messages.length === 0;

  return (
    <div
      ref={dockRef}
      className="flex flex-col"
      // Fill the viewport; lift content above the mobile keyboard when open.
      style={{ height: "100dvh", paddingBottom: "var(--keyboard-inset, 0px)" }}
    >
      <ChatHeader
        strings={strings}
        language={language}
        onLanguageChange={onLanguageChange}
        onNewChat={newChat}
        canClear={!isEmpty || isStreaming}
      />

      {!online && (
        <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-sm text-warning-ink">
          <WifiOff className="size-4" aria-hidden="true" />
          {strings.offlineNotice}
        </div>
      )}

      {/* Only this region scrolls. */}
      <main className="relative min-h-0 flex-1">
        <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
          <div className="mx-auto w-full max-w-[720px] px-4 py-4">
            {isEmpty ? (
              <EmptyState strings={strings} onSelect={sendMessage} />
            ) : (
              <>
                <p className="mx-auto mb-4 max-w-md text-center text-xs text-muted">{strings.systemNotice}</p>

                {showBanner && (
                  <div className="mb-4">
                    <EmergencyBanner strings={strings} onDismiss={dismissBanner} />
                  </div>
                )}

                <MessageList
                  messages={messages}
                  strings={strings}
                  onSend={sendMessage}
                  onRetry={retry}
                  onCancel={stop}
                  onFeedback={onFeedback}
                />
                <div className="h-2" />
              </>
            )}
          </div>
        </div>

        {showJumpButton && (
          <button
            type="button"
            onClick={() => scrollToBottom("smooth")}
            className="glass absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border px-3 py-2 text-sm font-medium text-foreground shadow-lift transition-colors hover:bg-surface-muted"
          >
            <ArrowDown className="size-4" aria-hidden="true" />
            {strings.jumpToLatest}
          </button>
        )}
      </main>

      <ChatInput
        strings={strings}
        language={LANGUAGES[language]}
        isStreaming={isStreaming}
        onSend={sendMessage}
        onStop={stop}
      />
    </div>
  );
}
