/**
 * Mumbai local timetable data model. Populated from RailRadar by
 * scripts/sync-timetable.ts; the chat tools read ONLY from a TimetableStore.
 */
export type Line = "western" | "central" | "harbour" | "trans-harbour";
export type Direction = "up" | "down";
export type ServiceType = "slow" | "semi_fast" | "fast" | "ac";
export type DayType = "weekday" | "saturday" | "sunday_holiday";

export type Station = {
  id: string; // station code, e.g. "DDR"
  code: string;
  name_en: string;
  name_hi: string;
  name_mr: string;
  aliases: string[];
  line: Line;
  seq: number; // order along the line (from the up terminus)
  lat: number | null;
  lng: number | null;
};

export type Trip = {
  id: string; // train number, e.g. "90002"
  line: Line;
  direction: Direction;
  service_type: ServiceType;
  day_type: DayType;
  origin_station_id: string;
  destination_station_id: string;
  cars: 12 | 15 | null;
  name: string;
};

export type StopTime = {
  trip_id: string;
  station_id: string;
  /** HH:MM, 24h. Null at the very first stop (departure only) is allowed. */
  arrival: string | null;
  departure: string | null;
  /** Day offset from trip start (0 or 1) so overnight trips sort correctly. */
  arrival_day: number;
  departure_day: number;
  platform: string | null;
  seq: number;
};

export type TimetableMeta = {
  source_name: string;
  source_url: string;
  effective_from: string | null;
  last_updated: string; // ISO
};

/** The full dataset persisted as one JSON document by the sync script. */
export type TimetableData = {
  stations: Station[];
  trips: Trip[];
  stop_times: StopTime[];
  meta: TimetableMeta;
};

// ---- Tool result shapes (returned to the LLM and, for trains, the client) ----

export type StationMatch = {
  id: string;
  code: string;
  name_en: string;
  line: Line;
  /** 0..1 match confidence. */
  confidence: number;
};

export type TrainResult = {
  trip_id: string;
  name: string;
  line: Line;
  service_type: ServiceType;
  from_code: string;
  from_name: string;
  to_code: string;
  to_name: string;
  departure: string; // HH:MM at `from`
  arrival: string; // HH:MM at `to`
  duration_min: number;
  platform: string | null;
  cars: 12 | 15 | null;
};

export type NextTrainsResult =
  | { covered: true; direct: true; trains: TrainResult[] }
  | { covered: true; direct: false; interchange_options: InterchangeOption[] }
  | { covered: false };

export type InterchangeOption = {
  change_at_code: string;
  change_at_name: string;
  leg1: TrainResult[];
  leg2: TrainResult[];
};

export type TrainDetails =
  | {
      found: true;
      trip_id: string;
      name: string;
      line: Line;
      service_type: ServiceType;
      stops: { code: string; name: string; arrival: string | null; departure: string | null; platform: string | null }[];
    }
  | { found: false };

/** Payload carried by the [[TRAINS]] stream trailer to the client. */
export type TrainsPayload = {
  from: string;
  to: string;
  effectiveFrom: string | null;
  sourceName: string;
  syncedAt: string;
  result: NextTrainsResult;
};
