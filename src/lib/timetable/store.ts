import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Station, StopTime, TimetableData, TimetableMeta, Trip } from "./types";

/**
 * Read-only timetable repository. Runtime chat tools read ONLY through this;
 * they never call RailRadar directly (the sync script does that, offline).
 *
 * Swap the backend by assigning a different implementation to `timetableStore`.
 */
export interface TimetableStore {
  stations(): Promise<Station[]>;
  trips(): Promise<Trip[]>;
  stopTimes(): Promise<StopTime[]>;
  meta(): Promise<TimetableMeta>;
}

const DATA_PATH = path.join(process.cwd(), "src", "data", "timetable.json");

/**
 * Reads the JSON dataset written by scripts/sync-timetable.ts. The file is read
 * once and cached in memory for the life of the server process.
 */
export class JsonTimetableStore implements TimetableStore {
  private cache: TimetableData | null = null;
  private loading: Promise<TimetableData> | null = null;

  private async load(): Promise<TimetableData> {
    if (this.cache) return this.cache;
    if (!this.loading) {
      this.loading = readFile(DATA_PATH, "utf8")
        .then((raw) => JSON.parse(raw) as TimetableData)
        .then((data) => {
          this.cache = data;
          return data;
        })
        .catch(() => EMPTY_DATA)
        .finally(() => {
          this.loading = null;
        });
    }
    return this.loading;
  }

  async stations(): Promise<Station[]> {
    return (await this.load()).stations ?? [];
  }
  async trips(): Promise<Trip[]> {
    return (await this.load()).trips ?? [];
  }
  async stopTimes(): Promise<StopTime[]> {
    return (await this.load()).stop_times ?? [];
  }
  async meta(): Promise<TimetableMeta> {
    return (await this.load()).meta ?? EMPTY_DATA.meta;
  }
}

const EMPTY_DATA: TimetableData = {
  stations: [],
  trips: [],
  stop_times: [],
  meta: {
    source_name: "RailRadar (unofficial)",
    source_url: "https://railradar.in",
    effective_from: null,
    last_updated: new Date(0).toISOString(),
  },
};

/*
 * ---------------------------------------------------------------------------
 * Future backend swap. Implement the same interface and export it instead:
 *
 *   class SupabaseTimetableStore implements TimetableStore {
 *     async stations() {
 *       const { data } = await supabase.from("stations").select("*");
 *       return (data ?? []) as Station[];
 *     }
 *     async trips()     { ... from("trips").select("*") ... }
 *     async stopTimes() { ... from("stop_times").select("*") ... }
 *     async meta()      { ... from("timetable_meta").select("*").single() ... }
 *   }
 *
 * Then: export const timetableStore: TimetableStore = new SupabaseTimetableStore();
 * The tools and API stay unchanged.
 * ---------------------------------------------------------------------------
 */
export const timetableStore: TimetableStore = new JsonTimetableStore();
