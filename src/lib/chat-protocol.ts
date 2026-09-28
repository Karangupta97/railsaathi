import type { FollowUpKind } from "./chat-types";

/**
 * Stream protocol for POST /api/chat (text/plain; charset=utf-8):
 *
 *   <answer tokens...>\n\n[[FOLLOWUPS]]["question 1","question 2"]
 *
 * `[[CHOICES]]` may replace `[[FOLLOWUPS]]` when the answer is a clarifying
 * question; the client renders those as larger choice buttons.
 * Response headers: `x-urgency: high` when urgency keywords matched.
 */
export const FOLLOWUPS_MARKER = "\n\n[[FOLLOWUPS]]";
export const CHOICES_MARKER = "\n\n[[CHOICES]]";

const MARKERS = [
  { marker: FOLLOWUPS_MARKER, kind: "suggestions" },
  { marker: CHOICES_MARKER, kind: "choices" },
] as const satisfies ReadonlyArray<{ marker: string; kind: FollowUpKind }>;

export type ParsedStream = {
  text: string;
  followUps: string[];
  followUpKind: FollowUpKind;
};

/**
 * Splits raw stream text into visible text and follow-ups.
 * While streaming (`final = false`) it also hides a trailing partial marker,
 * so users never see "[[FOLL" flash up at the end of an answer.
 */
export function parseAssistantStream(raw: string, final: boolean): ParsedStream {
  for (const { marker, kind } of MARKERS) {
    const index = raw.indexOf(marker);
    if (index === -1) continue;
    const text = raw.slice(0, index).trimEnd();
    const payload = raw.slice(index + marker.length);
    return { text, followUps: final ? parseFollowUps(payload) : [], followUpKind: kind };
  }

  let visible = raw;
  if (!final) {
    const cut = longestPartialMarkerSuffix(raw);
    if (cut > 0) visible = raw.slice(0, raw.length - cut);
  }
  return { text: final ? visible.trimEnd() : visible, followUps: [], followUpKind: "suggestions" };
}

function longestPartialMarkerSuffix(raw: string): number {
  let longest = 0;
  for (const { marker } of MARKERS) {
    const max = Math.min(marker.length - 1, raw.length);
    for (let len = max; len > longest; len--) {
      if (raw.endsWith(marker.slice(0, len))) {
        longest = len;
        break;
      }
    }
  }
  return longest;
}

function parseFollowUps(payload: string): string[] {
  try {
    const value: unknown = JSON.parse(payload.trim());
    if (!Array.isArray(value)) return [];
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item.length <= 120)
      .slice(0, 4);
  } catch {
    return [];
  }
}

/** Serialises follow-ups for the end of a stream (server side). */
export function encodeFollowUps(items: readonly string[], kind: FollowUpKind): string {
  const marker = kind === "choices" ? CHOICES_MARKER : FOLLOWUPS_MARKER;
  return `${marker}${JSON.stringify(items)}`;
}
