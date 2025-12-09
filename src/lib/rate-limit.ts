import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/env";

const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

const ratelimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(30, "10 s"),
      analytics: true,
      prefix: "tablecn",
    })
  : null;

export async function checkRateLimit(req?: Request) {
  if (!ratelimit) {
    return { success: true };
  }

  const headersList = req ? req.headers : await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headersList.get("x-real-ip") ??
    "anonymous";

  const { success, limit, reset, remaining } = await ratelimit.limit(ip);

  return {
    success,
    limit,
    reset,
    remaining,
    ip,
  };
}

export function rateLimitResponse(result: {
  limit?: number;
  reset?: number;
  remaining?: number;
}) {
  return NextResponse.json(
    { error: "Too many requests. Please slow down." },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": String(result.limit ?? 30),
        "X-RateLimit-Remaining": String(result.remaining ?? 0),
        "X-RateLimit-Reset": String(result.reset ?? Date.now()),
      },
    },
  );
}
