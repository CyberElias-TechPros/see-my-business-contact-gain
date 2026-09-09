import {
  changePasswordInput,
  loginInput,
  profileSettingsInput,
  registerInput,
  requestPasswordResetInput,
  resetPasswordInput,
  verifyEmailInput,
  type SessionResponse,
} from "../../../shared/api.ts";
import { normalizeNigerianPhone } from "../../../shared/domain.ts";
import {
  INVALID_CREDENTIALS,
  assertNotLocked,
  checkPassword,
  clearedCookies,
  csrfTokenFor,
  requireUser,
  sessionCookie,
  startSession,
} from "../auth.ts";
import { getConfig } from "../cache.ts";
import { hashPassword, hashToken, needsRehash, randomToken } from "../crypto.ts";
import { DB } from "../db-access.ts";
import { newId, nowIso } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseBody } from "../http.ts";
import { frontendUrl, isEmail, sendMail } from "../mail.ts";
import { enforceLimit, limitIdentity } from "../ratelimit.ts";
import type { AppContext } from "../types.ts";

type UserAuthRow = {
  id: string;
  email: string;
  phone: string | null;
  password_hash: string;
  display_name: string;
  role: "consumer" | "owner" | "staff" | "admin";
  status: "active" | "suspended" | "banned";
  locked_until: string | null;
  failed_login_count: number;
  session_version: number;
  email_verified_at: string | null;
  created_at: string;
};

const AUTH_SELECT = `id, email, phone, password_hash, display_name, role, status, locked_until,
  failed_login_count, session_version, email_verified_at, created_at`;

export async function register(c: AppContext): Promise<Response> {
  const input = await parseBody(registerInput, c.request);
  // Classic honeypot: a bot that fills the hidden field gets a fake success.
  if (input.honeypot) return json({ ok: true, csrfToken: "" }, { status: 201 });

  const config = await getConfig(c.env);
  if (config.signup.closed)
    throw ApiError.forbidden("New sign-ups are paused right now. Please try again later.");

  await enforceLimit(c.env, "register", limitIdentity(null, c.ipHash));

  const email = input.email.toLowerCase();
  const phone = normalizeNigerianPhone(input.phone);
  if (!phone)
    throw ApiError.validation({ phone: "Use a valid Nigerian number, e.g. 0803 000 0000." });
  if (!input.acceptedTerms)
    throw ApiError.validation({ acceptedTerms: "Accept the terms to continue." });

  const existing = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM users WHERE email_normalized = ?",
    [email],
  );
  if (existing) {
    // Documented trade-off (docs/adr/0003-sign-up-enumeration.md): business owners
    // are real traders, so a clear "account exists" beats a dead-end flow. The
    // per-IP registration cap keeps scripted enumeration expensive.
    throw ApiError.conflict(
      "An account already uses this email. Sign in instead, or reset your password.",
      {
        email: "Already registered.",
      },
    );
  }

  const now = nowIso();
  const userId = newId("usr");
  const passwordHash = await hashPassword(input.password);
  await DB.run(
    c.env,
    `INSERT INTO users (id, email, email_normalized, phone, password_hash, display_name, role, status, created_at, updated_at, marketing_opt_in)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 0)`,
    [userId, email, email, phone, passwordHash, input.displayName, input.role, now, now],
  );

  const session = await startSession(
    c.env,
    { id: userId, session_version: 0 },
    { userAgent: c.request.headers.get("user-agent"), ipHash: c.ipHash },
  );

  if (config.signup.requireEmailVerification)
    await issueEmailVerification(c, userId, email, input.displayName);

  const body: SessionResponse = {
    user: await loadSessionUser(c, userId),
    memberships: [],
    csrfToken: await csrfTokenFor(c.env, session.sessionId),
  };
  return json(body, {
    status: 201,
    headers: { "set-cookie": sessionCookie(c.env, session.sessionId, session.token) },
  });
}

/** 401, not 403: the client is unauthenticated, and the copy never says which half failed. */
export async function login(c: AppContext): Promise<Response> {
  const input = await parseBody(loginInput, c.request);
  const identifier = input.identifier.trim().toLowerCase();
  await enforceLimit(
    c.env,
    "login",
    `${limitIdentity(null, c.ipHash)}:${(await hashToken(identifier)).slice(0, 16)}`,
  );

  const phone = normalizeNigerianPhone(identifier);
  const row = await DB.first<UserAuthRow>(
    c.env,
    phone
      ? `SELECT ${AUTH_SELECT} FROM users WHERE (email_normalized = ? OR phone = ?) AND deleted_at IS NULL`
      : `SELECT ${AUTH_SELECT} FROM users WHERE email_normalized = ? AND deleted_at IS NULL`,
    phone ? [identifier, phone] : [identifier],
  );

  // Unknown account: still run a KDF so timing does not disclose existence.
  if (!row) {
    await hashPassword(input.password);
    throw ApiError.unauthenticated(INVALID_CREDENTIALS);
  }

  assertNotLocked(row.locked_until);

  if (!(await checkPassword(input.password, row.password_hash))) {
    const failures = row.failed_login_count + 1;
    const lockedUntil = failures >= 10 ? new Date(Date.now() + 15 * 60_000).toISOString() : null;
    await DB.run(c.env, "UPDATE users SET failed_login_count = ?, locked_until = ? WHERE id = ?", [
      failures,
      lockedUntil,
      row.id,
    ]);
    throw ApiError.unauthenticated(INVALID_CREDENTIALS);
  }

  if (row.status === "suspended")
    throw ApiError.forbidden("This account is suspended. Contact support to reopen it.");
  if (row.status === "banned")
    throw ApiError.forbidden("This account has been banned for policy violations.");

  const now = nowIso();
  await DB.write(c.env, [
    // A successful sign-in clears the strike counter. Without this, nine failed
    // attempts in 2024 would still lock the account out on its tenth try in 2026.
    {
      sql: "UPDATE users SET failed_login_count = 0, locked_until = NULL, last_login_at = ? WHERE id = ?",
      params: [now, row.id],
    },
    // Transparent KDF upgrade: the hash carries its own cost, so an account created
    // under an older parameter is rewritten now rather than by a migration nobody runs.
    ...(needsRehash(row.password_hash)
      ? [
          {
            sql: "UPDATE users SET password_hash = ? WHERE id = ?",
            params: [await hashPassword(input.password), row.id],
          },
        ]
      : []),
  ]);

  const session = await startSession(
    c.env,
    { id: row.id, session_version: row.session_version },
    { userAgent: c.request.headers.get("user-agent"), ipHash: c.ipHash },
  );

  const body: SessionResponse = {
    user: await loadSessionUser(c, row.id),
    memberships: await membershipsFor(c, row.id),
    csrfToken: await csrfTokenFor(c.env, session.sessionId),
  };
  return json(body, {
    headers: { "set-cookie": sessionCookie(c.env, session.sessionId, session.token) },
  });
}

export async function logout(c: AppContext): Promise<Response> {
  if (c.session) {
    await DB.run(c.env, "UPDATE sessions SET revoked_at = ? WHERE id = ?", [
      nowIso(),
      c.session.sessionId,
    ]);
  }
  return json({ ok: true }, { headers: { "set-cookie": clearedCookies(c.env).join(", ") } });
}

export async function getSession(c: AppContext): Promise<Response> {
  if (!c.session) {
    return json({ user: null, memberships: [], csrfToken: "" } satisfies SessionResponse, {
      headers: { "cache-control": "private, no-cache" },
    });
  }
  const body: SessionResponse = {
    user: c.session.user,
    memberships: await membershipsFor(c, c.session.user.id),
    csrfToken: await csrfTokenFor(c.env, c.session.sessionId),
  };
  return json(body, { headers: { "cache-control": "private, no-cache" } });
}

export async function changePassword(c: AppContext): Promise<Response> {
  const session = requireUser(c);
  const input = await parseBody(changePasswordInput, c.request);
  const row = await DB.first<{ password_hash: string }>(
    c.env,
    "SELECT password_hash FROM users WHERE id = ?",
    [session.user.id],
  );
  if (!row) throw ApiError.notFound("Account not found.");
  if (!(await checkPassword(input.currentPassword, row.password_hash))) {
    throw ApiError.validation({ currentPassword: "That password is not correct." });
  }
  const now = nowIso();
  await DB.write(c.env, [
    {
      sql: "UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?",
      params: [await hashPassword(input.newPassword), now, session.user.id],
    },
    // The caller's own device stays signed in; every other session dies.
    {
      sql: "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND id <> ? AND revoked_at IS NULL",
      params: [now, session.user.id, session.sessionId],
    },
  ]);
  await pushNotification(
    c,
    session.user.id,
    "security",
    "Password changed",
    "Your GainHub password was changed. If this was not you, reset it immediately.",
    "/account/security",
  );
  return json({ ok: true, message: "Password updated." });
}

export async function updateProfileSettings(c: AppContext): Promise<Response> {
  const session = requireUser(c);
  const input = await parseBody(profileSettingsInput, c.request);
  const phone = normalizeNigerianPhone(input.phone);
  if (!phone) throw ApiError.validation({ phone: "Use a valid Nigerian number." });
  await DB.run(
    c.env,
    `UPDATE users SET display_name = ?, phone = ?, marketing_opt_in = ?, show_name_on_reviews = ?, allow_business_messaging = ?, updated_at = ?
      WHERE id = ?`,
    [
      input.displayName,
      phone,
      input.marketingOptIn ? 1 : 0,
      input.showNameOnReviews ? 1 : 0,
      input.allowBusinessMessaging ? 1 : 0,
      nowIso(),
      session.user.id,
    ],
  );
  return json({ ok: true, user: await loadSessionUser(c, session.user.id) });
}

export async function requestPasswordReset(c: AppContext): Promise<Response> {
  const input = await parseBody(requestPasswordResetInput, c.request);
  await enforceLimit(c.env, "password_reset", limitIdentity(null, c.ipHash));
  const user = await DB.first<{ id: string; email: string; display_name: string }>(
    c.env,
    "SELECT id, email, display_name FROM users WHERE email_normalized = ? AND deleted_at IS NULL",
    [input.email],
  );
  if (user) {
    const token = randomToken(32);
    await DB.run(
      c.env,
      `INSERT INTO action_tokens (id, user_id, kind, token_hash, expires_at, created_at)
       VALUES (?, ?, 'password_reset', ?, ?, ?)`,
      [
        newId("tok"),
        user.id,
        await hashToken(token),
        new Date(Date.now() + 30 * 60_000).toISOString(),
        nowIso(),
      ],
    );
    c.execution.waitUntil(
      sendMail(c.env, {
        to: user.email,
        subject: "Reset your GainHub password",
        text: `Hi ${user.display_name},\n\nUse this link within 30 minutes to choose a new password:\n\n${frontendUrl(c.env, `/auth/reset?token=${token}`)}\n\nIf you did not ask for this, ignore this email — your password stays as it is.`,
      }).catch(() => undefined),
    );
  }
  return json({ ok: true, message: "If an account uses that email, a reset link is on its way." });
}

export async function resetPassword(c: AppContext): Promise<Response> {
  const input = await parseBody(resetPasswordInput, c.request);
  await enforceLimit(c.env, "password_reset", limitIdentity(null, c.ipHash));
  const tokenHash = await hashToken(input.token);
  const row = await DB.first<{ user_id: string; expires_at: string; used_at: string | null }>(
    c.env,
    "SELECT user_id, expires_at, used_at FROM action_tokens WHERE kind = 'password_reset' AND token_hash = ?",
    [tokenHash],
  );
  if (!row || row.used_at || row.expires_at <= nowIso()) {
    throw ApiError.validation({
      token: "That reset link is invalid or has expired. Request a new one.",
    });
  }
  const now = nowIso();
  await DB.write(c.env, [
    {
      sql: "UPDATE users SET password_hash = ?, updated_at = ?, session_version = session_version + 1, locked_until = NULL, failed_login_count = 0 WHERE id = ?",
      params: [await hashPassword(input.password), now, row.user_id],
    },
    { sql: "UPDATE action_tokens SET used_at = ? WHERE token_hash = ?", params: [now, tokenHash] },
    // Bumping session_version plus revoking rows kills every live session.
    {
      sql: "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
      params: [now, row.user_id],
    },
  ]);
  return json({ ok: true, message: "Password updated. Sign in with your new password." });
}

export async function verifyEmail(c: AppContext): Promise<Response> {
  const input = await parseBody(verifyEmailInput, c.request);
  const tokenHash = await hashToken(input.token);
  const row = await DB.first<{ user_id: string; expires_at: string; used_at: string | null }>(
    c.env,
    "SELECT user_id, expires_at, used_at FROM action_tokens WHERE kind = 'email_verify' AND token_hash = ?",
    [tokenHash],
  );
  if (!row || row.used_at || row.expires_at <= nowIso()) {
    throw ApiError.validation({ token: "That verification link is invalid or expired." });
  }
  const now = nowIso();
  await DB.write(c.env, [
    {
      sql: "UPDATE users SET email_verified_at = ? WHERE id = ? AND email_verified_at IS NULL",
      params: [now, row.user_id],
    },
    { sql: "UPDATE action_tokens SET used_at = ? WHERE token_hash = ?", params: [now, tokenHash] },
    {
      sql: "UPDATE businesses SET verified_level = CASE WHEN verified_level = 'unverified' THEN 'email' ELSE verified_level END, updated_at = ? WHERE owner_user_id = ?",
      params: [now, row.user_id],
    },
  ]);
  return json({ ok: true, message: "Email verified." });
}

// ---------------------------------------------------------------- helpers ----

export async function loadSessionUser(c: AppContext, userId: string) {
  const row = await DB.first<{
    id: string;
    email: string;
    phone: string | null;
    display_name: string;
    role: UserAuthRow["role"];
    status: UserAuthRow["status"];
    email_verified_at: string | null;
    created_at: string;
  }>(
    c.env,
    "SELECT id, email, phone, display_name, role, status, email_verified_at, created_at FROM users WHERE id = ?",
    [userId],
  );
  if (!row) throw ApiError.notFound("Account not found.");
  return {
    id: row.id,
    email: row.email,
    phone: row.phone,
    displayName: row.display_name,
    role: row.role,
    emailVerified: row.email_verified_at !== null,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function membershipsFor(c: AppContext, userId: string) {
  const rows = await DB.all<{
    business_id: string;
    business_name: string;
    business_slug: string;
    role: "owner" | "manager" | "agent" | "marketing";
    plan: "free" | "growth" | "pro";
    status: string;
  }>(
    c.env,
    `SELECT m.business_id, b.name AS business_name, b.slug AS business_slug, m.role, b.plan, b.status
       FROM memberships m JOIN businesses b ON b.id = m.business_id
      WHERE m.user_id = ? AND m.status = 'active'
      ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END, b.name`,
    [userId],
  );
  return rows.map((r) => ({
    businessId: r.business_id,
    businessName: r.business_name,
    businessSlug: r.business_slug,
    role: r.role,
    plan: r.plan,
    status: r.status,
  }));
}

async function issueEmailVerification(
  c: AppContext,
  userId: string,
  email: string,
  displayName: string,
): Promise<void> {
  const token = randomToken(32);
  await DB.run(
    c.env,
    `INSERT INTO action_tokens (id, user_id, kind, token_hash, expires_at, created_at)
     VALUES (?, ?, 'email_verify', ?, ?, ?)`,
    [
      newId("tok"),
      userId,
      await hashToken(token),
      new Date(Date.now() + 24 * 3600_000).toISOString(),
      nowIso(),
    ],
  );
  c.execution.waitUntil(
    sendMail(c.env, {
      to: isEmail(email) ? email : "",
      subject: "Verify your GainHub email",
      text: `Hi ${displayName}, confirm your email to finish setting up GainHub:\n\n${frontendUrl(c.env, `/auth/verify?token=${token}`)}`,
    }).catch(() => undefined),
  );
}

export async function pushNotification(
  c: { env: AppContext["env"]; execution?: AppContext["execution"] },
  userId: string,
  type: string,
  title: string,
  body: string,
  href: string | null,
  dedupeKey?: string,
): Promise<void> {
  await DB.run(
    c.env,
    `INSERT INTO notifications (id, user_id, type, title, body, href, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    [
      newId("ntf"),
      userId,
      type,
      title.slice(0, 160),
      body.slice(0, 600),
      href,
      dedupeKey ?? null,
      nowIso(),
    ],
  );
}
