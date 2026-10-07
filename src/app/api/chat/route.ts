import { NextResponse } from "next/server";
import { z } from "zod";
import Groq from "groq-sdk";
import { buildSystemPrompt, defaultFollowUps, followUpsForTopic } from "@/lib/answer";
import { encodeFollowUps, encodeTrains, type TrainsPayload } from "@/lib/chat-protocol";
import { LANGUAGE_CODES, type LanguageCode } from "@/lib/languages";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";
import { retrieveTopics } from "@/lib/retrieve";
import { MAX_MESSAGE_CHARS } from "@/lib/site";
import { detectUrgency } from "@/lib/urgency";
import { nowInIST } from "@/lib/timetable/time";
import { runTool, TOOL_DEFINITIONS } from "@/lib/timetable/groq-tools";
import { getNextTrains, getTimetableInfo } from "@/lib/timetable/tools";
import { extractFromTo, isTrainQuery } from "@/lib/timetable/intent";
import type { NextTrainsResult } from "@/lib/timetable/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * POST /api/chat
 * Request:  { messages, lang }
 * Response: streamed text/plain, then optional "\n\n[[TRAINS]]{json}", then
 *           "\n\n[[FOLLOWUPS]][...]".  Header x-urgency: high on urgent input.
 *
 * Flow: (1) up to 3 non-streaming tool rounds (temp 0), executing tools
 * server-side; (2) a final streaming call (temp 0.2) with the tool results in
 * context. Retrieval is context-only; every reply is model-generated.
 */

// History can be long (assistant replies routinely exceed 500 chars), so the
// per-message bound is generous. The 500-char USER-input cap is enforced
// separately, on the latest user message only (see below).
const MAX_HISTORY_CHARS = 8000;

const RequestSchema = z.object({
  lang: z.enum(LANGUAGE_CODES),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_HISTORY_CHARS),
      }),
    )
    .min(1)
    .max(40),
});

const encoder = new TextEncoder();
const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL ?? "openai/gpt-oss-20b";
const MAX_TOOL_ROUNDS = 3;
// Budget for the non-streaming tool-calling phase before we give up on the LLM
// and use the instant local fallback. Keeps total response under the client's
// 30s timeout even when the model is slow.
const TOOL_PHASE_TIMEOUT_MS = 12_000;

type ChatMsg = Groq.Chat.Completions.ChatCompletionMessageParam;

export async function POST(req: Request) {
  const rate = checkRateLimit(clientKeyFromHeaders(req.headers));
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      { status: 429, headers: { "retry-after": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const { messages, lang } = parsed.data;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) return NextResponse.json({ error: "no_user_message" }, { status: 400 });

  // The 500-char limit applies to the user's NEW input only, not to prior
  // assistant replies in history (which are legitimately longer). Enforcing it
  // on every message was rejecting whole conversations with a 400.
  if (lastUser.content.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "message_too_long" }, { status: 400 });
  }

  const headers: Record<string, string> = {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store, no-transform",
    "x-accel-buffering": "no",
  };
  if (detectUrgency(lastUser.content)) headers["x-urgency"] = "high";

  const retrieved = retrieveTopics(lastUser.content, 3);
  const followUps = retrieved[0] ? followUpsForTopic(retrieved[0], lang) : defaultFollowUps(lang);

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return new Response(await localFallbackStream(lastUser.content, lang, followUps, req.signal), { headers });

  const now = nowInIST();
  const nowLine = `Current time in Mumbai: ${now.label}. Day type: ${now.dayType}.`;
  const system = buildSystemPrompt(lang, retrieved, nowLine);

  const conversation: ChatMsg[] = [
    { role: "system", content: system },
    ...messages.map((m) => ({ role: m.role, content: m.content }) as ChatMsg),
  ];

  const groq = new Groq({ apiKey });

  // Cap the (non-streaming) tool-calling phase. gpt-oss tool rounds can be slow;
  // if they blow past this, we abort the LLM and use the fast local fallback so
  // the user gets an answer well within the client's timeout.
  const toolAbort = new AbortController();
  const onReqAbort = () => toolAbort.abort();
  req.signal.addEventListener("abort", onReqAbort);
  const toolTimer = setTimeout(() => toolAbort.abort(new DOMException("tool_timeout", "TimeoutError")), TOOL_PHASE_TIMEOUT_MS);

  try {
    const { finalMessages, trains } = await runToolRounds(groq, conversation, toolAbort.signal);
    clearTimeout(toolTimer);
    const trainsPayload = trains ? await buildTrainsPayload(lastUser.content, trains) : null;
    const stream = await streamFinal(groq, finalMessages, followUps, trainsPayload, req.signal);
    return new Response(stream, { headers });
  } catch (error) {
    clearTimeout(toolTimer);
    if (req.signal.aborted) return new Response(new ReadableStream({ start: (c) => c.close() }), { headers });
    console.error("Chat pipeline failed:", error instanceof Error ? error.name : "unknown");
    // Automatic fallback: still answer schedule questions with (demo) train
    // data, and give a brief helpful note otherwise — never a dead end.
    return new Response(await localFallbackStream(lastUser.content, lang, followUps, req.signal), { headers });
  } finally {
    req.signal.removeEventListener("abort", onReqAbort);
  }
}

/**
 * Runs tool rounds until the model stops asking for tools (or the cap).
 * Returns the augmented message list for the final streaming call plus the
 * most recent get_next_trains result (for the [[TRAINS]] trailer).
 */
async function runToolRounds(
  groq: Groq,
  conversation: ChatMsg[],
  signal: AbortSignal,
): Promise<{ finalMessages: ChatMsg[]; trains: NextTrainsResult | null }> {
  const messages = [...conversation];
  let trains: NextTrainsResult | null = null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const completion = await createWithFallback(groq, {
      messages,
      tools: TOOL_DEFINITIONS,
      tool_choice: "auto",
      temperature: 0,
      max_completion_tokens: 900,
      signal,
    });

    const choice = completion.choices[0]?.message;
    if (!choice) break;
    const toolCalls = choice.tool_calls ?? [];

    // No tool calls → the model is ready to answer; stop the loop.
    if (toolCalls.length === 0) break;

    // Record the assistant's tool-call turn, then each tool result.
    messages.push({ role: "assistant", content: choice.content ?? "", tool_calls: toolCalls });
    for (const call of toolCalls) {
      const result = await runTool(call.function.name, call.function.arguments);
      if (result.trains) trains = result.trains;
      messages.push({ role: "tool", tool_call_id: call.id, content: result.content });
    }
  }

  return { finalMessages: messages, trains };
}

/** Final streaming answer with tool context already in `messages`. */
async function streamFinal(
  groq: Groq,
  messages: ChatMsg[],
  followUps: string[],
  trainsPayload: TrainsPayload | null,
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  const completion = await createWithFallback(groq, {
    messages,
    temperature: 0.2,
    max_completion_tokens: 800,
    stream: true,
    signal,
  });

  return new ReadableStream({
    async start(controller) {
      let emittedText = false;
      try {
        for await (const chunk of completion) {
          const token = chunk.choices[0]?.delta?.content;
          if (token) {
            emittedText = true;
            controller.enqueue(encoder.encode(token));
          }
        }
      } catch (error) {
        if (!(error instanceof Error && error.name === "APIUserAbortError")) {
          console.error("Final stream error:", error instanceof Error ? error.name : "unknown");
        }
      } finally {
        // If the model produced nothing (error before first token) but we DID
        // resolve trains, emit a short lead-in so the card isn't orphaned.
        if (!emittedText && trainsPayload) {
          controller.enqueue(encoder.encode("Here are the scheduled trains I found:"));
        }
        if (trainsPayload) controller.enqueue(encoder.encode(encodeTrains(trainsPayload)));
        controller.enqueue(encoder.encode(encodeFollowUps(followUps, "suggestions")));
        controller.close();
      }
    },
  });
}

/** Attach source/effective-date metadata to the trains result for the card. */
async function buildTrainsPayload(query: string, result: NextTrainsResult): Promise<TrainsPayload | null> {
  // Only surface the card when we actually have direct trains or interchanges.
  if (!result.covered) return null;
  if (result.direct && result.trains.length === 0) return null;

  const meta = await getTimetableInfo();
  const [from, to] = endpointsFromResult(result);
  return {
    from,
    to,
    effectiveFrom: meta.effective_from,
    sourceName: meta.source_name,
    syncedAt: meta.last_updated,
    result,
  };
}

function endpointsFromResult(result: NextTrainsResult): [string, string] {
  if (result.covered && result.direct && result.trains[0]) {
    return [result.trains[0].from_name, result.trains[0].to_name];
  }
  if (result.covered && !result.direct && result.interchange_options[0]) {
    const opt = result.interchange_options[0];
    return [opt.leg1[0]?.from_name ?? "", opt.leg2[0]?.to_name ?? ""];
  }
  return ["", ""];
}

// ---- Groq call with primary→fallback retry (typed overloads) ----
type CreateParams = {
  messages: ChatMsg[];
  tools?: Groq.Chat.Completions.ChatCompletionTool[];
  tool_choice?: "auto" | "none";
  temperature: number;
  max_completion_tokens: number;
  stream?: boolean;
  signal: AbortSignal;
};

async function createWithFallback(groq: Groq, params: CreateParams & { stream: true }): Promise<AsyncIterable<Groq.Chat.Completions.ChatCompletionChunk>>;
async function createWithFallback(groq: Groq, params: CreateParams): Promise<Groq.Chat.Completions.ChatCompletion>;
async function createWithFallback(groq: Groq, params: CreateParams): Promise<unknown> {
  const { signal, ...rest } = params;
  let lastError: unknown;
  for (const model of [MODEL, FALLBACK_MODEL]) {
    try {
      return await groq.chat.completions.create(
        {
          model,
          messages: rest.messages,
          temperature: rest.temperature,
          max_completion_tokens: rest.max_completion_tokens,
          ...(rest.tools ? { tools: rest.tools, tool_choice: rest.tool_choice } : {}),
          ...(rest.stream ? { stream: true } : {}),
        },
        { signal },
      );
    } catch (error) {
      if (signal.aborted) throw error;
      lastError = error;
    }
  }
  throw lastError;
}

// Non-schedule fallback note (used only when the LLM is unavailable AND the
// question isn't a train-times query).
const FALLBACK_NOTE: Record<LanguageCode, string> = {
  en: "I couldn't reach the assistant just now. For urgent help call **112** or **182**. Please try your question again in a moment.",
  hi: "मैं अभी सहायक तक नहीं पहुँच सका। तुरंत मदद के लिए **112** या **182** पर कॉल करें। कृपया थोड़ी देर में फिर पूछें।",
  mr: "मी आत्ता सहाय्यकापर्यंत पोहोचू शकलो नाही. तातडीच्या मदतीसाठी **112** किंवा **182** वर कॉल करा. कृपया थोड्या वेळाने पुन्हा विचारा.",
};

const SCHEDULE_LEAD: Record<LanguageCode, string> = {
  en: "Here are the next scheduled trains (sample data — please confirm on m-Indicator or the station indicator):",
  hi: "ये अगली निर्धारित ट्रेनें हैं (नमूना डेटा — कृपया m-Indicator या स्टेशन इंडिकेटर पर पुष्टि करें):",
  mr: "या पुढील नियोजित ट्रेन आहेत (नमुना डेटा — कृपया m-Indicator किंवा स्टेशन इंडिकेटरवर खात्री करा):",
};

/**
 * LLM-free fallback. If the message is a train-times query, runs the tools
 * locally (which auto-produce demo data) and streams a real answer + the
 * [[TRAINS]] card. Otherwise streams a short helpful note. Never a dead end.
 */
async function localFallbackStream(
  userText: string,
  lang: LanguageCode,
  followUps: string[],
  signal: AbortSignal,
): Promise<ReadableStream<Uint8Array>> {
  let trainsPayload: TrainsPayload | null = null;
  let lead = FALLBACK_NOTE[lang];

  if (isTrainQuery(userText)) {
    const pair = extractFromTo(userText);
    if (pair) {
      const result = await getNextTrains({ from: pair.from, to: pair.to, limit: 5 });
      trainsPayload = await buildTrainsPayload(userText, result);
      if (trainsPayload) lead = SCHEDULE_LEAD[lang];
    }
  }

  const words = lead.split(/(\s+)/);
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (signal.aborted) return controller.close();
      if (i < words.length) {
        controller.enqueue(encoder.encode(words[i]));
        i += 1;
        await delay(16);
        return;
      }
      if (trainsPayload) controller.enqueue(encoder.encode(encodeTrains(trainsPayload)));
      controller.enqueue(encoder.encode(encodeFollowUps(followUps, "suggestions")));
      controller.close();
    },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
