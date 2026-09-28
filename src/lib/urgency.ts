/**
 * Keyword-based urgency detection (English, Hindi, Marathi).
 *
 * Runs on the client (so the emergency banner appears instantly, even
 * offline) and on the server (sets the `x-urgency: high` response header).
 * It is deliberately independent of the LLM. False positives only surface
 * helpline numbers, so the list leans towards recall.
 */

/** English terms, matched on word boundaries. */
const EN_TERMS = [
  "help",
  "help me",
  "save me",
  "sos",
  "bleeding",
  "blood",
  "molest",
  "molested",
  "molesting",
  "groped",
  "groping",
  "assault",
  "assaulted",
  "rape",
  "attack",
  "attacked",
  "knife",
  "weapon",
  "fell",
  "fallen off",
  "unconscious",
  "fainted",
  "not breathing",
  "injured",
  "kidnap",
  "following me",
  "stalking me",
  "danger",
  "fire",
];

/** Hindi and Marathi terms, matched as substrings (they inflect with suffixes). */
const DEVANAGARI_TERMS = [
  // Hindi
  "मदद",
  "बचाओ",
  "बचाइए",
  "छेड़छाड़",
  "छेड़",
  "खून",
  "गिर गया",
  "गिर गई",
  "गिर गयी",
  "बेहोश",
  "हमला",
  "चाकू",
  "घायल",
  "खतरा",
  "खतरे",
  "आग लग",
  "पीछा कर",
  // Marathi
  "मदत",
  "वाचवा",
  "छेडछाड",
  "रक्त",
  "पडला",
  "पडली",
  "बेशुद्ध",
  "हल्ला",
  "जखमी",
  "धोका",
  "पाठलाग",
].map((t) => t.normalize("NFC"));

const EN_PATTERN = new RegExp(`\\b(?:${EN_TERMS.map(escapeRegExp).join("|")})\\b`, "i");

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function detectUrgency(text: string): boolean {
  const normalised = text.normalize("NFC");
  if (EN_PATTERN.test(normalised)) return true;
  return DEVANAGARI_TERMS.some((term) => normalised.includes(term));
}
