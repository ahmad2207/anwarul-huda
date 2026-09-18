import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { cleanupExpiredCounters } from "@/lib/rate-limit-store";

// Scheduled from vercel.json, once a day. lib/rate-limit.ts's own
// opportunistic sweep (a small chance on an ordinary request) is a
// backstop, not the mechanism to rely on: Vercel's serverless instances
// do not sit around between requests the way a long running process
// would, so this scheduled sweep is the one that actually keeps the
// counters table from growing without bound.
//
// Vercel sends every scheduled invocation with `Authorization: Bearer
// <CRON_SECRET>` once that environment variable is set, which is what
// this checks. Without CRON_SECRET configured, the route refuses every
// call rather than running unauthenticated in production.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader);
  const isAuthorized = expected.length === actual.length && timingSafeEqual(expected, actual);
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deletedCount = await cleanupExpiredCounters();
  return NextResponse.json({ deletedCount });
}
