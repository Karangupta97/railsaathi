"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseAssistantStream } from "@/lib/chat-protocol";
import type { ApiChatMessage, ChatErrorKind } from "@/lib/chat-types";
import type { LanguageCode } from "@/lib/languages";

/**
 * Owns the network side of a single assistant turn:
 *  - POSTs to /api/chat with an AbortController,
 *  - reads the ReadableStream, decoding UTF-8 incrementally,
 *  - batches UI updates with requestAnimationFrame (one paint per frame, not
 *    one per token) so long answers stay at 60fps,
 *  - strips the [[FOLLOWUPS]]/[[CHOICES]] marker before showing text,
 *  - reports urgency from the x-urgency header immediately.
 *
 * The hook is deliberately UI-agnostic: callbacks let ChatShell decide how to
 * store partial text, final text, follow-ups and errors.
 */
export type StreamCallbacks = {
  onUrgency: () => void;
  onFirstToken: () => void;
  onText: (text: string) => void;
  onDone: (result: { text: string; followUps: string[]; followUpKind: "suggestions" | "choices" }) => void;
  onError: (kind: ChatErrorKind) => void;
  onAbort: (partialText: string) => void;
};

const TIMEOUT_MS = 30_000;

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    controllerRef.current?.abort();
  }, []);

  const send = useCallback(
    async (messages: ApiChatMessage[], lang: LanguageCode, cb: StreamCallbacks) => {
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsStreaming(true);

      // Guard against a stalled connection; the abort reason distinguishes it.
      const timeout = setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), TIMEOUT_MS);

      let raw = "";
      let sawFirstToken = false;
      let frame = 0;

      // Coalesce paints: schedule at most one flush per animation frame.
      const flush = () => {
        frame = 0;
        cb.onText(parseAssistantStream(raw, false).text);
      };
      const scheduleFlush = () => {
        if (frame === 0) frame = requestAnimationFrame(flush);
      };
      const cancelFlush = () => {
        if (frame !== 0) {
          cancelAnimationFrame(frame);
          frame = 0;
        }
      };

      try {
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          throw new DOMException("offline", "OfflineError");
        }

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages, lang }),
          signal: controller.signal,
        });

        if (res.headers.get("x-urgency") === "high") cb.onUrgency();

        if (res.status === 429) throw new HttpError("rate_limited");
        if (!res.ok || !res.body) throw new HttpError("server");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          raw += decoder.decode(value, { stream: true });
          if (!sawFirstToken && parseAssistantStream(raw, false).text.length > 0) {
            sawFirstToken = true;
            cb.onFirstToken();
          }
          scheduleFlush();
        }
        raw += decoder.decode();

        cancelFlush();
        const final = parseAssistantStream(raw, true);
        cb.onDone(final);
      } catch (error) {
        cancelFlush();
        if (isAbort(error)) {
          if (isTimeout(error)) {
            cb.onError("timeout");
          } else {
            // User pressed Stop: keep the partial text.
            cb.onAbort(parseAssistantStream(raw, true).text);
          }
        } else if (error instanceof HttpError) {
          cb.onError(error.kind);
        } else if (isOffline(error) || (typeof navigator !== "undefined" && !navigator.onLine)) {
          cb.onError("offline");
        } else {
          cb.onError("network");
        }
      } finally {
        clearTimeout(timeout);
        controllerRef.current = null;
        setIsStreaming(false);
      }
    },
    [],
  );

  // Abort an in-flight request if the component unmounts.
  useEffect(() => () => controllerRef.current?.abort(), []);

  return { send, stop, isStreaming };
}

class HttpError extends Error {
  constructor(readonly kind: ChatErrorKind) {
    super(kind);
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError");
}
function isTimeout(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}
function isOffline(error: unknown): boolean {
  return error instanceof DOMException && error.name === "OfflineError";
}
