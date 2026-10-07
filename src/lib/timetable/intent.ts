/**
 * Lightweight, LLM-free detection of a "train times" query and its from/to
 * stations. Used by the API fallback path so schedule questions still get a
 * real train card when the LLM is unavailable (no key, error, or timeout).
 *
 * This is intentionally simple pattern matching in English/Hinglish/Hindi/
 * Marathi — the real routing still goes through the LLM when it is available.
 */
// No \b around Devanagari — JS word boundaries don't work with those scripts.
const TRAIN_HINTS =
  /(\btrain\b|\btrains\b|\blocal\b|\blocals\b|\blokal\b|ट्रेन|लोकल|गाडी|गाड्या|\bschedule\b|\btimetable\b|time\s*table|\bdeparture\b|\bkab\b|कब|कधी|केव्हा)/i;

const CONNECTOR = /(\bto\b|\bse\b|\bfor\b|ते|से|साठी|के\s*लिए)/i;

/** True if the message looks like it is asking about train timings/routes. */
export function isTrainQuery(text: string): boolean {
  const t = text.normalize("NFC");
  if (TRAIN_HINTS.test(t)) return true;
  // A "X to/se/ते Y" phrasing with a next/first/last cue also counts.
  return CONNECTOR.test(t) && /(\bnext\b|\blast\b|\bfirst\b|अगली|पहली|आखिरी|पुढची|शेवटची|कब|कधी)/i.test(t);
}

/**
 * Extract origin/destination from natural phrasing:
 * "next train from Dadar to Borivali", "Panvel se Kurla", "अंधेरी ते दादर".
 * Returns null if it can't find a clear pair.
 */
export function extractFromTo(text: string): { from: string; to: string } | null {
  const t = text.replace(/\s+/g, " ").trim();

  // "from X to Y"
  let m = /\bfrom\s+(.+?)\s+to\s+(.+?)[?.!]*$/i.exec(t);
  if (m) return clean(m[1], m[2]);

  // "X to Y" (no "from")
  m = /\b([\p{L}. ]+?)\s+to\s+(.+?)[?.!]*$/iu.exec(t);
  if (m) return clean(m[1], m[2]);

  // Hinglish "X se Y" (Roman script only — reliable).
  m = /\b([A-Za-z][A-Za-z. ]+?)\s+se\s+([A-Za-z][A-Za-z. ]+?)[?.!]*$/i.exec(t);
  if (m) return clean(m[1], m[2]);

  // Devanagari station extraction is unreliable here; let the note handle it
  // rather than risk passing wrong station names to the timetable.
  return null;
}

function clean(a: string, b: string): { from: string; to: string } | null {
  const strip = (s: string) =>
    s
      .replace(/\b(the|next|last|first|train|trains|local|locals|a|an|please|mujhe|me|kya|hai|batao)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
  const from = strip(a);
  const to = strip(b);
  if (!from || !to || from.length > 40 || to.length > 40) return null;
  return { from, to };
}
