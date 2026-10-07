import type { Chat, ChatErrorKind, ChatSummary, Message } from "./chat-types";
import { DEFAULT_LANGUAGE, isLanguageCode, type LanguageCode } from "./languages";

/**
 * Conversation persistence.
 *
 * `ChatStore` is a small async repository interface so the storage backend can
 * be swapped (see `SupabaseChatStore` sketch at the bottom) without touching
 * the UI. The default `LocalChatStore` keeps everything in localStorage under
 * one key, on the user's device only.
 *
 * On top of the repository we expose a synchronous reactive layer
 * (`chatSession`) that the React tree reads via `useSyncExternalStore`: it
 * holds the in-memory list of summaries and the messages of the currently open
 * chat, so streaming updates one message without re-serialising on every token.
 */

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------
export interface ChatStore {
  list(): Promise<ChatSummary[]>;
  get(id: string): Promise<Chat | null>;
  create(): Promise<Chat>;
  save(chat: Chat): Promise<void>;
  rename(id: string, title: string): Promise<void>;
  remove(id: string): Promise<void>;
  clear(): Promise<void>;
}

const STORAGE_KEY = "railsaathi:chats:v1";
const MAX_CHATS = 100;
const PREVIEW_CHARS = 80;

// ---------------------------------------------------------------------------
// localStorage implementation
// ---------------------------------------------------------------------------
export class LocalChatStore implements ChatStore {
  /** True while storage is usable; flips to false on quota / private-mode errors. */
  available = true;

  private readAll(): Chat[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isChat).map(reviveChat);
    } catch {
      return [];
    }
  }

  private writeAll(chats: Chat[]): void {
    if (typeof window === "undefined") return;
    // Newest first, capped; oldest beyond the cap are dropped.
    const capped = [...chats].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_CHATS);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(capped));
      this.available = true;
    } catch {
      // Quota exceeded or storage disabled: keep working from memory.
      this.available = false;
    }
  }

  list(): Promise<ChatSummary[]> {
    const summaries = this.readAll()
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(toSummary);
    return Promise.resolve(summaries);
  }

  get(id: string): Promise<Chat | null> {
    return Promise.resolve(this.readAll().find((c) => c.id === id) ?? null);
  }

  create(): Promise<Chat> {
    // Not persisted until the first message is saved (avoids empty duplicates).
    const now = Date.now();
    return Promise.resolve({
      id: createId(),
      title: "",
      lang: DEFAULT_LANGUAGE,
      createdAt: now,
      updatedAt: now,
      messages: [],
    });
  }

  save(chat: Chat): Promise<void> {
    const chats = this.readAll();
    const index = chats.findIndex((c) => c.id === chat.id);
    if (index === -1) chats.push(chat);
    else chats[index] = chat;
    this.writeAll(chats);
    return Promise.resolve();
  }

  rename(id: string, title: string): Promise<void> {
    const chats = this.readAll();
    const chat = chats.find((c) => c.id === id);
    if (chat) {
      chat.title = title;
      chat.titleGenerated = true;
      chat.updatedAt = Date.now();
      this.writeAll(chats);
    }
    return Promise.resolve();
  }

  remove(id: string): Promise<void> {
    this.writeAll(this.readAll().filter((c) => c.id !== id));
    return Promise.resolve();
  }

  clear(): Promise<void> {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore.
      }
    }
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Validation / revival
// ---------------------------------------------------------------------------
const ERROR_KINDS: readonly ChatErrorKind[] = ["offline", "network", "timeout", "rate_limited", "server"];

function isMessage(value: unknown): value is Message {
  if (typeof value !== "object" || value === null) return false;
  const m = value as Record<string, unknown>;
  return (
    typeof m.id === "string" &&
    (m.role === "user" || m.role === "assistant" || m.role === "notice") &&
    typeof m.content === "string" &&
    (m.status === "thinking" || m.status === "streaming" || m.status === "done" || m.status === "error") &&
    typeof m.createdAt === "number" &&
    isLanguageCode(m.lang) &&
    (m.error === undefined || ERROR_KINDS.includes(m.error as ChatErrorKind)) &&
    (m.followUps === undefined || (Array.isArray(m.followUps) && m.followUps.every((f) => typeof f === "string")))
  );
}

function isChat(value: unknown): value is Chat {
  if (typeof value !== "object" || value === null) return false;
  const c = value as Record<string, unknown>;
  return (
    typeof c.id === "string" &&
    typeof c.title === "string" &&
    isLanguageCode(c.lang) &&
    typeof c.createdAt === "number" &&
    typeof c.updatedAt === "number" &&
    Array.isArray(c.messages)
  );
}

/** Sanitise a chat read from storage: keep valid, settled messages only. */
function reviveChat(chat: Chat): Chat {
  const messages = (chat.messages as unknown[])
    .filter(isMessage)
    .flatMap(reviveInterrupted);
  return { ...chat, messages };
}

/** A reload mid-answer leaves "thinking"/"streaming" rows; settle or drop them. */
function reviveInterrupted(message: Message): Message[] {
  if (message.status !== "thinking" && message.status !== "streaming") return [message];
  if (!message.content) return [];
  return [{ ...message, status: "done", stopped: true }];
}

function toSummary(chat: Chat): ChatSummary {
  const last = chat.messages[chat.messages.length - 1];
  return {
    id: chat.id,
    title: chat.title || untitled(chat),
    updatedAt: chat.updatedAt,
    preview: (last?.content ?? "").slice(0, PREVIEW_CHARS),
  };
}

function untitled(chat: Chat): string {
  const firstUser = chat.messages.find((m) => m.role === "user");
  return deriveTitle(firstUser?.content ?? "");
}

/** Auto-title from the first user message: trimmed to ~40 chars with ellipsis. */
export function deriveTitle(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return "";
  return clean.length > 40 ? `${clean.slice(0, 40).trimEnd()}…` : clean;
}

/** Should this message be persisted? Never store a live "thinking" row. */
export function persistableMessages(messages: readonly Message[]): Message[] {
  return messages
    .filter((m) => m.status !== "thinking")
    .map((m) => (m.status === "streaming" ? { ...m, status: "done" as const, stopped: true } : m));
}

// ---------------------------------------------------------------------------
// Reactive session layer (single active chat + list of summaries)
// ---------------------------------------------------------------------------
export const store: ChatStore & { available?: boolean } = new LocalChatStore();

type SessionState = {
  activeId: string | null;
  messages: readonly Message[];
  summaries: readonly ChatSummary[];
  storageAvailable: boolean;
};

const EMPTY_MESSAGES: readonly Message[] = [];
const EMPTY_SUMMARIES: readonly ChatSummary[] = [];

let state: SessionState = {
  activeId: null,
  messages: EMPTY_MESSAGES,
  summaries: EMPTY_SUMMARIES,
  storageAvailable: true,
};

const listeners = new Set<() => void>();
let persistTimer: ReturnType<typeof setTimeout> | undefined;
let listenersBound = false;

function emit() {
  for (const l of listeners) l();
}

function bindGlobalListeners() {
  if (listenersBound || typeof window === "undefined") return;
  listenersBound = true;
  // Persist promptly if the tab is hidden or closed mid-answer.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushPersist();
  });
  window.addEventListener("pagehide", flushPersist);
  // Multi-tab: another tab changed history → refresh the list.
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) void chatSession.refreshList();
  });
}

/** Write the active chat now (used by timers and lifecycle events). */
function flushPersist() {
  clearTimeout(persistTimer);
  persistTimer = undefined;
  const { activeId, messages } = state;
  if (!activeId) return;

  const persistable = persistableMessages(messages);
  // Don't persist an empty chat (keeps the sidebar free of blank entries).
  if (persistable.length === 0) return;

  void (async () => {
    const existing = await store.get(activeId);
    const firstUser = persistable.find((m) => m.role === "user");
    const now = Date.now();
    const chat: Chat = existing
      ? { ...existing, messages: persistable, updatedAt: now, lang: currentLang() }
      : {
          id: activeId,
          title: "",
          lang: currentLang(),
          createdAt: now,
          updatedAt: now,
          messages: persistable,
        };

    // Auto-title once, never overwriting a user rename.
    if (!chat.titleGenerated && firstUser) {
      chat.title = deriveTitle(firstUser.content);
      chat.titleGenerated = true;
    }

    await store.save(chat);
    setStorageAvailable((store as LocalChatStore).available ?? true);
    await chatSession.refreshList();
  })();
}

let langGetter: () => LanguageCode = () => DEFAULT_LANGUAGE;

function currentLang(): LanguageCode {
  return langGetter();
}

function setStorageAvailable(available: boolean) {
  if (state.storageAvailable !== available) {
    state = { ...state, storageAvailable: available };
    emit();
  }
}

function schedulePersist() {
  if (persistTimer === undefined) persistTimer = setTimeout(flushPersist, 300);
}

/**
 * The object the UI talks to. Message mutations are synchronous (in memory)
 * and debounced to storage; list/CRUD operations are async against the store.
 */
export const chatSession = {
  /** Provide a getter so the session can stamp each chat with the live language. */
  bindLanguageGetter(getter: () => LanguageCode) {
    langGetter = getter;
  },

  subscribe(listener: () => void): () => void {
    bindGlobalListeners();
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  getMessagesSnapshot(): readonly Message[] {
    return state.messages;
  },
  getSummariesSnapshot(): readonly ChatSummary[] {
    return state.summaries;
  },
  getStorageAvailableSnapshot(): boolean {
    return state.storageAvailable;
  },
  getActiveIdSnapshot(): string | null {
    return state.activeId;
  },
  getServerMessages(): readonly Message[] {
    return EMPTY_MESSAGES;
  },
  getServerSummaries(): readonly ChatSummary[] {
    return EMPTY_SUMMARIES;
  },
  getServerTrue(): boolean {
    return true;
  },

  async refreshList() {
    const summaries = await store.list();
    state = { ...state, summaries, storageAvailable: (store as LocalChatStore).available ?? true };
    emit();
  },

  /** Open an existing chat by id. Returns false if not found. */
  async open(id: string): Promise<boolean> {
    flushPersist(); // save whatever was open before switching
    const chat = await store.get(id);
    if (!chat) return false;
    state = { ...state, activeId: id, messages: chat.messages };
    emit();
    return true;
  },

  /** Start a brand-new empty chat with a known id (URL is /chat until first send). */
  startNew(id: string) {
    flushPersist();
    state = { ...state, activeId: id, messages: EMPTY_MESSAGES };
    emit();
  },

  /** Replace the active chat's messages (used by ChatShell for every update). */
  setMessages(updater: (prev: readonly Message[]) => readonly Message[]) {
    state = { ...state, messages: updater(state.messages) };
    schedulePersist();
    emit();
  },

  updateMessage(id: string, updater: (m: Message) => Message) {
    chatSession.setMessages((prev) => prev.map((m) => (m.id === id ? updater(m) : m)));
  },

  /** Persist immediately (e.g. on stream completion or abort). */
  commit() {
    flushPersist();
  },

  async rename(id: string, title: string) {
    await store.rename(id, title);
    await chatSession.refreshList();
  },

  async remove(id: string) {
    await store.remove(id);
    if (state.activeId === id) state = { ...state, activeId: null, messages: EMPTY_MESSAGES };
    await chatSession.refreshList();
  },

  async clearAll() {
    clearTimeout(persistTimer);
    persistTimer = undefined;
    await store.clear();
    state = { ...state, activeId: null, messages: EMPTY_MESSAGES };
    await chatSession.refreshList();
  },
};

export function createId(): string {
  // randomUUID is unavailable on plain-http LAN URLs (e.g. testing on a phone).
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/*
 * ---------------------------------------------------------------------------
 * Future backend swap. Implement the same interface and assign it to `store`:
 *
 *   class SupabaseChatStore implements ChatStore {
 *     async list()   { const { data } = await supabase.from("chats")
 *                        .select("id,title,updated_at,preview")
 *                        .order("updated_at", { ascending: false });
 *                      return (data ?? []).map(rowToSummary); }
 *     async get(id)  { ...select("*").eq("id", id).single()... }
 *     async create() { ...insert a row, return the Chat... }
 *     async save(c)  { ...upsert... }
 *     async rename() { ...update title... }
 *     async remove() { ...delete... }
 *     async clear()  { ...delete all for the current user... }
 *   }
 *
 * Then: export const store: ChatStore = new SupabaseChatStore();
 * The reactive layer and every component stay unchanged.
 * ---------------------------------------------------------------------------
 */