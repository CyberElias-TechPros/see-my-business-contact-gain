import type { Context } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import type { AppContext, Env, SessionUser } from "./types";
import { safeEqual, unauthorized } from "./util";

const SESSION_COOKIE = "gainhub_session";
const ITERATIONS = 100_000;

function b64encode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function b64decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hashPassword(password: string, saltB64?: string): Promise<string> {
  const salt = saltB64 ? b64decode(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    key,
    256,
  );
  return `pbkdf2:${ITERATIONS}:${b64encode(salt)}:${b64encode(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(":");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") return false;
  const expected = await hashPassword(password, parts[2] ?? undefined);
  return safeEqual(expected, stored);
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

type UserRow = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone: string | null;
  whatsapp: string | null;
  prefs: string;
};

export function toSessionUser(row: UserRow): SessionUser {
  let prefs: Record<string, unknown> = {};
  try {
    prefs = JSON.parse(row.prefs) as Record<string, unknown>;
  } catch {
    prefs = {};
  }
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: (row.role as SessionUser["role"]) ?? "user",
    status: row.status,
    phone: row.phone,
    whatsapp: row.whatsapp,
    prefs,
  };
}

/** Is this request cross-site? Determines cookie SameSite. */
function isCrossSite(c: AppContext): boolean {
  const origin = c.req.header("origin");
  if (!origin) return false;
  try {
    const apiHost = new URL(c.req.url).host;
    return new URL(origin).host !== apiHost;
  } catch {
    return true;
  }
}

export async function createSession(c: AppContext, userId: string): Promise<string> {
  const token = randomToken();
  const ttlDays = Number(c.env.SESSION_TTL_DAYS ?? "30") || 30;
  const expires = Date.now() + ttlDays * 24 * 60 * 60 * 1000;
  await c.env.DB.prepare(
    `INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?1, ?2, ?3, ?4)`,
  )
    .bind(token, userId, expires, Date.now())
    .run();
  setCookie(c, SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: isCrossSite(c) ? "None" : "Lax",
    maxAge: ttlDays * 24 * 60 * 60,
  });
  // Opportunistic cleanup of expired sessions.
  await c.env.DB.prepare(`DELETE FROM sessions WHERE expires_at < ?1`).bind(Date.now()).run();
  return token;
}

export function clearSession(c: Context): void {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    c.executionCtx.waitUntil(
      (c.env as Env).DB.prepare(`DELETE FROM sessions WHERE token = ?1`).bind(token).run(),
    );
  }
  deleteCookie(c, SESSION_COOKIE, { path: "/", secure: true });
}

/** Resolves the current session user (or null) without failing the request. */
export const sessionMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: { user: SessionUser | null };
}>(async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const row = await c.env.DB.prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token = ?1 AND s.expires_at > ?2 AND u.status != 'Suspended'`,
    )
      .bind(token, Date.now())
      .first<UserRow>();
    if (row) c.set("user", toSessionUser(row));
  }
  await next();
});

export function getUser(c: AppContext): SessionUser {
  const user = c.get("user");
  if (!user) unauthorized();
  return user;
}

export function getAdmin(c: AppContext): SessionUser {
  const user = getUser(c);
  if (user.role !== "admin") unauthorized("Admin access required");
  return user;
}

/** The signed-in user's primary business (first one they own). */
export async function getOwnedBusiness(c: AppContext): Promise<BusinessRow> {
  const user = getUser(c);
  const row = await c.env.DB.prepare(
    `SELECT * FROM businesses WHERE owner_id = ?1 ORDER BY created_at ASC LIMIT 1`,
  )
    .bind(user.id)
    .first<BusinessRow>();
  if (!row) unauthorized("Create your business profile first");
  return row;
}

export type BusinessRow = {
  id: string;
  owner_id: string | null;
  name: string;
  tagline: string;
  about: string;
  category_slug: string;
  city: string;
  state: string;
  address: string;
  rating: number;
  reviews_count: number;
  verified: string;
  open_now: number;
  whatsapp: string;
  phone: string;
  website: string;
  socials: string;
  services: string;
  products: string;
  amenities: string;
  service_areas: string;
  gallery: string;
  team: string;
  hours: string;
  plan: string;
  status: string;
  contacts_gained: number;
  saved_by: number;
  featured: number;
  response_minutes: number;
  created_at: number;
  updated_at: number;
};
