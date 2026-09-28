# RailSaathi

AI-assisted safety and assistance for Mumbai local train commuters. This repo
currently implements the **`/chat` assistant**: a multilingual (English /
हिन्दी / मराठी), streaming chat with typed and voice input, grounded in a small
verified knowledge base.

> ⚠️ All safety content and helpline numbers in `src/data/intents.json` and
> `src/lib/helplines.ts` are **draft placeholders** and must be verified against
> official RPF / GRP / Indian Railways sources before any real use.

## Running

```bash
npm install
npm run dev        # http://localhost:3000/chat
```

The chat works out of the box with **no API key** using a mock stream that reads
answers from the knowledge base. To use a real LLM, set:

```bash
# .env.local
GROQ_API_KEY=your_key_here
GROQ_MODEL=llama-3.3-70b-versatile   # optional; confirm the current model in the Groq console
```

- With `GROQ_API_KEY` set, on-topic questions are answered by Groq using the
  retrieved knowledge as context.
- Without it, the same questions stream the retrieved answer text word by word,
  so the whole UI is testable before keys are configured.

Useful scripts: `npm run build`, `npm run lint`.

## The `/api/chat` event protocol

`POST /api/chat`

```jsonc
// request body
{
  "lang": "en" | "hi" | "mr",
  "messages": [{ "role": "user" | "assistant", "content": "string (<=500 chars)" }]
}
```

Response: `text/plain; charset=utf-8`, streamed. The body is the answer text,
followed by a single marker line and a JSON array of follow-up questions:

```
<answer tokens streamed here...>

[[FOLLOWUPS]]["Question 1","Question 2","Question 3"]
```

- `[[FOLLOWUPS]]` — normal suggested follow-ups (rendered as small pill chips).
- `[[CHOICES]]` — used when the answer is a clarifying question; the client
  renders these as larger primary-outline choice buttons.

The client (`parseAssistantStream` in `src/lib/chat-protocol.ts`) strips the
marker from the visible text as it streams — including any partial marker at the
end of a chunk — and turns the array into chips once the stream completes.

Response headers:

| Header             | Meaning                                                        |
| ------------------ | -------------------------------------------------------------- |
| `x-urgency: high`  | Urgency keywords detected. The client shows `<EmergencyBanner />` immediately, independent of the model text. |

Status codes: `200` stream, `400` invalid body, `429` rate limited
(`retry-after` header, 20 requests/minute/IP, in-memory).

### Server request flow (`src/app/api/chat/route.ts`)

1. **Rate limit** per IP, then **validate** the body with Zod (Zod caps message
   length at 500).
2. **Retrieve** the top 3 topics with `src/lib/retrieve.ts` (a small TF-IDF /
   phrase-match ranker over `intents.json`; works for Latin and Devanagari).
3. **Out of scope** (best score `< RELEVANCE_THRESHOLD`) → stream a fixed
   refusal in the selected language plus the emergency numbers. **No LLM call.**
4. Otherwise, if `GROQ_API_KEY` is set → **Groq** streaming completion with a
   strict system prompt (answer only from context, never invent numbers, reply
   in the selected language, put emergency numbers first if in danger).
5. If no key (or Groq errors) → **mock** stream of the retrieved answer.
6. **Urgency** is detected by keywords (`src/lib/urgency.ts`) in all three
   languages and reported via the `x-urgency` header, independent of the model.

## Component tree

```
src/app/chat/page.tsx                server component → mounts ChatShell
└─ components/chat/ChatShell.tsx      client; owns state, streaming, scroll, layout
   ├─ ChatHeader                      logo, New chat, LanguageSelect, ThemeToggle, EmergencyButton
   ├─ EmergencyBanner                 urgency-only; tap-to-call helplines (LLM-independent)
   ├─ MessageList                     role="log" aria-live="polite"; time dividers; grouping
   │  ├─ MessageBubble (memo)         user / assistant / error variants
   │  │  ├─ RichText                  safe mini-markdown; tel: links for helpline numbers
   │  │  └─ ThinkingIndicator         pulsing dots + rotating status; slow → cancel
   │  └─ SuggestionChips              follow-ups (latest message only) / clarifying choices
   ├─ EmptyState                      welcome + 6 localised starter prompts
   └─ ChatInput                       auto-grow textarea, char counter, Enter/Shift+Enter
      └─ VoiceButton                  mic; listening pulse / disabled-when-unsupported
```

### Hooks (`src/hooks/`)

- `useChatStream` — `fetch` + `ReadableStream` + `AbortController`; batches UI
  updates with `requestAnimationFrame`; 30s timeout; typed error kinds; reads
  `x-urgency`.
- `useSpeechRecognition` — Web Speech API wrapper. Support is read via
  `useSyncExternalStore` (no hydration mismatch). `interimResults` stream into
  the textarea; language changes stop recognition so the caller can restart.
- `useAutoScroll` — sticky-to-bottom; exposes `showJumpButton` when the user
  scrolls up.
- `useVisualViewportInset` — sets `--keyboard-inset` so the input dock stays
  above the mobile on-screen keyboard.

### Shared lib (`src/lib/`)

`languages.ts` (en/hi/mr + speech locales), `i18n.ts` (all UI strings per
language), `chat-types.ts` (the `Message` type), `chat-protocol.ts` (stream
parsing), `chat-store.ts` (sessionStorage-backed conversation store read with
`useSyncExternalStore`), `preferences.ts` (language / theme / online), `cn.ts`,
`site.ts`, `helplines.ts`, `urgency.ts`, `retrieve.ts`, `answer.ts`,
`rate-limit.ts`.

## Design & accessibility

- Design tokens live in `src/app/globals.css` (Tailwind v4 CSS-first config),
  light + dark via a `.dark` class; theme is applied pre-paint by
  `ThemeScript` and persisted in `localStorage`.
- Fonts: Plus Jakarta Sans (display), Inter (body), JetBrains Mono
  (numbers/helplines), loaded with `next/font`.
- WCAG 2.2 AA: `role="log"`/`role="status"` live regions, keyboard support,
  visible focus rings, ≥44px touch targets, `prefers-reduced-motion` respected,
  icons always paired with text/labels, colour never the only signal.

## Notes / limitations

- Voice input needs a Chromium or Safari browser and, in most browsers, an
  internet connection; the mic auto-disables where the API is missing (Firefox).
  Typed input is always the primary path.
- The rate limiter is in-memory and per-instance — replace with a shared store
  before running multiple instances.
- The landing page and shared `<Navbar />` are intentionally out of scope for
  this task; `/` is a minimal placeholder that links into `/chat`.
```
