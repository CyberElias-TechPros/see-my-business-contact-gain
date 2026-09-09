import { can, type MembershipRole, type WorkspacePermission } from "../../shared/domain.ts";
import { ApiError } from "./errors.ts";
import { buildCookie, deleteCookie, parseCookies } from "./http.ts";
import { hashToken, hmacSign, randomToken, timingSafeEqual, verifyPassword } from "./crypto.ts";
import { newId, nowIso } from "./db.ts";
import type { AppContext, Env } from "./types.ts";

export const SESSION_COOKIE = "gh_session";
export const SESSION_DAYS = 30;
export const IDLE_DAYS = 21;

export type SessionUser = {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  role: "consumer" | "owner" | "staff" | "admin";
  emailVerified: boolean;
  status: "active" | "suspended" | "banned";
  createdAt: string;
};

export type SessionInfo = {
  user: SessionUser;
  sessionId: string;
  sessionVersion: number;
};

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  csrf_hash: string;
  session_version: number;
  expires_at: string;
  last_seen_at: string;
  email: string;
  phone: string | null;
  display_name: string;
  role: SessionUser["role"];
  status: SessionUser["status"];
  email_verified_at: string | null;
  created_at: string;
  user_session_version: number;
};

/** "sid.token" — the row id is stored in the cookie so a token lookup stays indexed. */
export function encodeSessionCookie(sessionId: string, token: string): string {
  return `${sessionId}.${token}`;
}

export function parseSessionCookie(
  value: string | undefined,
): { sessionId: string; token: string } | null {
  if (!value) return null;
  const index = value.indexOf(".");
  if (index <= 0) return null;
  return { sessionId: value.slice(0, index), token: value.slice(index + 1) };
}

export async function startSession(
  env: Env,
  user: { id: string; session_version: number },
  meta: { userAgent?: string | null; ipHash?: string | null },
): Promise<{ sessionId: string; token: string; csrfToken: string; expiresAt: string }> {
  const sessionId = newId("ses");
  const token = randomToken(32);
  const csrfToken = await csrfTokenFor(env, sessionId);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO sessions (id, user_id, token_hash, csrf_hash, session_version, user_agent, ip_hash, created_at, last_seen_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      sessionId,
      user.id,
      await hashToken(token),
      await hashToken(csrfToken),
      user.session_version,
      (meta.userAgent ?? null)?.slice(0, 300) ?? null,
      meta.ipHash ?? null,
      now,
      now,
      expiresAt,
    ),
    env.DB.prepare(
      "UPDATE users SET last_login_at = ?, failed_login_count = 0, locked_until = NULL WHERE id = ?",
    ).bind(now, user.id),
  ]);
  return { sessionId, token, csrfToken, expiresAt };
}

export function sessionCookie(env: Env, sessionId: string, token: string): string {
  return buildCookie(env, SESSION_COOKIE, encodeSessionCookie(sessionId, token), {
    maxAge: SESSION_DAYS * 86_400,
  });
}

export function clearedCookies(env: Env): string[] {
  return [deleteCookie(env, SESSION_COOKIE)];
}

/**
 * CSRF tokens are derived from the session id with a server-side secret, so any
 * endpoint can hand the client a fresh one without storing a per-session value.
 * A cross-site page cannot read it: it lives in a JSON body, not a cookie.
 */
export async function csrfTokenFor(env: Env, sessionId: string): Promise<string> {
  return (await hmacSign(env.SECRET_KEY, `csrf:${sessionId}`)).slice(0, 32);
}

/**
 * Resolves the caller for every request. Cheap by design: one indexed SELECT.
 * A suspended user, or a session issued before `session_version` was bumped,
 * stops working immediately — that is how "log out everywhere" and bans land.
 */
export async function loadSession(c: AppContext): Promise<SessionInfo | null> {
  const parsed = parseSessionCookie(parseCookies(c.request.headers.get("cookie"))[SESSION_COOKIE]);
  if (!parsed) return null;
  const now = nowIso();
  const row = await c.env.DB.prepare(
    `SELECT s.id, s.user_id, s.token_hash, s.csrf_hash, s.session_version, s.expires_at, s.last_seen_at,
            u.email, u.phone, u.display_name, u.role, u.status, u.email_verified_at, u.created_at,
            u.session_version AS user_session_version
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ? AND s.revoked_at IS NULL`,
  )
    .bind(parsed.sessionId)
    .first<SessionRow & { last_seen_at: string }>();
  if (!row) return null;
  if (row.expires_at <= now) {
    await c.env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?")
      .bind(now, row.id)
      .run();
    return null;
  }
  if ((await hashToken(parsed.token)) !== row.token_hash) return null;
  if (row.status !== "active") return null;
  if (row.session_version !== row.user_session_version) return null;

  // Sliding touch, at most once a day, to keep write volume flat.
  if (row.last_seen_at.slice(0, 10) !== now.slice(0, 10)) {
    c.execution.waitUntil(
      c.env.DB.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").bind(now, row.id).run(),
    );
  }

  return {
    user: {
      id: row.user_id,
      email: row.email,
      phone: row.phone,
      displayName: row.display_name,
      role: row.role,
      emailVerified: row.email_verified_at !== null,
      status: row.status,
      createdAt: row.created_at,
    },
    sessionId: row.id,
    sessionVersion: row.session_version,
  };
}

export function requireUser(c: AppContext): SessionInfo {
  if (!c.session) throw ApiError.unauthenticated("Sign in to continue.");
  return c.session;
}

export function requireAdmin(c: AppContext): SessionInfo {
  const session = requireUser(c);
  if (session.user.role !== "admin") throw ApiError.forbidden("Administrator access required.");
  return session;
}

export async function revokeSession(env: Env, sessionId: string): Promise<void> {
  await env.DB.prepare("UPDATE sessions SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL")
    .bind(nowIso(), sessionId)
    .run();
}

export async function revokeAllSessions(env: Env, userId: string): Promise<void> {
  const now = nowIso();
  await env.DB.batch([
    env.DB.prepare(
      "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
    ).bind(now, userId),
    env.DB.prepare("UPDATE users SET session_version = session_version + 1 WHERE id = ?").bind(
      userId,
    ),
  ]);
}

// ------------------------------------------------------------------ csrf ----

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Defence in depth for state-changing calls:
 * 1. Same-site check on `Origin`/`Sec-Fetch-Site` — blocks cross-site form posts.
 * 2. Session-bound `X-CSRF-Token` for authenticated writes — blocks read-based leaks.
 */
export function assertRequestSafety(c: AppContext): void {
  if (SAFE_METHODS.has(c.request.method)) return;
  const fetchSite = c.request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") throw ApiError.forbidden("Cross-site requests are not allowed.");

  const origin = c.request.headers.get("origin");
  if (origin) {
    let sameSite = false;
    try {
      sameSite = new URL(origin).host === c.url.host;
    } catch {
      sameSite = false;
    }
    const allowed = (c.env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((o) => o.trim().replace(/\/$/, ""))
      .filter(Boolean);
    if (
      !sameSite &&
      c.env.APP_ENV !== "development" &&
      c.env.APP_ENV !== "test" &&
      !allowed.includes(origin.replace(/\/$/, ""))
    ) {
      throw ApiError.forbidden("This origin is not allowed to submit to GainHub.");
    }
  }
}

/**
 * Endpoints a signed-out browser must reach. They are exempt from the token check
 * because the token is derived from the session, and a visitor who is logging in (or
 * recovering a password) has none yet — the Origin/Sec-Fetch checks in
 * `assertRequestSafety` still apply, and `startSession` mints a fresh session id on
 * login, so a forced login cannot attach an attacker's cookie to a victim's session.
 */
const CSRF_EXEMPT_PATHS = new Set([
  "/api/v1/auth/register",
  "/api/v1/auth/login",
  "/api/v1/auth/password/forgot",
  "/api/v1/auth/password/reset",
  "/api/v1/auth/email/verify",
  "/api/v1/auth/invites/accept",
]);

/** Verifies the CSRF header for authenticated writes (called from the prepare hook). */
export async function assertCsrfToken(c: AppContext): Promise<void> {
  if (SAFE_METHODS.has(c.request.method) || !c.session) return;
  if (CSRF_EXEMPT_PATHS.has(c.url.pathname)) return;
  const provided = c.request.headers.get("x-csrf-token");
  if (!provided) throw ApiError.forbidden("Missing CSRF token. Reload the page and try again.");
  const expected = await csrfTokenFor(c.env, c.session.sessionId);
  const encoder = new TextEncoder();
  if (!timingSafeEqual(encoder.encode(expected), encoder.encode(provided))) {
    throw ApiError.forbidden("Invalid CSRF token. Reload the page and try again.");
  }
}

// ------------------------------------------------------------ membership ----

export type BusinessAccess = {
  businessId: string;
  role: MembershipRole;
  business: BusinessLite;
};

export type BusinessLite = {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan: "free" | "growth" | "pro";
  owner_user_id: string | null;
};

const BUSINESS_COLUMNS = `id, name, slug, status, plan, owner_user_id`;

export async function findBusinessBySlugOrId(
  env: Env,
  value: string,
): Promise<BusinessLite | null> {
  return await env.DB.prepare(`SELECT ${BUSINESS_COLUMNS} FROM businesses WHERE id = ? OR slug = ?`)
    .bind(value, value)
    .first<BusinessLite>();
}

/**
 * Server-side authorization for workspace routes. Ownership is resolved from the
 * memberships table (plus the historical `owner_user_id` link), never from a
 * client-supplied business id — that closes the IDOR the prototype was open to.
 */
export async function accessFor(
  c: AppContext,
  business: BusinessLite,
): Promise<BusinessAccess | null> {
  const session = c.session;
  if (!session) return null;
  if (session.user.role === "admin") {
    return { businessId: business.id, role: "owner", business };
  }
  const row = await c.env.DB.prepare(
    `SELECT role FROM memberships WHERE business_id = ? AND user_id = ? AND status = 'active'`,
  )
    .bind(business.id, session.user.id)
    .first<{ role: MembershipRole }>();
  if (row) return { businessId: business.id, role: row.role, business };
  if (business.owner_user_id === session.user.id) {
    // Self-heal: an owner whose membership row is missing gets it back.
    c.execution.waitUntil(
      c.env.DB.prepare(
        `INSERT INTO memberships (user_id, business_id, role, status, invited_at, joined_at)
         VALUES (?, ?, 'owner', 'active', ?, ?)
         ON CONFLICT (user_id, business_id) DO UPDATE SET role = 'owner', status = 'active', revoked_at = NULL`,
      )
        .bind(session.user.id, business.id, nowIso(), nowIso())
        .run(),
    );
    return { businessId: business.id, role: "owner", business };
  }
  return null;
}

export async function requireAccess(
  c: AppContext,
  businessRef: string,
  permission?: WorkspacePermission,
): Promise<BusinessAccess> {
  const business = await findBusinessBySlugOrId(c.env, businessRef);
  if (!business) throw ApiError.notFound("Business not found.");
  const access = await accessFor(c, business);
  if (!access) {
    throw c.session
      ? ApiError.forbidden("You are not a member of this business.")
      : ApiError.unauthenticated();
  }
  if (permission && !can(access.role, permission)) {
    throw ApiError.forbidden(
      `Your role (${access.role}) cannot ${permission.replace(":", " ")} here.`,
    );
  }
  return access;
}

/** The active workspace is chosen by the client but always re-checked server-side. */
export async function requireWorkspaceBusiness(
  c: AppContext,
  permission?: WorkspacePermission,
): Promise<BusinessAccess> {
  const ref =
    c.params["businessId"] ??
    c.url.searchParams.get("business") ??
    c.request.headers.get("x-gainhub-business") ??
    (await primaryBusinessId(c));
  if (!ref) throw ApiError.forbidden("No business workspace is linked to your account yet.");
  return requireAccess(c, ref, permission);
}

async function primaryBusinessId(c: AppContext): Promise<string | null> {
  const session = c.session;
  if (!session) return null;
  const row = await c.env.DB.prepare(
    `SELECT m.business_id AS id FROM memberships m JOIN businesses b ON b.id = m.business_id
      WHERE m.user_id = ? AND m.status = 'active' AND b.status IN ('published','draft','pending','hidden','suspended')
      ORDER BY CASE WHEN m.role = 'owner' THEN 0 ELSE 1 END, b.created_at ASC LIMIT 1`,
  )
    .bind(session.user.id)
    .first<{ id: string }>();
  return row?.id ?? null;
}

// ------------------------------------------------------------ credentials ----

export async function checkPassword(password: string, hash: string): Promise<boolean> {
  return verifyPassword(password, hash);
}

/** Generic message so login cannot be used to enumerate accounts. */
export const INVALID_CREDENTIALS = "Email or password is incorrect.";

export function assertNotLocked(lockedUntil: string | null): void {
  if (lockedUntil && lockedUntil > nowIso()) {
    const seconds = Math.max(1, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000));
    throw ApiError.rateLimited(seconds, "Too many failed attempts. Try again in a few minutes.");
  }
}
