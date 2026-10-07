import { NextResponse } from "next/server";
import { z } from "zod";
import Groq from "groq-sdk";
import { LANGUAGE_CODES, LANGUAGES } from "@/lib/languages";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * POST /api/translate
 * Request:  { text: string, targetLang: "en"|"hi"|"mr" }
 * Response: { text: string }   (the translation)
 *
 * Translates one assistant reply into the target language. Temperature 0 to
 * keep it faithful. Numbers, phone numbers, station names, times and list
 * formatting are preserved verbatim (instructed in the prompt).
 */

const MAX_TRANSLATE_CHARS = 4000;

const RequestSchema = z.object({
  text: z.string().min(1).max(MAX_TRANSLATE_CHARS),
  targetLang: z.enum(LANGUAGE_CODES),
});

const MODEL = process.env.GROQ_MODEL ?? "openai/gpt-oss-120b";
const FALLBACK_MODEL = process.env.GROQ_FALLBACK_MODEL ?? "openai/gpt-oss-20b";

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
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { text, targetLang } = parsed.data;
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // No key: return the original so the UI degrades gracefully.
    return NextResponse.json({ text });
  }

  const system = [
    `Translate the user's message into ${LANGUAGES[targetLang].replyName}.`,
    "Rules:",
    "- Preserve ALL numbers, phone numbers (e.g. 112, 182, 139, 1512), times (e.g. 07:45), and platform numbers EXACTLY as written. Never translate or reformat them.",
    "- Keep station names recognisable: keep the English name and, for Hindi/Marathi, you may add the local script in parentheses, e.g. \"Dadar (दादर)\".",
    "- Preserve markdown formatting: **bold**, numbered lists and bullet points, and line breaks.",
    "- Output ONLY the translation, no preamble, no quotes, no notes.",
  ].join("\n");

  const groq = new Groq({ apiKey });

  for (const [index, model] of [MODEL, FALLBACK_MODEL].entries()) {
    try {
      const completion = await groq.chat.completions.create(
        {
          model,
          temperature: 0,
          max_completion_tokens: 1500,
          messages: [
            { role: "system", content: system },
            { role: "user", content: text },
          ],
        },
        { signal: req.signal },
      );
      const out = completion.choices[0]?.message?.content?.trim();
      if (out) return NextResponse.json({ text: out });
    } catch (error) {
      if (req.signal.aborted) return NextResponse.json({ text });
      console.error(`Translate failed (${index === 0 ? "primary" : "fallback"}):`, errorName(error));
    }
  }

  // Both models failed: return the original text unchanged.
  return NextResponse.json({ text });
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : "unknown";
}
