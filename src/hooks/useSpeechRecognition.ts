"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Language } from "@/lib/languages";

/**
 * Web Speech API wrapper for multilingual dictation.
 *
 * - Feature detection runs in useEffect only, so SSR and the first client
 *   render agree (no hydration mismatch); `status` starts as "idle".
 * - Interim results stream into `interimTranscript`; the final chunk is handed
 *   to `onFinalTranscript` so the caller can append it to the textarea. We
 *   never auto-send.
 * - Changing language while listening stops and lets the caller restart with
 *   the new locale.
 */
export type SpeechStatus = "idle" | "unsupported" | "requesting" | "listening" | "error";

export type SpeechErrorKind = "permission" | "no-speech" | "no-mic" | "network" | "language" | "unknown";

type Options = {
  language: Language;
  /** Called with each finalised transcript segment. */
  onFinalTranscript: (text: string) => void;
};

export function useSpeechRecognition({ language, onFinalTranscript }: Options) {
  // Support is read via useSyncExternalStore: the server snapshot is `true`
  // (so the mic renders enabled and hydration output matches), then the client
  // snapshot corrects to the real value with no setState-in-effect.
  const supported = useSyncExternalStore(noopSubscribe, getSpeechSupported, () => true);

  const [status, setStatus] = useState<SpeechStatus>("idle");
  const [errorKind, setErrorKind] = useState<SpeechErrorKind | null>(null);
  const [interimTranscript, setInterimTranscript] = useState("");

  const recognitionRef = useRef<SpeechRecognition | null>(null);
  // Latest callback without forcing recognition to restart when it changes.
  const onFinalRef = useRef(onFinalTranscript);
  useEffect(() => {
    onFinalRef.current = onFinalTranscript;
  }, [onFinalTranscript]);
  // User-initiated stop shouldn't surface as an error.
  const manualStopRef = useRef(false);

  const stop = useCallback(() => {
    manualStopRef.current = true;
    recognitionRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    // Restart cleanly if something is already running.
    recognitionRef.current?.abort();

    const recognition = new Ctor();
    recognition.lang = language.speechLang;
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setStatus("listening");
      setErrorKind(null);
      setInterimTranscript("");
    };

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]!;
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) {
          const trimmed = transcript.trim();
          if (trimmed) onFinalRef.current(trimmed);
        } else {
          interim += transcript;
        }
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      setInterimTranscript("");
      if (event.error === "aborted" || manualStopRef.current) return;
      setStatus("error");
      setErrorKind(mapError(event.error));
    };

    recognition.onend = () => {
      setInterimTranscript("");
      recognitionRef.current = null;
      // Only reset to idle if we didn't land on an error.
      setStatus((prev) => (prev === "error" ? prev : "idle"));
    };

    recognitionRef.current = recognition;
    manualStopRef.current = false;
    setErrorKind(null);
    setStatus("requesting");
    try {
      recognition.start();
    } catch {
      // start() throws if called twice in quick succession; ignore.
    }
  }, [language]);

  const toggle = useCallback(() => {
    if (status === "listening" || status === "requesting") stop();
    else start();
  }, [status, start, stop]);

  // Stop when the language changes mid-session; the caller can restart.
  const languageCode = language.code;
  useEffect(() => {
    if (recognitionRef.current) {
      manualStopRef.current = true;
      recognitionRef.current.abort();
    }
  }, [languageCode]);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      recognitionRef.current?.abort();
    };
  }, []);

  // `supported` (from the external store) overrides the internal status so the
  // button renders disabled in browsers without the API.
  const publicStatus: SpeechStatus = supported ? status : "unsupported";
  const isActive = publicStatus === "listening" || publicStatus === "requesting";

  return {
    status: publicStatus,
    errorKind,
    interimTranscript,
    isSupported: supported,
    isActive,
    start,
    stop,
    toggle,
  };
}

function noopSubscribe(): () => void {
  return () => {};
}

function getSpeechSupported(): boolean {
  return typeof window !== "undefined" && Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

function mapError(code: SpeechRecognitionErrorCode): SpeechErrorKind {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "permission";
    case "no-speech":
      return "no-speech";
    case "audio-capture":
      return "no-mic";
    case "network":
      return "network";
    case "language-not-supported":
      return "language";
    default:
      return "unknown";
  }
}
