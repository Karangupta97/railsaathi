import type { DayType } from "./types";

/** "now" in Asia/Kolkata, without pulling in a date library. */
export function nowInIST(): { hhmm: string; minutes: number; dayType: DayType; label: string } {
  const now = new Date();
  // en-GB gives 24h HH:MM; the timeZone does the IST conversion.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).formatToParts(now);

  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hh = get("hour");
  const mm = get("minute");
  const weekday = get("weekday").toLowerCase();

  const hhmm = `${hh}:${mm}`;
  const minutes = Number(hh) * 60 + Number(mm);
  const dayType: DayType =
    weekday.startsWith("sun") ? "sunday_holiday" : weekday.startsWith("sat") ? "saturday" : "weekday";

  const label = `${hhmm} IST, ${get("weekday")} ${get("day")} ${get("month")}`;
  return { hhmm, minutes, dayType, label };
}

/** Parse "HH:MM" (with an optional day offset) into absolute minutes. */
export function toMinutes(hhmm: string, dayOffset = 0): number {
  const [h, m] = hhmm.split(":").map(Number);
  return dayOffset * 24 * 60 + (h ?? 0) * 60 + (m ?? 0);
}

/** Difference in minutes between two same-day-ish HH:MM values, handling wrap past midnight. */
export function durationMinutes(dep: string, depDay: number, arr: string, arrDay: number): number {
  return toMinutes(arr, arrDay) - toMinutes(dep, depDay);
}
