import type { ChatSummary } from "./chat-types";

/** Buckets used to group the history list, in display order. */
export type DateGroupKey = "today" | "yesterday" | "previous7" | "older";

export type DateGroup = { key: DateGroupKey; items: ChatSummary[] };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Start-of-day timestamp for the given time (local time). */
function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function classify(updatedAt: number, now: number): DateGroupKey {
  const today = startOfDay(now);
  if (updatedAt >= today) return "today";
  if (updatedAt >= today - DAY_MS) return "yesterday";
  if (updatedAt >= today - 7 * DAY_MS) return "previous7";
  return "older";
}

const ORDER: DateGroupKey[] = ["today", "yesterday", "previous7", "older"];

/**
 * Groups summaries (assumed already sorted newest-first) into date buckets.
 * Empty buckets are omitted.
 */
export function groupByDate(summaries: readonly ChatSummary[], now = Date.now()): DateGroup[] {
  const buckets = new Map<DateGroupKey, ChatSummary[]>();
  for (const summary of summaries) {
    const key = classify(summary.updatedAt, now);
    const list = buckets.get(key);
    if (list) list.push(summary);
    else buckets.set(key, [summary]);
  }
  return ORDER.filter((key) => buckets.has(key)).map((key) => ({ key, items: buckets.get(key)! }));
}
