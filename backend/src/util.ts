import type { Context } from "hono";
import type { AppContext } from "./types";
import { HTTPException } from "hono/http-exception";
import type { Env } from "./types";

export const jsonHeaders = { "cache-control": "no-store" };

export function bad(message: string, status = 400): never {
  throw new HTTPException(status as 400, { message });
}

export function notFound(message = "Not found"): never {
  throw new HTTPException(404, { message });
}

export function forbidden(message = "Forbidden"): never {
  throw new HTTPException(403, { message });
}

export function unauthorized(message = "Sign in required"): never {
  throw new HTTPException(401, { message });
}

export function str(
  v: unknown,
  field: string,
  { max = 5000, min = 1, optional = false } = {},
): string {
  if (v === undefined || v === null || v === "") {
    if (optional) return "";
    bad(`${field} is required`);
  }
  const s = String(v).trim();
  if (s.length < min) bad(`${field} is required`);
  if (s.length > max) bad(`${field} is too long (max ${max})`);
  return s;
}

export function int(v: unknown, fallback: number, { min = -1e9, max = 1e9 } = {}): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

export function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validEmail(v: unknown): string {
  const s = str(v, "Email", { max: 200 }).toLowerCase();
  if (!EMAIL_RE.test(s)) bad("Enter a valid email address");
  return s;
}

export function validPassword(v: unknown): string {
  const s = str(v, "Password", { max: 200 });
  if (s.length < 8) bad("Password must be at least 8 characters");
  return s;
}

/** Read a JSON body safely. */
export async function body(c: AppContext): Promise<Record<string, unknown>> {
  try {
    const data = await c.req.json();
    if (data && typeof data === "object" && !Array.isArray(data))
      return data as Record<string, unknown>;
    return {};
  } catch {
    return {};
  }
}

export function nowMs(): number {
  return Date.now();
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 46656)
    .toString(36)
    .toUpperCase()
    .padStart(3, "0")}`;
}

export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

/** Best-effort fixed-window rate limiter backed by D1 (KV when available). */
export async function rateLimit(
  db: Env["DB"],
  ip: string,
  route: string,
  limit: number,
  windowMs = 60_000,
): Promise<void> {
  const window = Math.floor(Date.now() / windowMs);
  try {
    await db
      .prepare(
        `INSERT INTO rate_limits (ip, route, window, count) VALUES (?1, ?2, ?3, 1)
         ON CONFLICT (ip, route, window) DO UPDATE SET count = count + 1`,
      )
      .bind(ip, route, window)
      .run();
    const row = await db
      .prepare(`SELECT count FROM rate_limits WHERE ip = ?1 AND route = ?2 AND window = ?3`)
      .bind(ip, route, window)
      .first<{ count: number }>();
    if (row && row.count > limit) bad("Too many requests — slow down and try again shortly", 429);
  } catch {
    // Rate limiting must never break the request path.
  }
}

export function clientIp(c: Context): string {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function nairaToNumber(v: string): number {
  const digits = v.replace(/[^\d.]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

export function slugify(v: string): string {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
