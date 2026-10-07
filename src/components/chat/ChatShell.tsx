"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, WifiOff } from "lucide-react";
import type { ApiChatMessage, ChatErrorKind, Feedback, Message } from "@/lib/chat-types";
import { chatSession, createId } from "@/lib/chat-store";
import { CHAT_STRINGS } from "@/lib/i18n";
import { LANGUAGES, type LanguageCode } from "@/lib/languages";
import { setLanguage, useLanguage, useOnline, useSidebarOpen, setSidebarOpen } from "@/lib/preferences";
import { detectUrgency } from "@/lib/urgency";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useChatStream } from "@/hooks/useChatStream";
import { useVisualViewportInset } from "@/hooks/useVisualViewport";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { ChatNotFound } from "./ChatNotFound";
import { ChatSidebar } from "./ChatSidebar";
import { EmergencyBanner } from "./EmergencyBanner";
import { EmptyState } from "./EmptyState";
import { MessageList } from "./MessageList";

/**
 * ChatShell owns the conversation state, streaming lifecycle, scroll behaviour
 * and page layout. Messages for the active chat come from the reactive
 * `chatSession` store (persisted per-conversation to localStorage); the sidebar
 * reads the list of conversations from the same store.
 *
 * `chatId` comes from the route:
 *  - undefined  → a fresh chat; the URL becomes /chat/[id] on the first send.
 *  - a string   → open that saved chat, or show "not found".
 */
/**
 * Translate a message's follow-up chips into `target` and write them back.
 * Best-effort: on any failure the original chips remain.
 */
async function translateFollowUps(messageId: string, chips: string[], target: LanguageCode) {
  try {
    const results = await Promise.all(
      chips.map(async (chip) => {
        const res = await fetch("/api/translate", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: chip, targetLang: target }),
        });
        const data: unknown = await res.json();
        return data && typeof data === "object" && typeof (data as { text?: unknown }).text === "string"
          ? (data as { text: string }).text
          : chip;
      }),
    );
    chatSession.updateMessage(messageId, (m) => ({ ...m, followUps: results }));
    chatSession.commit();
  } catch {
    // Keep the original chips.
  }
}

export function ChatShell({ chatId }: { chatId?: string }) {
  const router = useRouter();
  const language = useLanguage();
  const strings = CHAT_STRINGS[language];
  const online = useOnline();
  const sidebarOpen = useSidebarOpen();

  const messages = useSyncExternalStore(
    chatSession.subscribe,
    chatSession.getMessagesSnapshot,
    chatSession.getServerMessages,
  );

  const { send, stop, isStreaming } = useChatStream();
  const { scrollRef, showJumpButton, scrollToBottom, notifyContentChange } = useAutoScroll<HTMLDivElement>();
  const dockRef = useRef<HTMLDivElement>(null);
  useVisualViewportInset(dockRef);

  const [showBanner, setShowBanner] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // The id of the conversation currently loaded in the shell. It exists before
  // the URL does (a new chat gets an id immediately, URL updates on first send).
  // Kept as state so the sidebar's active highlight is reactive; a ref mirror
  // lets callbacks read the latest id without going stale.
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const applyActiveId = useCallback((id: string | null) => {
    activeIdRef.current = id;
    setActiveId(id);
  }, []);

  const revealBanner = useCallback(() => setShowBanner(true), []);
  const dismissBanner = useCallback(() => setShowBanner(false), []);

  // Let the store stamp each saved chat with the live language.
  useEffect(() => {
    chatSession.bindLanguageGetter(() => language);
  }, [language]);

  // Load / switch conversation when the route id changes. All state updates
  // happen inside the async task (a microtask later), so nothing is set
  // synchronously during the effect's render pass.
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      if (!chatId) {
        const id = createId();
        chatSession.startNew(id);
        if (cancelled) return;
        applyActiveId(id);
        setNotFound(false);
        setShowBanner(false);
        return;
      }

      if (chatId === activeIdRef.current) {
        if (cancelled) return;
        setNotFound(false);
        return;
      }

      const ok = await chatSession.open(chatId);
      if (cancelled) return;
      setShowBanner(false);
      if (ok) {
        applyActiveId(chatId);
        setNotFound(false);
        requestAnimationFrame(() => scrollToBottom("auto"));
      } else {
        setNotFound(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chatId, scrollToBottom, applyActiveId]);

  // Persist the open chat when leaving the page / switching.
  useEffect(() => () => chatSession.commit(), []);

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
      chatSession.setMessages((prev) => [...prev, assistant]);
      scrollToBottom("auto");

      const apiMessages: ApiChatMessage[] = history
        .filter(
          (m): m is Message & { role: "user" | "assistant" } =>
            m.role !== "notice" && m.status !== "error" && m.content.trim().length > 0,
        )
        .map((m) => ({ role: m.role, content: m.content }));

      void send(apiMessages, lang, {
        onUrgency: revealBanner,
        onFirstToken: () => {
          chatSession.updateMessage(assistantId, (m) => ({ ...m, status: "streaming", stage: 2 }));
        },
        onText: (text) => {
          chatSession.updateMessage(assistantId, (m) => ({ ...m, content: text }));
        },
        onDone: ({ text, followUps, followUpKind, trains }) => {
          chatSession.updateMessage(assistantId, (m) => ({
            ...m,
            content: text || m.content,
            status: "done",
            followUps,
            followUpKind,
            ...(trains ? { trains } : {}),
          }));
          chatSession.commit(); // save on completion
        },
        onAbort: (partial) => {
          chatSession.updateMessage(assistantId, (m) => ({
            ...m,
            content: partial || m.content,
            status: "done",
            stopped: true,
          }));
          chatSession.commit(); // save the partial answer
        },
        onError: (kind: ChatErrorKind) => {
          chatSession.updateMessage(assistantId, (m) => ({ ...m, status: "error", error: kind }));
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

      const history = [...chatSession.getMessagesSnapshot(), userMessage];
      chatSession.setMessages(() => history);
      chatSession.commit(); // persist immediately so the sidebar entry appears
      scrollToBottom("smooth");

      // Start streaming FIRST, so the request isn't disrupted by navigation.
      runAssistantTurn(history, language);

      // Reflect the chat id in the URL on the first message of a new
      // conversation. Use history.replaceState (not router.replace) so the App
      // Router does NOT re-run this component's load effect / tear down the
      // in-flight fetch — that race was aborting the stream (~46ms empty 200)
      // and leaving no assistant reply on screen.
      const id = activeIdRef.current;
      if (id && !chatId) window.history.replaceState(null, "", `/chat/${id}`);
    },
    [isStreaming, language, revealBanner, runAssistantTurn, scrollToBottom, chatId],
  );

  /** Retry: drop the trailing error bubble and re-run from the last user turn. */
  const retry = useCallback(() => {
    const snapshot = chatSession.getMessagesSnapshot();
    const last = snapshot[snapshot.length - 1];
    if (last?.status !== "error") return;
    const history = snapshot.slice(0, -1);
    chatSession.setMessages(() => history);
    runAssistantTurn(history, language);
  }, [language, runAssistantTurn]);

  const newChat = useCallback(() => {
    stop(); // abort any in-flight request; partial answer is kept + saved
    chatSession.commit();
    setShowBanner(false);
    setDrawerOpen(false);
    if (chatId) router.push("/chat", { scroll: false });
    else {
      const id = createId();
      applyActiveId(id);
      chatSession.startNew(id);
    }
  }, [stop, chatId, router, applyActiveId]);

  const openChat = useCallback(
    (id: string) => {
      if (id === activeIdRef.current) {
        setDrawerOpen(false);
        return;
      }
      stop(); // switching aborts the previous stream; its partial is committed
      chatSession.commit();
      setDrawerOpen(false);
      router.push(`/chat/${id}`, { scroll: false });
    },
    [stop, router],
  );

  // A loaded chat carries its own language; sync the selector to it once, when
  // a different conversation becomes active (not on every message change).
  const syncedLangForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeId || syncedLangForRef.current === activeId) return;
    const first = chatSession.getMessagesSnapshot()[0];
    if (first) {
      syncedLangForRef.current = activeId;
      setLanguage(first.lang);
    }
  }, [activeId]);

  const onFeedback = useCallback((id: string, feedback: Feedback) => {
    chatSession.updateMessage(id, (m) => ({ ...m, feedback: m.feedback === feedback ? undefined : feedback }));
    chatSession.commit();
  }, []);

  /**
   * Translate one assistant reply into the current language (cached per
   * message; toggles back to the original). Numbers/phones/times are preserved
   * server-side. If already showing a translation, this reverts to the original.
   */
  const onTranslate = useCallback(
    (id: string) => {
      const target = language;
      const msg = chatSession.getMessagesSnapshot().find((m) => m.id === id);
      if (!msg) return;

      // Toggle back to original.
      if (msg.shownLang && msg.shownLang !== msg.lang) {
        chatSession.updateMessage(id, (m) => ({ ...m, shownLang: undefined }));
        chatSession.commit();
        return;
      }
      // Same language as the reply — nothing to translate.
      if (target === msg.lang) return;
      // Cached already.
      if (msg.translations?.[target]) {
        chatSession.updateMessage(id, (m) => ({ ...m, shownLang: target }));
        chatSession.commit();
        return;
      }

      chatSession.updateMessage(id, (m) => ({ ...m, translating: true }));
      void (async () => {
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ text: msg.content, targetLang: target }),
          });
          const data: unknown = await res.json();
          const translated =
            data && typeof data === "object" && typeof (data as { text?: unknown }).text === "string"
              ? (data as { text: string }).text
              : msg.content;
          chatSession.updateMessage(id, (m) => ({
            ...m,
            translating: false,
            translations: { ...m.translations, [target]: translated },
            shownLang: target,
          }));
        } catch {
          chatSession.updateMessage(id, (m) => ({ ...m, translating: false }));
        } finally {
          chatSession.commit();
        }
      })();
    },
    [language],
  );

  // On language change mid-chat: drop a "Language changed to X" divider and
  // re-translate the latest assistant message's follow-up chips. The active
  // stream (if any) is NOT aborted; the new language applies from the next turn.
  const prevLangRef = useRef(language);
  useEffect(() => {
    const prev = prevLangRef.current;
    if (prev === language) return;
    prevLangRef.current = language;

    const snapshot = chatSession.getMessagesSnapshot();
    if (snapshot.length === 0) return; // no divider on an empty chat

    // Avoid stacking dividers if the last item is already a notice.
    const last = snapshot[snapshot.length - 1];
    if (last?.role !== "notice") {
      const notice: Message = {
        id: createId(),
        role: "notice",
        content: "",
        status: "done",
        createdAt: Date.now(),
        lang: language,
        noticeLang: language,
      };
      chatSession.setMessages((prevMsgs) => [...prevMsgs, notice]);
    }

    // Re-translate the latest assistant message's follow-up chips.
    const lastAssistant = [...snapshot].reverse().find((m) => m.role === "assistant" && m.status === "done");
    if (lastAssistant?.followUps?.length) {
      void translateFollowUps(lastAssistant.id, lastAssistant.followUps, language);
    }
    chatSession.commit();
  }, [language]);

  const onLanguageChange = useCallback(
    (code: LanguageCode) => {
      if (code === language) return;
      setLanguage(code);
    },
    [language],
  );

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-dvh overflow-hidden">
      {/* Desktop inline sidebar (collapsible). */}
      {sidebarOpen && (
        <aside className="hidden w-[280px] shrink-0 border-r border-border lg:block">
          <ChatSidebar
            strings={strings}
            activeId={activeId}
            onOpenChat={openChat}
            onNewChat={newChat}
            onCollapse={() => setSidebarOpen(false)}
          />
        </aside>
      )}

      {/* Mobile drawer. */}
      {drawerOpen && (
        <ChatSidebar
          strings={strings}
          activeId={activeId}
          onOpenChat={openChat}
          onNewChat={newChat}
          asDrawer
          onCloseDrawer={() => setDrawerOpen(false)}
        />
      )}

      <div
        ref={dockRef}
        className="flex min-w-0 flex-1 flex-col"
        style={{ paddingBottom: "var(--keyboard-inset, 0px)" }}
      >
        <ChatHeader
          strings={strings}
          language={language}
          onLanguageChange={onLanguageChange}
          onNewChat={newChat}
          canClear={!isEmpty || isStreaming}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onOpenDrawer={() => setDrawerOpen(true)}
        />

        {!online && (
          <div className="flex items-center justify-center gap-2 bg-warning/15 px-4 py-1.5 text-sm text-warning-ink">
            <WifiOff className="size-4" aria-hidden="true" />
            {strings.offlineNotice}
          </div>
        )}

        <main className="relative min-h-0 flex-1">
          {notFound ? (
            <ChatNotFound strings={strings} onNewChat={newChat} />
          ) : (
            <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
              <div className="mx-auto w-full max-w-[768px] px-4 py-4">
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
                      currentLang={language}
                      onSend={sendMessage}
                      onRetry={retry}
                      onCancel={stop}
                      onFeedback={onFeedback}
                      onTranslate={onTranslate}
                    />
                    <div className="h-2" />
                  </>
                )}
              </div>
            </div>
          )}

          {showJumpButton && !notFound && (
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

        {!notFound && (
          <ChatInput
            strings={strings}
            language={LANGUAGES[language]}
            isStreaming={isStreaming}
            onSend={sendMessage}
            onStop={stop}
          />
        )}
      </div>
    </div>
  );
}
