import type { FollowUpKind } from "./chat-types";
import type { TrainsPayload } from "./timetable/types";

export type { TrainsPayload };

/**
 * Stream protocol for POST /api/chat (text/plain; charset=utf-8):
 *
 *   <answer tokens...>
 *   \n\n[[TRAINS]]{json}          (optional, only for schedule answers)
 *   \n\n[[FOLLOWUPS]]["q1","q2"]  (or [[CHOICES]] for clarifying questions)
 *
 * The [[TRAINS]] block, when present, always precedes the follow-ups block.
 * Response headers: `x-urgency: high` when urgency keywords matched.
 */
export const FOLLOWUPS_MARKER = "\n\n[[FOLLOWUPS]]";
export const CHOICES_MARKER = "\n\n[[CHOICES]]";
export const TRAINS_MARKER = "\n\n[[TRAINS]]";

const FOLLOWUP_MARKERS = [
  { marker: FOLLOWUPS_MARKER, kind: "suggestions" },
  { marker: CHOICES_MARKER, kind: "choices" },
] as const satisfies ReadonlyArray<{ marker: string; kind: FollowUpKind }>;

const ALL_MARKERS = [TRAINS_MARKER, FOLLOWUPS_MARKER, CHOICES_MARKER];

export type ParsedStream = {
  text: string;
  followUps: string[];
  followUpKind: FollowUpKind;
  trains: TrainsPayload | null;
};

/**
 * Splits raw stream text into visible text, an optional trains block and
 * follow-ups. While streaming (`final = false`) any trailing partial marker is
 * hidden so users never see "[[TRAI" flash at the end of an answer.
 */
export function parseAssistantStream(raw: string, final: boolean): ParsedStream {
  // The visible answer is everything before the FIRST trailer marker.
  const firstMarkerIndex = earliestMarkerIndex(raw);

  let text: string;
  if (firstMarkerIndex === -1) {
    text = raw;
    if (!final) {
      const cut = longestPartialMarkerSuffix(raw);
      if (cut > 0) text = raw.slice(0, raw.length - cut);
    }
    return { text: final ? text.trimEnd() : text, followUps: [], followUpKind: "suggestions", trains: null };
  }

  text = raw.slice(0, firstMarkerIndex).trimEnd();
  if (!final) {
    // Don't render trailer blocks until the stream completes.
    return { text, followUps: [], followUpKind: "suggestions", trains: null };
  }

  const trains = extractTrains(raw);
  const { followUps, followUpKind } = extractFollowUps(raw);
  return { text, followUps, followUpKind, trains };
}

function earliestMarkerIndex(raw: string): number {
  let earliest = -1;
  for (const marker of ALL_MARKERS) {
    const i = raw.indexOf(marker);
    if (i !== -1 && (earliest === -1 || i < earliest)) earliest = i;
  }
  return earliest;
}

function longestPartialMarkerSuffix(raw: string): number {
  let longest = 0;
  for (const marker of ALL_MARKERS) {
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

function extractTrains(raw: string): TrainsPayload | null {
  const start = raw.indexOf(TRAINS_MARKER);
  if (start === -1) return null;
  const payloadStart = start + TRAINS_MARKER.length;
  // The trains JSON runs until the follow-ups marker (or end of string).
  const fuIndex = nextFollowUpIndex(raw, payloadStart);
  const json = raw.slice(payloadStart, fuIndex === -1 ? undefined : fuIndex);
  try {
    const value: unknown = JSON.parse(json.trim());
    if (value && typeof value === "object" && "result" in value) return value as TrainsPayload;
    return null;
  } catch {
    return null;
  }
}

function nextFollowUpIndex(raw: string, from: number): number {
  const a = raw.indexOf(FOLLOWUPS_MARKER, from);
  const b = raw.indexOf(CHOICES_MARKER, from);
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}

function extractFollowUps(raw: string): { followUps: string[]; followUpKind: FollowUpKind } {
  for (const { marker, kind } of FOLLOWUP_MARKERS) {
    const index = raw.indexOf(marker);
    if (index === -1) continue;
    return { followUps: parseFollowUps(raw.slice(index + marker.length)), followUpKind: kind };
  }
  return { followUps: [], followUpKind: "suggestions" };
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

/** Serialises the trains block (server side). Emitted before follow-ups. */
export function encodeTrains(payload: TrainsPayload): string {
  return `${TRAINS_MARKER}${JSON.stringify(payload)}`;
}
