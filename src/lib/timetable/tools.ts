import { z } from "zod";
import { timetableStore } from "./store";
import { demoNextTrains, demoTrainDetails, isDemoEnabled, isDemoTrip } from "./demo";
import { durationMinutes, nowInIST, toMinutes } from "./time";
import type {
  DayType,
  InterchangeOption,
  NextTrainsResult,
  StationMatch,
  StopTime,
  TrainDetails,
  TrainResult,
  Trip,
} from "./types";

/**
 * Tool implementations for the LLM. All timetable logic lives here (not in the
 * model). Inputs are Zod-validated and bounded; outputs are plain JSON.
 */

// ---- Zod schemas (exported for the route to validate tool-call args) ----
export const FindStationArgs = z.object({ query: z.string().min(1).max(80) });

export const GetNextTrainsArgs = z.object({
  from: z.string().min(1).max(80),
  to: z.string().min(1).max(80),
  after_time: z
    .string()
    .regex(/^\d{1,2}:\d{2}$/)
    .optional(),
  day_type: z.enum(["weekday", "saturday", "sunday_holiday"]).optional(),
  service_type: z.enum(["slow", "semi_fast", "fast", "ac"]).optional(),
  limit: z.number().int().min(1).max(10).default(5),
  first_or_last: z.enum(["first", "last"]).optional(),
});

export const GetTrainDetailsArgs = z.object({ trip_id: z.string().min(1).max(40) });

// ---- Station resolution (fuzzy, alias-aware, Latin + Devanagari) ----
function norm(s: string): string {
  return s
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Levenshtein ratio 0..1 for short strings. */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0]![j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  const dist = dp[m]![n]!;
  return 1 - dist / Math.max(m, n);
}

export async function findStation({ query }: z.infer<typeof FindStationArgs>): Promise<StationMatch[]> {
  const stations = await timetableStore.stations();
  const q = norm(query);
  if (!q) return [];

  const scored = stations.map((s) => {
    const candidates = [s.code, s.name_en, s.name_hi, s.name_mr, ...s.aliases].map(norm);
    let best = 0;
    for (const c of candidates) {
      if (!c) continue;
      if (c === q) best = Math.max(best, 1);
      else if (c.includes(q) || q.includes(c)) best = Math.max(best, 0.85);
      else best = Math.max(best, similarity(q, c));
    }
    return { id: s.id, code: s.code, name_en: s.name_en, line: s.line, confidence: Number(best.toFixed(2)) };
  });

  return scored
    .filter((m) => m.confidence >= 0.5)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

async function resolveOne(query: string): Promise<StationMatch | null> {
  const matches = await findStation({ query });
  return matches[0] ?? null;
}

// ---- Direct + interchange train search ----
type StopIndex = Map<string, StopTime[]>; // trip_id -> stops (seq order)

function indexStops(stopTimes: StopTime[]): StopIndex {
  const map: StopIndex = new Map();
  for (const st of stopTimes) {
    const list = map.get(st.trip_id) ?? [];
    list.push(st);
    map.set(st.trip_id, list);
  }
  for (const list of map.values()) list.sort((a, b) => a.seq - b.seq);
  return map;
}

function toTrainResult(
  trip: Trip,
  fromStop: StopTime,
  toStop: StopTime,
  fromName: string,
  toName: string,
): TrainResult | null {
  const dep = fromStop.departure ?? fromStop.arrival;
  const arr = toStop.arrival ?? toStop.departure;
  if (!dep || !arr) return null;
  const duration = durationMinutes(dep, fromStop.departure_day, arr, toStop.arrival_day);
  if (duration <= 0) return null;
  return {
    trip_id: trip.id,
    name: trip.name,
    line: trip.line,
    service_type: trip.service_type,
    from_code: fromStop.station_id,
    from_name: fromName,
    to_code: toStop.station_id,
    to_name: toName,
    departure: dep,
    arrival: arr,
    duration_min: duration,
    platform: fromStop.platform,
    cars: trip.cars,
  };
}

export async function getNextTrains(raw: z.infer<typeof GetNextTrainsArgs>): Promise<NextTrainsResult> {
  const args = GetNextTrainsArgs.parse(raw);
  const dayType: DayType = args.day_type ?? nowInIST().dayType;
  const afterMin = args.after_time ? toMinutes(args.after_time) : nowInIST().minutes;

  const [fromMatch, toMatch, demoOn] = await Promise.all([resolveOne(args.from), resolveOne(args.to), isDemoEnabled()]);

  // Station(s) not in the (sparse) dataset → demo fallback keeps the feature
  // usable; otherwise honestly report no coverage.
  if (!fromMatch || !toMatch) {
    return demoOn
      ? demoNextTrains(titleCase(args.from), titleCase(args.to), args.limit, afterMin, args.first_or_last)
      : { covered: false };
  }

  const [trips, stopTimes, stations] = await Promise.all([
    timetableStore.trips(),
    timetableStore.stopTimes(),
    timetableStore.stations(),
  ]);
  const nameOf = new Map(stations.map((s) => [s.id, s.name_en]));
  const stopsByTrip = indexStops(stopTimes);
  const tripById = new Map(trips.map((t) => [t.id, t]));

  const direct = collectDirect(fromMatch.id, toMatch.id, tripById, stopsByTrip, nameOf, dayType, args.service_type);

  // Apply time window + first/last + limit.
  const finalize = (list: TrainResult[]): TrainResult[] => {
    const sorted = [...list].sort((a, b) => toMinutes(a.departure) - toMinutes(b.departure));
    if (args.first_or_last === "first") return sorted.slice(0, args.limit);
    if (args.first_or_last === "last") return sorted.slice(-args.limit).reverse();
    return sorted.filter((t) => toMinutes(t.departure) >= afterMin).slice(0, args.limit);
  };

  if (direct.length > 0) {
    const trains = finalize(direct);
    // Served, but nothing left today → fall back to demo so the user still
    // sees options (rather than an empty card).
    if (trains.length === 0 && demoOn) {
      return demoNextTrains(fromMatch.name_en, toMatch.name_en, args.limit, afterMin, args.first_or_last);
    }
    return { covered: true, direct: true, trains };
  }

  const interchange = collectInterchange(fromMatch.id, toMatch.id, tripById, stopsByTrip, nameOf, dayType, afterMin, args.limit);
  if (interchange.length > 0) return { covered: true, direct: false, interchange_options: interchange };

  // Known stations but no service in the dataset → demo fallback if enabled.
  return demoOn
    ? demoNextTrains(fromMatch.name_en, toMatch.name_en, args.limit, afterMin, args.first_or_last)
    : { covered: false };
}

function titleCase(s: string): string {
  return s
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function collectDirect(
  fromId: string,
  toId: string,
  tripById: Map<string, Trip>,
  stopsByTrip: StopIndex,
  nameOf: Map<string, string>,
  dayType: DayType,
  serviceType?: string,
): TrainResult[] {
  const results: TrainResult[] = [];
  for (const [tripId, stops] of stopsByTrip) {
    const trip = tripById.get(tripId);
    if (!trip) continue;
    if (!dayTypeRuns(trip.day_type, dayType)) continue;
    if (serviceType && trip.service_type !== serviceType) continue;
    const fromIdx = stops.findIndex((s) => s.station_id === fromId);
    const toIdx = stops.findIndex((s) => s.station_id === toId);
    if (fromIdx === -1 || toIdx === -1 || toIdx <= fromIdx) continue;
    const tr = toTrainResult(trip, stops[fromIdx]!, stops[toIdx]!, nameOf.get(fromId) ?? fromId, nameOf.get(toId) ?? toId);
    if (tr) results.push(tr);
  }
  return results;
}

/**
 * Simple one-change search: find stations reachable directly from `fromId`,
 * that can also reach `toId` directly, and pair the legs at a shared junction.
 * Bounded to keep it cheap; returns at most 2 options.
 */
function collectInterchange(
  fromId: string,
  toId: string,
  tripById: Map<string, Trip>,
  stopsByTrip: StopIndex,
  nameOf: Map<string, string>,
  dayType: DayType,
  afterMin: number,
  limit: number,
): InterchangeOption[] {
  // Candidate change stations = stations served by trips from `fromId`.
  const reachableFromStart = new Set<string>();
  for (const [tripId, stops] of stopsByTrip) {
    const trip = tripById.get(tripId);
    if (!trip || !dayTypeRuns(trip.day_type, dayType)) continue;
    const fromIdx = stops.findIndex((s) => s.station_id === fromId);
    if (fromIdx === -1) continue;
    for (let i = fromIdx + 1; i < stops.length; i++) reachableFromStart.add(stops[i]!.station_id);
  }

  const options: InterchangeOption[] = [];
  for (const changeId of reachableFromStart) {
    if (changeId === toId) continue;
    const leg1 = collectDirect(fromId, changeId, tripById, stopsByTrip, nameOf, dayType)
      .filter((t) => toMinutes(t.departure) >= afterMin)
      .sort((a, b) => toMinutes(a.departure) - toMinutes(b.departure))
      .slice(0, limit);
    if (leg1.length === 0) continue;
    const earliestArrival = toMinutes(leg1[0]!.arrival);
    const leg2 = collectDirect(changeId, toId, tripById, stopsByTrip, nameOf, dayType)
      .filter((t) => toMinutes(t.departure) >= earliestArrival)
      .sort((a, b) => toMinutes(a.departure) - toMinutes(b.departure))
      .slice(0, limit);
    if (leg2.length === 0) continue;
    options.push({
      change_at_code: changeId,
      change_at_name: nameOf.get(changeId) ?? changeId,
      leg1,
      leg2,
    });
    if (options.length >= 2) break;
  }
  return options;
}

/** A trip on `tripDay` runs when the query day matches (weekday trips run Mon–Fri only). */
function dayTypeRuns(tripDay: DayType, queryDay: DayType): boolean {
  return tripDay === queryDay;
}

export async function getTrainDetails({ trip_id }: z.infer<typeof GetTrainDetailsArgs>): Promise<TrainDetails> {
  if (isDemoTrip(trip_id)) return demoTrainDetails(trip_id);

  const [trips, stopTimes, stations] = await Promise.all([
    timetableStore.trips(),
    timetableStore.stopTimes(),
    timetableStore.stations(),
  ]);
  const trip = trips.find((t) => t.id === trip_id);
  if (!trip) return { found: false };
  const nameOf = new Map(stations.map((s) => [s.id, s.name_en]));
  const stops = stopTimes
    .filter((s) => s.trip_id === trip_id)
    .sort((a, b) => a.seq - b.seq)
    .map((s) => ({
      code: s.station_id,
      name: nameOf.get(s.station_id) ?? s.station_id,
      arrival: s.arrival,
      departure: s.departure,
      platform: s.platform,
    }));
  return { found: true, trip_id, name: trip.name, line: trip.line, service_type: trip.service_type, stops };
}

export async function getTimetableInfo() {
  return timetableStore.meta();
}
