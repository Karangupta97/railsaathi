import { nowInIST } from "./time";
import { timetableStore } from "./store";
import type { NextTrainsResult, ServiceType, TrainResult } from "./types";

/**
 * Demo timetable fallback.
 *
 * The real dataset (src/data/timetable.json) only covers a few stations until a
 * full RailRadar sync runs. So that the schedule feature is demonstrable for
 * ANY station pair, this generates plausible SAMPLE trains at a fixed cadence.
 *
 * These are NOT real timings — the train names are suffixed "(DEMO)" and the
 * TrainResultCard footnote says "Scheduled … check the station indicator".
 */

/**
 * Should the demo fallback be used? Automatic by default — you do NOT need to
 * set anything.
 *
 *   TIMETABLE_DEMO unset (default) → AUTO: demo only while the dataset is still
 *     the sample seed (no real sync yet). Once you run `npm run sync-timetable`,
 *     real data is detected and uncovered routes get honest answers.
 *   TIMETABLE_DEMO=on   → always allow the demo fallback.
 *   TIMETABLE_DEMO=off  → never; uncovered routes say "I don't have that timetable".
 */
export async function isDemoEnabled(): Promise<boolean> {
  const flag = process.env.TIMETABLE_DEMO?.toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  // AUTO: fall back to demo only when the store hasn't been synced with real data.
  return !(await hasRealData());
}

/** Real data = a non-sample source and a meaningful number of trips. */
async function hasRealData(): Promise<boolean> {
  try {
    const [meta, trips] = await Promise.all([timetableStore.meta(), timetableStore.trips()]);
    const isSample = /sample/i.test(meta.source_name);
    return !isSample && trips.length >= 20;
  } catch {
    return false;
  }
}

const CADENCE_MIN = 8; // a local roughly every 8 minutes in demo mode

/**
 * Generate up to `limit` demo trains between two named stations, starting from
 * `afterMinutes` (defaults to now IST). `firstOrLast` overrides the window.
 */
export function demoNextTrains(
  fromName: string,
  toName: string,
  limit: number,
  afterMinutes?: number,
  firstOrLast?: "first" | "last",
): NextTrainsResult {
  const now = afterMinutes ?? nowInIST().minutes;
  const fromCode = pseudoCode(fromName);
  const toCode = pseudoCode(toName);
  // Deterministic-ish journey time from the name lengths, bounded 12–55 min.
  const journey = Math.min(55, Math.max(12, ((fromName.length + toName.length) % 8) * 5 + 15));

  const trains: TrainResult[] = [];

  if (firstOrLast === "first") {
    // First services of the day from ~04:00.
    for (let i = 0; i < limit; i++) buildInto(trains, 240 + i * CADENCE_MIN, journey, fromCode, fromName, toCode, toName, i);
  } else if (firstOrLast === "last") {
    // Last services around 00:30–01:00.
    for (let i = 0; i < limit; i++) buildInto(trains, 60 - i * CADENCE_MIN + 24 * 60, journey, fromCode, fromName, toCode, toName, i);
  } else {
    // Next services after `now`, aligned to the cadence grid.
    const firstDep = Math.ceil(now / CADENCE_MIN) * CADENCE_MIN + 2;
    for (let i = 0; i < limit; i++) buildInto(trains, firstDep + i * CADENCE_MIN, journey, fromCode, fromName, toCode, toName, i);
  }

  return { covered: true, direct: true, trains };
}

function buildInto(
  out: TrainResult[],
  depMin: number,
  journey: number,
  fromCode: string,
  fromName: string,
  toCode: string,
  toName: string,
  index: number,
) {
  const dep = depMin % (24 * 60);
  // Vary service type so the card shows a realistic mix.
  const service: ServiceType = index % 3 === 1 ? "fast" : index % 5 === 3 ? "semi_fast" : "slow";
  const duration = service === "fast" ? Math.round(journey * 0.75) : journey;
  out.push({
    trip_id: `DEMO-${fromCode}-${toCode}-${dep}`,
    name: `${fromName} – ${toName} Local (DEMO)`,
    line: "western",
    service_type: service,
    from_code: fromCode,
    from_name: fromName,
    to_code: toCode,
    to_name: toName,
    departure: fmt(dep),
    arrival: fmt((dep + duration) % (24 * 60)),
    duration_min: duration,
    platform: String((index % 6) + 1),
    cars: index % 4 === 0 ? 15 : 12,
  });
}

function fmt(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** A short uppercase pseudo-code from a station name, for display only. */
function pseudoCode(name: string): string {
  const letters = name.replace(/[^A-Za-z]/g, "").toUpperCase();
  return (letters.slice(0, 3) || "STN");
}

/** Demo stop list for a demo trip_id (endpoints only, honestly minimal). */
export function demoTrainDetails(tripId: string) {
  const parts = tripId.split("-");
  const from = parts[1] ?? "FROM";
  const to = parts[2] ?? "TO";
  const dep = Number(parts[3] ?? 0);
  return {
    found: true as const,
    trip_id: tripId,
    name: `${from} – ${to} Local (DEMO)`,
    line: "western" as const,
    service_type: "slow" as ServiceType,
    stops: [
      { code: from, name: from, arrival: null, departure: fmt(dep % (24 * 60)), platform: "1" },
      { code: to, name: to, arrival: fmt((dep + 20) % (24 * 60)), departure: null, platform: "2" },
    ],
  };
}

export function isDemoTrip(tripId: string): boolean {
  return tripId.startsWith("DEMO-");
}
