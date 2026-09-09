import type { Env } from "./types.ts";

/**
 * KV-backed cache, feature flags and platform config.
 *
 * KV (not D1) for these: they are read-mostly, tolerate staleness, and belong to
 * no relational entity. D1 stores the business data; KV stores the switchboard.
 */

const CACHE_PREFIX = "cache:";

export type CacheOptions = { ttlSeconds?: number; swr?: boolean };

export async function cachedJson<T>(
  env: Env,
  key: string,
  producer: () => Promise<T>,
  opts: CacheOptions = {},
): Promise<T> {
  const ttl = opts.ttlSeconds ?? 60;
  if (ttl <= 0 || env.APP_ENV === "test") return producer();
  const cacheKey = `${CACHE_PREFIX}${key}`;
  const hit = await env.KV.getWithMetadata<{ at: number }>(cacheKey, "json");
  if (hit.value != null) return hit.value as T;
  const value = await producer();
  // Empty results are cheap to recompute and expensive to be wrong about: a cold,
  // half-migrated or briefly failing database must not pin an empty directory in the
  // cache for the whole TTL. Misses are simply recomputed instead.
  if (!isEmptyPayload(value)) {
    await env.KV.put(cacheKey, JSON.stringify(value), {
      metadata: { at: Date.now() },
      // 60s is Cloudflare KV's minimum expirationTtl, so short TTLs are request-level only.
      expirationTtl: Math.max(60, ttl),
    });
  }
  return value;
}

function isEmptyPayload(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (value instanceof Set) return value.size === 0;
  if (value instanceof Map) return value.size === 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

/** Explicit invalidation by prefix — used after admin writes and content changes. */
export async function invalidateCache(env: Env, prefix: string): Promise<void> {
  if (env.APP_ENV === "test") return;
  const list = await env.KV.list({ prefix: `${CACHE_PREFIX}${prefix}`, limit: 100 });
  if (list.keys.length === 0) return;
  // The Workers KV type exposes delete(key) only; a prefix purge is a bounded fan-out.
  await Promise.all(list.keys.map((k) => env.KV.delete(k.name)));
}

// ------------------------------------------------------------------ flags ----

export type FeatureFlag = {
  key: string;
  enabled: boolean;
  rolloutPercent: number;
  description?: string;
  updatedAt: string;
};

export const DEFAULT_FLAGS: Record<string, Omit<FeatureFlag, "key" | "updatedAt">> = {
  "reviews.public_enabled": {
    enabled: true,
    rolloutPercent: 100,
    description: "Publish customer reviews on profiles",
  },
  "enquiries.form_enabled": {
    enabled: true,
    rolloutPercent: 100,
    description: "Quote request form on business profiles",
  },
  "rooms.join_queue_enabled": {
    enabled: true,
    rolloutPercent: 100,
    description: "Let members queue for full contact-gain rooms",
  },
  "media.upload_enabled": {
    enabled: true,
    rolloutPercent: 100,
    description: "Direct-to-R2 image uploads from the workspace",
  },
  "billing.self_service_enabled": {
    enabled: false,
    rolloutPercent: 0,
    description: "Businesses can change plan without staff help",
  },
  "analytics.rollup_enabled": {
    enabled: true,
    rolloutPercent: 100,
    description: "Daily metric rollups computed by cron",
  },
};

async function loadFlags(env: Env): Promise<Record<string, FeatureFlag>> {
  const raw = await env.KV.get<Record<string, FeatureFlag>>("flags:all", "json");
  const base: Record<string, FeatureFlag> = {};
  for (const [key, value] of Object.entries(DEFAULT_FLAGS)) {
    base[key] = { key, ...value, updatedAt: "1970-01-01T00:00:00Z" };
  }
  if (raw && typeof raw === "object") {
    for (const [key, value] of Object.entries(raw)) {
      if (!value || typeof value !== "object") continue;
      base[key] = { ...base[key]!, ...value, key };
    }
  }
  return base;
}

export async function listFlags(env: Env): Promise<FeatureFlag[]> {
  const flags = await loadFlags(env);
  return Object.values(flags).sort((a, b) => a.key.localeCompare(b.key));
}

/** Deterministic per-business rollout so a tenant never sees a feature flicker. */
export async function flagEnabled(env: Env, key: string, scopeId?: string): Promise<boolean> {
  const flags = await loadFlags(env);
  const flag = flags[key];
  if (!flag || !flag.enabled) return false;
  if (flag.rolloutPercent >= 100) return true;
  if (flag.rolloutPercent <= 0) return false;
  const hash = hashString(`${key}:${scopeId ?? "global"}`);
  return hash % 100 < flag.rolloutPercent;
}

export async function upsertFlag(env: Env, flag: FeatureFlag): Promise<void> {
  const current = (await env.KV.get<Record<string, FeatureFlag>>("flags:all", "json")) ?? {};
  const merged = { ...current, [flag.key]: flag };
  await env.KV.put("flags:all", JSON.stringify(merged));
}

export async function deleteFlag(env: Env, key: string): Promise<void> {
  const current = (await env.KV.get<Record<string, FeatureFlag>>("flags:all", "json")) ?? {};
  delete current[key];
  await env.KV.put("flags:all", JSON.stringify(current));
}

// ----------------------------------------------------------------- config ----

export type PlatformConfig = {
  maintenance: { enabled: boolean; message: string } | null;
  moderation: { slaHours: number; autoHideRisk: string };
  verification: { slaHours: number };
  signup: { requireEmailVerification: boolean; closed: boolean };
};

export const DEFAULT_CONFIG: PlatformConfig = {
  maintenance: null,
  moderation: { slaHours: 24, autoHideRisk: "high" },
  verification: { slaHours: 48 },
  signup: { requireEmailVerification: false, closed: false },
};

export async function getConfig(env: Env): Promise<PlatformConfig> {
  const raw = await env.KV.get<Partial<PlatformConfig>>("config:platform", "json");
  if (!raw) return DEFAULT_CONFIG;
  return {
    maintenance: raw.maintenance ?? null,
    moderation: { ...DEFAULT_CONFIG.moderation, ...(raw.moderation ?? {}) },
    verification: { ...DEFAULT_CONFIG.verification, ...(raw.verification ?? {}) },
    signup: { ...DEFAULT_CONFIG.signup, ...(raw.signup ?? {}) },
  };
}

export async function setConfig(env: Env, patch: Partial<PlatformConfig>): Promise<PlatformConfig> {
  const current = await getConfig(env);
  const next: PlatformConfig = { ...current, ...patch };
  await env.KV.put("config:platform", JSON.stringify(next));
  return next;
}

// ----------------------------------------------------------------- misc ----

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** Operational heartbeat written by cron and surfaced on the admin jobs page. */
export async function recordJobRun(
  env: Env,
  job: string,
  result: { items: number; durationMs: number; error?: string | null },
): Promise<void> {
  await env.KV.put(`job:${job}`, JSON.stringify({ job, at: new Date().toISOString(), ...result }));
}

export async function readJobRuns(env: Env, jobs: string[]): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const job of jobs) {
    const value = await env.KV.get<unknown>(`job:${job}`, "json");
    out[job] = value ?? null;
  }
  return out;
}
