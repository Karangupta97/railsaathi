import type { LanguageCode } from "./languages";
import type { TrainsPayload } from "./timetable/types";

export type { LanguageCode };
export type { TrainsPayload };

/** "notice" is a client-only system divider (e.g. "Language changed to हिन्दी"). */
export type ChatRole = "user" | "assistant" | "notice";

export type MessageStatus = "thinking" | "streaming" | "done" | "error";

export type ChatErrorKind = "offline" | "network" | "timeout" | "rate_limited" | "server";

/** "choices" = clarifying question answers, rendered as larger buttons. */
export type FollowUpKind = "suggestions" | "choices";

export type Feedback = "up" | "down";

export type Message = {
  id: string;
  role: ChatRole;
  /** Visible text (protocol markers already stripped). */
  content: string;
  status: MessageStatus;
  followUps?: string[];
  followUpKind?: FollowUpKind;
  /** Epoch ms. */
  createdAt: number;
  /** Language the message was written / answered in. */
  lang: LanguageCode;
  /** User messages: set when urgency keywords are detected (client or server). */
  urgency?: "high";
  /** Assistant: pipeline stage reached (0 understand, 1 retrieve, 2 answer). */
  stage?: 0 | 1 | 2;
  /** Assistant: user pressed Stop; `content` holds the partial answer. */
  stopped?: boolean;
  error?: ChatErrorKind;
  feedback?: Feedback;
  /** notice: which language the chat switched to (for the divider label). */
  noticeLang?: LanguageCode;
  /** Assistant: cached translations of `content`, keyed by language. */
  translations?: Partial<Record<LanguageCode, string>>;
  /** Assistant: which language is currently shown (undefined = original). */
  shownLang?: LanguageCode;
  /** Assistant: a translation request is in flight. */
  translating?: boolean;
  /** Assistant: structured train results from the [[TRAINS]] trailer. */
  trains?: TrainsPayload;
};

/** Shape sent to POST /api/chat. */
export type ApiChatMessage = { role: ChatRole; content: string };

export type ApiChatRequest = { messages: ApiChatMessage[]; lang: LanguageCode };

/** A saved conversation. */
export type Chat = {
  id: string;
  title: string;
  /** Language the chat is conducted in (loading a chat restores this). */
  lang: LanguageCode;
  createdAt: number;
  updatedAt: number;
  messages: Message[];
  /** True once the auto-title ran, so a user rename is never overwritten. */
  titleGenerated?: boolean;
};

/** Lightweight row for the sidebar list (no full message array). */
export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: number;
  /** Short snippet of the last message, for search and future previews. */
  preview: string;
};
