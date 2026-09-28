import type { ChatErrorKind, Message } from "./chat-types";
import { isLanguageCode } from "./languages";

/**
 * Module-level conversation store, persisted to sessionStorage.
 *
 * Read it with `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`:
 * the server snapshot is always empty, so there is no hydration mismatch, and
 * the saved conversation appears right after hydration.
 *
 * Updates replace only the changed message object, so memoised bubbles for
 * other messages skip re-rendering while one message streams.
 */
const STORAGE_KEY = "railsaathi:chat:v1";
const EMPTY: readonly Message[] = [];

let messages: readonly Message[] = EMPTY;
let loaded = false;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    messages = parsed.filter(isMessage).flatMap(reviveInterrupted);
  } catch {
    messages = EMPTY;
  }
  window.addEventListener("pagehide", persistNow);
}

/** A reload mid-answer leaves "thinking"/"streaming" rows behind; settle them. */
function reviveInterrupted(message: Message): Message[] {
  if (message.status !== "thinking" && message.status !== "streaming") return [message];
  if (!message.content) return [];
  return [{ ...message, status: "done", stopped: true }];
}

const ERROR_KINDS: readonly ChatErrorKind[] = ["offline", "network", "timeout", "rate_limited", "server"];

function isMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    (m.status === "thinking" || m.status === "streaming" || m.status === "done" || m.status === "error") &&
    typeof m.createdAt === "number" &&
    isLanguageCode(m.lang) &&
    (m.error === undefined || ERROR_KINDS.includes(m.error as ChatErrorKind)) &&
    (m.followUps === undefined || (Array.isArray(m.followUps) && m.followUps.every((f) => typeof f === "string")))
  );
}

function persistNow() {
  clearTimeout(persistTimer);
  persistTimer = undefined;
  try {
    if (messages.length === 0) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    // Storage full or disabled (private mode): the chat still works in memory.
  }
}

function schedulePersist() {
  if (persistTimer === undefined) persistTimer = setTimeout(persistNow, 300);
}

export const chatStore = {
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getSnapshot(): readonly Message[] {
    load();
    return messages;
  },
  getServerSnapshot(): readonly Message[] {
    return EMPTY;
  },
  set(updater: (prev: readonly Message[]) => readonly Message[]) {
    load();
    messages = updater(messages);
    schedulePersist();
    emit();
  },
  update(id: string, updater: (message: Message) => Message) {
    chatStore.set((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  },
  clear() {
    messages = EMPTY;
    persistNow();
    emit();
  },
};

export function createId(): string {
  // randomUUID is unavailable on plain-http LAN URLs (e.g. testing on a phone).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
