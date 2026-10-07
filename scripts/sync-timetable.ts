/**
 * Sync Mumbai local timetable data from RailRadar into the local JSON store
 * (src/data/timetable.json). Runtime chat NEVER calls RailRadar; only this
 * offline script does, cache-first, within a monthly request budget.
 *
 * Usage:
 *   npx tsx scripts/sync-timetable.ts            # resume/sync
 *   npx tsx scripts/sync-timetable.ts --reset    # start fresh
 *
 * Behaviour:
 *   - GET /lookup/trains/local?city=Mumbai once to list local train numbers.
 *   - GET /trains/{number} for each (resumable via .sync-progress.json).
 *   - Sleeps between calls; stops cleanly on HTTP 429; tracks requests used.
 *   - Prioritises Western, Central main and Harbour corridors.
 *   - Writes normalised stations, trips, stop_times, meta into timetable.json.
 *
 * Env: RAILRADAR_API_KEY (required), RAILRADAR_MONTHLY_BUDGET (default 300).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  DayType,
  Direction,
  Line,
  ServiceType,
  Station,
  StopTime,
  TimetableData,
  Trip,
} from "../src/lib/timetable/types";

const BASE = "https://api.railradar.in/v1";
const KEY = process.env.RAILRADAR_API_KEY ?? "";
const BUDGET = Number(process.env.RAILRADAR_MONTHLY_BUDGET ?? 300);
const DATA_PATH = path.join(process.cwd(), "src", "data", "timetable.json");
const PROGRESS_PATH = path.join(process.cwd(), "scripts", ".sync-progress.json");
const SLEEP_MS = 1500;

type Progress = { done: string[]; requests: number; startedAt: string };

async function main() {
  if (!KEY) {
    console.error("RAILRADAR_API_KEY is not set. Add it to .env.local and re-run.");
    process.exit(1);
  }
  const reset = process.argv.includes("--reset");

  const progress: Progress = reset
    ? { done: [], requests: 0, startedAt: new Date().toISOString() }
    : await readJson<Progress>(PROGRESS_PATH, { done: [], requests: 0, startedAt: new Date().toISOString() });

  const data: TimetableData = reset
    ? emptyData()
    : await readJson<TimetableData>(DATA_PATH, emptyData());

  const stationMap = new Map(data.stations.map((s) => [s.id, s]));
  const tripMap = new Map(data.trips.map((t) => [t.id, t]));
  const stopKey = (s: StopTime) => `${s.trip_id}:${s.station_id}:${s.seq}`;
  const stopSet = new Set(data.stop_times.map(stopKey));

  console.log(`Budget: ${BUDGET} requests. Used so far: ${progress.requests}. Already synced: ${progress.done.length}.`);

  // 1) List local trains.
  const lookup = await api<{ success: boolean; data: Record<string, string> }>("/lookup/trains/local?city=Mumbai", progress);
  if (!lookup || lookup === "rate_limited") return finish(data, progress, "lookup failed or budget exhausted");

  const numbers = prioritise(Object.entries(lookup.data));
  console.log(`Found ${numbers.length} local trains. Fetching details...`);

  // 2) Fetch each train's details.
  for (const [number, label] of numbers) {
    if (progress.done.includes(number)) continue;
    if (progress.requests >= BUDGET) {
      console.log(`Monthly budget of ${BUDGET} reached. Stopping cleanly; re-run next cycle to resume.`);
      break;
    }

    const detail = await api<TrainDetailResponse>(`/trains/${number}`, progress);
    if (detail === "rate_limited") {
      console.log("HTTP 429 from RailRadar. Stopping cleanly; re-run later to resume.");
      break;
    }
    if (!detail) {
      progress.done.push(number); // skip permanently-failing numbers
      continue;
    }

    normaliseInto(detail, { stationMap, tripMap, stopSet, stopTimes: data.stop_times, label });
    progress.done.push(number);
    await sleep(SLEEP_MS);
    if (progress.done.length % 10 === 0) {
      data.stations = [...stationMap.values()];
      data.trips = [...tripMap.values()];
      await save(data, progress);
      console.log(`Checkpoint: ${progress.done.length} trains, ${progress.requests} requests used.`);
    }
  }

  data.stations = [...stationMap.values()];
  data.trips = [...tripMap.values()];
  await finish(data, progress, "sync complete");
}

// ---- RailRadar response shapes (only the fields we use) ----
type RRStation = { code: string; name: string; lat: number; lng: number };
type RRStop = {
  sequence: number;
  station: RRStation;
  isHalt: boolean;
  platform?: string | null;
  arrival?: string;
  arrivalDay?: number;
  departure?: string;
  departureDay?: number;
};
type TrainDetailResponse = {
  success: boolean;
  data: {
    train: {
      number: string;
      name: string;
      source: RRStation;
      destination: RRStation;
      runDays: string[];
      totalHalts: number;
      distance: number;
    };
    route: RRStop[];
  };
};

type NormaliseCtx = {
  stationMap: Map<string, Station>;
  tripMap: Map<string, Trip>;
  stopSet: Set<string>;
  stopTimes: StopTime[];
  label: string;
};

function normaliseInto(res: TrainDetailResponse, ctx: NormaliseCtx) {
  if (!res.success || !res.data?.route?.length) return;
  const { train, route } = res.data;
  const line = inferLine(ctx.label, route);
  const dayType = inferDayType(train.runDays);
  const service = inferService(train.totalHalts, train.distance, ctx.label);
  const direction = inferDirection(line, route);

  for (const stop of route) {
    const st = stop.station;
    if (!ctx.stationMap.has(st.code)) {
      ctx.stationMap.set(st.code, {
        id: st.code,
        code: st.code,
        name_en: st.name,
        name_hi: st.name, // sync leaves script names = English; refine later
        name_mr: st.name,
        aliases: [],
        line,
        seq: stop.sequence,
        lat: st.lat ?? null,
        lng: st.lng ?? null,
      });
    }
  }

  ctx.tripMap.set(train.number, {
    id: train.number,
    line,
    direction,
    service_type: service,
    day_type: dayType,
    origin_station_id: train.source.code,
    destination_station_id: train.destination.code,
    cars: null,
    name: train.name,
  });

  for (const stop of route) {
    const record: StopTime = {
      trip_id: train.number,
      station_id: stop.station.code,
      arrival: stop.arrival ?? null,
      departure: stop.departure ?? null,
      arrival_day: stop.arrivalDay ? stop.arrivalDay - 1 : 0,
      departure_day: stop.departureDay ? stop.departureDay - 1 : 0,
      platform: stop.platform ?? null,
      seq: stop.sequence,
    };
    const key = `${record.trip_id}:${record.station_id}:${record.seq}`;
    if (!ctx.stopSet.has(key)) {
      ctx.stopSet.add(key);
      ctx.stopTimes.push(record);
    }
  }
}

function inferLine(label: string, route: RRStop[]): Line {
  const codes = route.map((r) => r.station.code);
  if (codes.includes("CCG") || /churchgate|virar|borivali|andheri|bandra/i.test(label)) return "western";
  if (codes.includes("PNVL") || /panvel|vashi|harbour/i.test(label)) return "harbour";
  if (codes.includes("CSMT") || codes.includes("CSTM") || /kalyan|thane|csmt|kurla/i.test(label)) return "central";
  return "western";
}

function inferDayType(runDays: string[]): DayType {
  const set = new Set(runDays.map((d) => d.toLowerCase()));
  if (set.has("sun") && set.size === 1) return "sunday_holiday";
  if (set.has("sat") && !set.has("mon")) return "saturday";
  return "weekday";
}

function inferService(halts: number, distance: number, label: string): ServiceType {
  if (/\bac\b/i.test(label)) return "ac";
  if (distance <= 0 || halts <= 0) return "slow";
  const haltsPerKm = halts / distance;
  if (haltsPerKm < 0.35) return "fast";
  if (haltsPerKm < 0.6) return "semi_fast";
  return "slow";
}

function inferDirection(line: Line, route: RRStop[]): Direction {
  // "up" heads towards the southern terminus (Churchgate/CSMT); "down" away.
  const downTerminals = new Set(["VR", "BVI", "KYN", "PNVL", "TNA"]);
  const last = route[route.length - 1]?.station.code ?? "";
  return downTerminals.has(last) ? "down" : "up";
}

/** Put Western, Central main and Harbour corridors first. */
function prioritise(entries: [string, string][]): [string, string][] {
  const score = (label: string) => {
    if (/churchgate|virar|borivali|andheri|bandra|dadar/i.test(label)) return 0; // western
    if (/csmt|kalyan|thane|kurla/i.test(label)) return 1; // central main
    if (/panvel|vashi|harbour/i.test(label)) return 2; // harbour
    return 3;
  };
  return [...entries].sort((a, b) => score(a[1]) - score(b[1]));
}

// ---- HTTP + IO helpers ----
async function api<T>(pathname: string, progress: Progress): Promise<T | null | "rate_limited"> {
  if (progress.requests >= BUDGET) return null;
  progress.requests += 1;
  try {
    const res = await fetch(`${BASE}${pathname}`, { headers: { Authorization: `Bearer ${KEY}` } });
    if (res.status === 429) return "rate_limited";
    if (!res.ok) {
      console.warn(`  ${pathname} → HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    console.warn(`  ${pathname} → ${error instanceof Error ? error.message : "error"}`);
    return null;
  }
}

async function save(data: TimetableData, progress: Progress) {
  data.meta = {
    source_name: "RailRadar (unofficial)",
    source_url: "https://railradar.in",
    effective_from: data.meta.effective_from ?? null,
    last_updated: new Date().toISOString(),
  };
  await writeFile(DATA_PATH, JSON.stringify(data, null, 2));
  await writeFile(PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

async function finish(data: TimetableData, progress: Progress, reason: string) {
  await save(data, progress);
  console.log(
    `Done (${reason}). Stations: ${data.stations.length}, trips: ${data.trips.length}, stop_times: ${data.stop_times.length}. Requests used: ${progress.requests}.`,
  );
}

function emptyData(): TimetableData {
  return {
    stations: [],
    trips: [],
    stop_times: [],
    meta: {
      source_name: "RailRadar (unofficial)",
      source_url: "https://railradar.in",
      effective_from: null,
      last_updated: new Date().toISOString(),
    },
  };
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

void main();
