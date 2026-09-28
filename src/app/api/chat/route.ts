import { NextResponse } from "next/server";
import { z } from "zod";
import Groq from "groq-sdk";
import { buildRefusal, buildSystemPrompt, followUpsForTopic } from "@/lib/answer";
import { encodeFollowUps } from "@/lib/chat-protocol";
import { LANGUAGE_CODES } from "@/lib/languages";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";
import { RELEVANCE_THRESHOLD, retrieveTopics } from "@/lib/retrieve";
import { MAX_MESSAGE_CHARS } from "@/lib/site";
import { detectUrgency } from "@/lib/urgency";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * POST /api/chat
 * Request:  { messages: {role, content}[], lang: "en"|"hi"|"mr" }
 * Response: streamed text/plain. After the answer comes a marker line
 *           "\n\n[[FOLLOWUPS]]" or "\n\n[[CHOICES]]" + a JSON array.
 * Headers:  x-urgency: high  when urgency keywords match (LLM-independent).
 *
 * Three paths:
 *   1. Off-topic (low retrieval score) -> fixed refusal, no LLM call.
 *   2. GROQ_API_KEY set                -> Groq streaming completion.
 *   3. No key                          -> mock stream of the top topic text.
 */

const RequestSchema = z.object({
  lang: z.enum(LANGUAGE_CODES),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(MAX_MESSAGE_CHARS),
      }),
    )
    .min(1)
    .max(40),
});

const encoder = new TextEncoder();
const MODEL = process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile"; // confirm current model in the Groq console

export async function POST(req: Request) {
  // Rate limit first.
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
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { messages, lang } = parsed.data;
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "no_user_message" }, { status: 400 });
  }

  const urgency = detectUrgency(lastUser.content);
  const headers: Record<string, string> = {
    "content-type": "text/plain; charset=utf-8",
    "cache-control": "no-store, no-transform",
    "x-accel-buffering": "no", // disable proxy buffering so tokens flush promptly
  };
  if (urgency) headers["x-urgency"] = "high";

  const retrieved = retrieveTopics(lastUser.content, 3);
  const best = retrieved[0];

  // Path 1: out of scope. Skip the LLM entirely.
  if (!best || best.score < RELEVANCE_THRESHOLD) {
    return new Response(refusalStream(buildRefusal(lang)), { headers });
  }

  const followUps = followUpsForTopic(best, lang);
  const apiKey = process.env.GROQ_API_KEY;

  // Path 3: no key -> mock stream.
  if (!apiKey) {
    return new Response(mockStream(best.topic.answer[lang], followUps, req.signal), { headers });
  }

  // Path 2: Groq streaming.
  try {
    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create(
      {
        model: MODEL,
        stream: true,
        temperature: 0.3,
        max_completion_tokens: 700,
        messages: [
          { role: "system", content: buildSystemPrompt(lang, retrieved) },
          ...messages.map((m) => ({ role: m.role, content: m.content }) as const),
        ],
      },
      { signal: req.signal },
    );

    return new Response(groqStream(completion, followUps), headers ? { headers } : undefined);
  } catch (error) {
    console.error("Groq request failed:", error);
    // Fall back to the retrieved answer so the user still gets help.
    return new Response(mockStream(best.topic.answer[lang], followUps, req.signal), { headers });
  }
}

/** Emits fixed text in a few chunks (payload already contains the marker). */
function refusalStream(payload: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(payload));
      controller.close();
    },
  });
}

/** Streams answer text word by word with a small delay, then follow-ups. */
function mockStream(
  answer: string,
  followUps: string[],
  signal: AbortSignal,
): ReadableStream<Uint8Array> {
  const words = answer.split(/(\s+)/); // keep whitespace tokens to preserve formatting
  let i = 0;

  return new ReadableStream({
    async pull(controller) {
      if (signal.aborted) {
        controller.close();
        return;
      }
      if (i >= words.length) {
        controller.enqueue(encoder.encode(encodeFollowUps(followUps, "suggestions")));
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(words[i]));
      i += 1;
      await delay(22);
    },
    cancel() {
      /* client aborted: nothing to clean up */
    },
  });
}

type GroqStream = AsyncIterable<{ choices: Array<{ delta?: { content?: string | null } }> }>;

/** Pipes Groq deltas to the client, then appends the follow-ups marker. */
function groqStream(completion: GroqStream, followUps: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const token = chunk.choices[0]?.delta?.content;
          if (token) controller.enqueue(encoder.encode(token));
        }
        controller.enqueue(encoder.encode(encodeFollowUps(followUps, "suggestions")));
      } catch (error) {
        // Abort surfaces here; close cleanly and keep whatever streamed.
        if (!(error instanceof Error && error.name === "APIUserAbortError")) {
          console.error("Groq stream error:", error);
        }
      } finally {
        controller.close();
      }
    },
  });
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
