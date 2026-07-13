import { createHash } from "node:crypto";

import { sql } from "drizzle-orm";

import { getDb } from "./db";
import { rateLimitBuckets } from "./db/schema";

export type RateLimitResult = { allowed: boolean; retryAfterSeconds: number };

export async function checkRateLimit(request: Request, scope: string, limit: number, windowSeconds: number): Promise<RateLimitResult> {
  const identifier = clientIdentifier(request);
  const key = createHash("sha256").update(`${scope}:${identifier}`).digest("hex");
  const now = new Date();
  const resetBefore = new Date(now.getTime() - windowSeconds * 1000);
  const nowIso = now.toISOString();
  const resetBeforeIso = resetBefore.toISOString();
  try {
    const [bucket] = await getDb().insert(rateLimitBuckets).values({ key, attempts: 1, windowStartedAt: now, updatedAt: now })
      .onConflictDoUpdate({
        target: rateLimitBuckets.key,
        set: {
          attempts: sql<number>`case when ${rateLimitBuckets.windowStartedAt} <= ${resetBeforeIso}::timestamptz then 1 else ${rateLimitBuckets.attempts} + 1 end`,
          windowStartedAt: sql<Date>`case when ${rateLimitBuckets.windowStartedAt} <= ${resetBeforeIso}::timestamptz then ${nowIso}::timestamptz else ${rateLimitBuckets.windowStartedAt} end`,
          updatedAt: now,
        },
      }).returning({ attempts: rateLimitBuckets.attempts, windowStartedAt: rateLimitBuckets.windowStartedAt });
    const elapsedSeconds = Math.floor((now.getTime() - bucket.windowStartedAt.getTime()) / 1000);
    return { allowed: bucket.attempts <= limit, retryAfterSeconds: Math.max(1, windowSeconds - elapsedSeconds) };
  } catch (error) {
    console.error("Rate limiter unavailable", { scope, error });
    return { allowed: true, retryAfterSeconds: 0 };
  }
}

export function rateLimitResponse(result: RateLimitResult) {
  return Response.json({ error: "Too many requests. Please try again later." }, {
    status: 429,
    headers: { "Retry-After": String(result.retryAfterSeconds), "Cache-Control": "no-store" },
  });
}

function clientIdentifier(request: Request) {
  return request.headers.get("cf-connecting-ip")?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
}
