import type Groq from "groq-sdk";
import {
  FindStationArgs,
  GetNextTrainsArgs,
  GetTrainDetailsArgs,
  findStation,
  getNextTrains,
  getTimetableInfo,
  getTrainDetails,
} from "./tools";
import type { NextTrainsResult } from "./types";

/**
 * Groq function-calling definitions + a safe server-side dispatcher.
 * Every tool validates its args with Zod before running; bad args return an
 * error object the model can react to (rather than throwing).
 */
export const TOOL_DEFINITIONS: Groq.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "find_station",
      description: "Resolve a station name/alias/misspelling (English, Hindi, Marathi or Roman) to known Mumbai local stations with confidence scores.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Station name as the user wrote it" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_next_trains",
      description: "Direct trains between two stations after a time. Returns {covered:false} if a station is unknown or no service exists. Times are scheduled.",
      parameters: {
        type: "object",
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          after_time: { type: "string", description: "HH:MM 24h; defaults to now (IST)" },
          day_type: { type: "string", enum: ["weekday", "saturday", "sunday_holiday"] },
          service_type: { type: "string", enum: ["slow", "semi_fast", "fast", "ac"] },
          limit: { type: "number", description: "1-10, default 5" },
          first_or_last: { type: "string", enum: ["first", "last"], description: "Ignore time; give the first or last service of the day" },
        },
        required: ["from", "to"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_train_details",
      description: "Full stop list with times for a trip_id returned by get_next_trains.",
      parameters: {
        type: "object",
        properties: { trip_id: { type: "string" } },
        required: ["trip_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_timetable_info",
      description: "Source and freshness of the timetable dataset (source name, effective date, last updated).",
      parameters: { type: "object", properties: {} },
    },
  },
];

export type ToolName = "find_station" | "get_next_trains" | "get_train_details" | "get_timetable_info";

export type ToolRunResult = {
  /** JSON string returned to the model as the tool message content. */
  content: string;
  /** Captured train results, so the route can build the [[TRAINS]] trailer. */
  trains?: NextTrainsResult;
};

/** Runs a tool by name with untrusted JSON args. Never throws. */
export async function runTool(name: string, rawArgs: string): Promise<ToolRunResult> {
  let parsed: unknown = {};
  try {
    parsed = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { content: JSON.stringify({ error: "invalid_arguments_json" }) };
  }

  try {
    switch (name) {
      case "find_station": {
        const args = FindStationArgs.parse(parsed);
        return { content: JSON.stringify(await findStation(args)) };
      }
      case "get_next_trains": {
        const args = GetNextTrainsArgs.parse(parsed);
        const result = await getNextTrains(args);
        return { content: JSON.stringify(result), trains: result };
      }
      case "get_train_details": {
        const args = GetTrainDetailsArgs.parse(parsed);
        return { content: JSON.stringify(await getTrainDetails(args)) };
      }
      case "get_timetable_info": {
        return { content: JSON.stringify(await getTimetableInfo()) };
      }
      default:
        return { content: JSON.stringify({ error: `unknown_tool: ${name}` }) };
    }
  } catch (error) {
    // Zod or logic error → hand a structured error back to the model.
    const message = error instanceof Error ? error.message : "tool_failed";
    return { content: JSON.stringify({ error: "invalid_arguments", detail: message.slice(0, 200) }) };
  }
}
