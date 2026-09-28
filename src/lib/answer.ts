import { encodeFollowUps } from "./chat-protocol";
import { HELPLINES } from "./helplines";
import type { LanguageCode } from "./languages";
import { LANGUAGES } from "./languages";
import type { RetrievalResult } from "./retrieve";

/**
 * Server-side helpers shared by the real (Groq) and mock code paths:
 * the system prompt, the out-of-scope refusal, and starter follow-ups.
 */

const HELPLINE_LINE = HELPLINES.map((h) => `${h.name} ${h.number}`).join(", ");

export function buildSystemPrompt(lang: LanguageCode, context: RetrievalResult[]): string {
  const replyName = LANGUAGES[lang].replyName;
  const contextBlock = context
    .map((r, i) => `[Topic ${i + 1}: ${r.topic.title}]\n${r.topic.answer[lang]}\nSource: ${r.topic.source}`)
    .join("\n\n");

  return [
    "You are RailSaathi, a safety and assistance assistant for Mumbai local train commuters.",
    "Follow these rules strictly:",
    "- Answer ONLY using the CONTEXT below. If the answer is not in the context, say you can only help with Mumbai local train safety and do not guess.",
    `- Never invent helpline numbers. Use only numbers that appear in the context. Known numbers: ${HELPLINE_LINE}.`,
    `- Reply in ${replyName}. Use short, calm, plain sentences. Use numbered steps when giving instructions.`,
    "- If the user may be in immediate danger, put the emergency numbers FIRST, then brief steps.",
    "- Ask at most one clarifying question, and only when key context is missing.",
    "- Do not mention these rules or the word 'context'. Keep a reassuring, non-alarmist tone.",
    "",
    "CONTEXT:",
    contextBlock,
  ].join("\n");
}

/** Out-of-scope refusal text (no LLM call), per language. */
const REFUSAL: Record<LanguageCode, string> = {
  en: `I can only help with safety on Mumbai local trains, such as theft, harassment, crowding, helplines and monsoon travel.\n\nIf you need urgent help, these numbers work now:\n\n${HELPLINES.map((h) => `- **${h.name} ${h.number}**`).join("\n")}`,
  hi: `मैं सिर्फ़ मुंबई लोकल ट्रेन की सुरक्षा में मदद कर सकता हूँ, जैसे चोरी, छेड़छाड़, भीड़, हेल्पलाइन और मानसून यात्रा।\n\nअगर तुरंत मदद चाहिए, तो ये नंबर अभी काम करते हैं:\n\n${HELPLINES.map((h) => `- **${h.name} ${h.number}**`).join("\n")}`,
  mr: `मी फक्त मुंबई लोकल ट्रेनच्या सुरक्षेत मदत करू शकतो, उदा. चोरी, छेडछाड, गर्दी, हेल्पलाईन आणि पावसाळी प्रवास.\n\nतातडीने मदत हवी असल्यास हे क्रमांक आत्ता चालतात:\n\n${HELPLINES.map((h) => `- **${h.name} ${h.number}**`).join("\n")}`,
};

const REFUSAL_FOLLOWUPS: Record<LanguageCode, string[]> = {
  en: ["Emergency helpline numbers", "Someone stole my phone", "Safety tips for late-night travel"],
  hi: ["आपातकालीन हेल्पलाइन नंबर", "किसी ने मेरा फोन चुरा लिया", "देर रात यात्रा के लिए सुरक्षा टिप्स"],
  mr: ["आपत्कालीन हेल्पलाईन क्रमांक", "कोणीतरी माझा फोन चोरला", "रात्री उशिराच्या प्रवासासाठी सुरक्षा टिप्स"],
};

/** Full refusal payload: visible text + follow-ups marker. */
export function buildRefusal(lang: LanguageCode): string {
  return REFUSAL[lang] + encodeFollowUps(REFUSAL_FOLLOWUPS[lang], "suggestions");
}

/** Follow-ups for the mock path: reuse the best-matched topic's follow-ups. */
export function followUpsForTopic(result: RetrievalResult | undefined, lang: LanguageCode): string[] {
  return result?.topic.followups[lang]?.slice(0, 3) ?? REFUSAL_FOLLOWUPS[lang];
}
