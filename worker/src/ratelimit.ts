import { ApiError } from "./errors.ts";
import type { Env } from "./types.ts";

/**
 * Fixed-window limiter on KV.
 *
 * KV is eventually consistent and per-edge, so this is an *abuse brake*, not a
 * hard quota — exactly what the product needs (login stuffing, enquiry spam,
 * report flooding) without adding a D1 write to every request. A future need for
 * exact counters is the documented trigger for a Durable Object limiter.
 */
export type LimitKey =
  | "login"
  | "register"
  | "password_reset"
  | "enquiry"
  | "review"
  | "report"
  | "suggest"
  | "media_upload"
  | "api_read"
  | "room_join"
  | "admin_write";

type Rule = { limit: number; windowSeconds: number; perUser: boolean };

const RULES: Record<LimitKey, Rule> = {
  login: { limit: 8, windowSeconds: 300, perUser: false },
  register: { limit: 4, windowSeconds: 3600, perUser: false },
  password_reset: { limit: 5, windowSeconds: 3600, perUser: false },
  enquiry: { limit: 12, windowSeconds: 3600, perUser: false },
  review: { limit: 6, windowSeconds: 3600, perUser: true },
  report: { limit: 8, windowSeconds: 3600, perUser: true },
  suggest: { limit: 10, windowSeconds: 3600, perUser: false },
  media_upload: { limit: 40, windowSeconds: 600, perUser: true },
  api_read: { limit: 600, windowSeconds: 60, perUser: true },
  room_join: { limit: 10, windowSeconds: 3600, perUser: true },
  admin_write: { limit: 120, windowSeconds: 60, perUser: true },
};

function bucket(windowSeconds: number): number {
  return Math.floor(Date.now() / 1000 / windowSeconds);
}

export async function enforceLimit(
  env: Env,
  key: LimitKey,
  identity: string | null,
): Promise<void> {
  const rule = RULES[key];
  const who = identity ?? "anon";
  const cacheKey = `rl:${key}:${who}:${bucket(rule.windowSeconds)}`;
  let current = 0;
  try {
    current = Number((await env.KV.get(cacheKey)) ?? 0);
  } catch {
    return; // A broken limiter must not take the API down.
  }
  if (current >= rule.limit) {
    const resetIn = rule.windowSeconds - (Math.floor(Date.now() / 1000) % rule.windowSeconds);
    throw ApiError.rateLimited(
      Math.max(1, resetIn),
      key === "login"
        ? "Too many attempts. Wait a moment before trying again."
        : "You have done that a lot today. Please wait a few minutes.",
    );
  }
  const next = current + 1;
  // First hit sets the TTL; later hits only bump the counter.
  await env.KV.put(
    cacheKey,
    String(next),
    next === 1 ? { expirationTtl: rule.windowSeconds + 5 } : {},
  );
}

export function limitIdentity(userId: string | null, ipHash: string | null): string {
  return userId ? `u:${userId}` : ipHash ? ipHash : "unknown";
}
