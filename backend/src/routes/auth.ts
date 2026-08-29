import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import {
  createSession,
  clearSession,
  getUser,
  toSessionUser,
  verifyPassword,
  hashPassword,
} from "../auth";
import { bad, body, clientIp, nowMs, rateLimit, str, validEmail, validPassword } from "../util";

type AppEnv = { Bindings: Env; Variables: { user: SessionUser | null } };

export const authRoutes = new Hono<AppEnv>();

authRoutes.post("/auth/signup", async (c) => {
  const db = c.env.DB;
  await rateLimit(db, clientIp(c), "auth:signup", 10, 60_000);
  const b = await body(c);
  const name = str(b.name, "Full name", { max: 120 });
  const email = validEmail(b.email);
  const password = validPassword(b.password);
  const phone = str(b.phone, "Phone", { max: 40, optional: true }) || null;

  const existing = await db
    .prepare(`SELECT id FROM users WHERE email = ?1`)
    .bind(email)
    .first<{ id: string }>();
  if (existing) bad("An account with this email already exists — try signing in instead", 409);

  const id = `U-${nowMs().toString(36).toUpperCase()}`;
  const hash = await hashPassword(password);
  await db
    .prepare(
      `INSERT INTO users (id, email, phone, name, password_hash, role, status, whatsapp, created_at)
       VALUES (?1, ?2, ?3, ?4, ?5, 'user', 'Active', ?6, ?7)`,
    )
    .bind(id, email, phone, name, hash, phone, nowMs())
    .run();
  await createSession(c, id);
  const row = await db.prepare(`SELECT * FROM users WHERE id = ?1`).bind(id).first();
  return c.json({ user: row ? toSessionUser(row as never) : null });
});

authRoutes.post("/auth/signin", async (c) => {
  const db = c.env.DB;
  await rateLimit(db, clientIp(c), "auth:signin", 15, 60_000);
  const b = await body(c);
  const email = validEmail(b.email);
  const password = str(b.password, "Password", { max: 200 });
  const row = await db
    .prepare(`SELECT * FROM users WHERE email = ?1`)
    .bind(email)
    .first<Record<string, string>>();
  if (!row || !(await verifyPassword(password, String(row.password_hash)))) {
    bad("Incorrect email or password", 401);
  }
  if (row?.status === "Suspended") bad("This account has been suspended", 403);
  await createSession(c, String(row?.id));
  const { password_hash: _drop, ...safe } = row as Record<string, unknown>;
  return c.json({ user: toSessionUser(safe as never) });
});

authRoutes.post("/auth/signout", (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

authRoutes.get("/auth/me", (c) => {
  const user = c.get("user");
  return c.json({ user: user ?? null });
});

authRoutes.patch("/me", async (c) => {
  const user = getUser(c);
  const b = await body(c);
  const name = str(b.name, "Name", { max: 120, optional: true }) || user.name;
  const whatsapp = str(b.whatsapp, "WhatsApp", { max: 40, optional: true }) || user.whatsapp;
  let prefs = user.prefs;
  if (b.prefs && typeof b.prefs === "object")
    prefs = { ...prefs, ...(b.prefs as Record<string, unknown>) };
  await c.env.DB.prepare(`UPDATE users SET name = ?1, whatsapp = ?2, prefs = ?3 WHERE id = ?4`)
    .bind(name, whatsapp, JSON.stringify(prefs), user.id)
    .run();
  return c.json({ ok: true });
});
