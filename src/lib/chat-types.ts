import type { LanguageCode } from "./languages";

export type ChatRole = "user" | "assistant";

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
};

/** Shape sent to POST /api/chat. */
export type ApiChatMessage = { role: ChatRole; content: string };

export type ApiChatRequest = { messages: ApiChatMessage[]; lang: LanguageCode };
