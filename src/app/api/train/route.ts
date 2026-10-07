import { NextResponse } from "next/server";
import { z } from "zod";
import { checkRateLimit, clientKeyFromHeaders } from "@/lib/rate-limit";
import { getTrainDetails } from "@/lib/timetable/tools";

export const runtime = "nodejs";

/*
 * GET /api/train?trip_id=... → full stop list (from the local store only).
 * Used when a train result row is expanded.
 */
const QuerySchema = z.object({ trip_id: z.string().min(1).max(40) });

export async function GET(req: Request) {
  const rate = checkRateLimit(clientKeyFromHeaders(req.headers));
  if (!rate.allowed) return NextResponse.json({ error: "rate_limited" }, { status: 429 });

  const { searchParams } = new URL(req.url);
  const parsed = QuerySchema.safeParse({ trip_id: searchParams.get("trip_id") });
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  const details = await getTrainDetails(parsed.data);
  return NextResponse.json(details);
}
