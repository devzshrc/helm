import "server-only";

import { env } from "~/env";
import { log } from "~/server/logger";

/**
 * Fixed-window rate limiter.
 *
 * Durable across serverless instances when Upstash Redis REST is configured
 * (UPSTASH_REDIS_REST_URL/TOKEN); otherwise falls back to a per-instance
 * in-memory map — fine for local dev, but ineffective across a multi-instance
 * deploy, so production should configure Upstash.
 */
type Bucket = { count: number; reset: number };
const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterMs: number;
}

const redisConfigured = Boolean(
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN,
);

function inMemory(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(key);

  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    // Opportunistic cleanup so the map doesn't grow unbounded.
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
    }
    return { ok: true, remaining: limit - 1, retryAfterMs: 0 };
  }

  if (b.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: b.reset - now };
  }
  b.count++;
  return { ok: true, remaining: limit - b.count, retryAfterMs: 0 };
}

/**
 * Atomic fixed-window via Upstash REST pipeline: INCR the window key, then set
 * its TTL only on first hit (PEXPIRE ... NX). One round-trip, no read-modify-write
 * race.
 */
async function viaRedis(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowId = Math.floor(now / windowMs);
  const redisKey = `rl:${key}:${windowId}`;
  const res = await fetch(`${env.UPSTASH_REDIS_REST_URL}/pipeline`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, String(windowMs), "NX"],
    ]),
  });
  if (!res.ok) throw new Error(`upstash ${res.status}`);
  const out = (await res.json()) as Array<{ result?: number; error?: string }>;
  const count = Number(out?.[0]?.result ?? 0);
  const reset = (windowId + 1) * windowMs;
  if (count > limit) {
    return { ok: false, remaining: 0, retryAfterMs: reset - now };
  }
  return { ok: true, remaining: Math.max(0, limit - count), retryAfterMs: 0 };
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  if (!redisConfigured) return inMemory(key, limit, windowMs);
  try {
    return await viaRedis(key, limit, windowMs);
  } catch (err) {
    // Fail open to in-memory rather than locking everyone out on a store blip.
    log.warn("rate limit store unavailable, falling back in-memory", {
      err: String(err),
    });
    return inMemory(key, limit, windowMs);
  }
}

/** Best-effort client IP from proxy headers. */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** 429 Response with Retry-After. */
export function tooMany(retryAfterMs: number): Response {
  const secs = Math.ceil(retryAfterMs / 1000);
  return new Response(JSON.stringify({ error: "Too many requests" }), {
    status: 429,
    headers: {
      "content-type": "application/json",
      "retry-after": String(secs),
    },
  });
}
