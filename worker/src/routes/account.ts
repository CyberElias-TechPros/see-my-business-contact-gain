import { z } from "zod";

import { joinInput } from "../../../shared/api.ts";
import { normalizeNigerianPhone } from "../../../shared/domain.ts";
import { csrfTokenFor, requireUser, sessionCookie, startSession } from "../auth.ts";
import { hashPassword } from "../crypto.ts";
import { DB } from "../db-access.ts";
import { newId, nowIso } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseBody } from "../http.ts";
import { notify } from "../notifications.ts";
import { enforceLimit, limitIdentity } from "../ratelimit.ts";
import { ensureUniqueSlug } from "./workspace.ts";
import { loadSessionUser, membershipsFor } from "./auth.ts";
import type { AppContext } from "../types.ts";

/**
 * One request takes a trader from "no account" to "draft listing in the console".
 * The prototype asked for the same data in two screens and created neither, so the
 * steps are collapsed here — but the listing stays a draft: publishing is a
 * deliberate, validated action (see workspace.publish), not a side effect of signup.
 */
export async function joinWithBusiness(c: AppContext): Promise<Response> {
  const input = await parseBody(joinInput, c.request);
  await enforceLimit(c.env, "register", limitIdentity(null, c.ipHash));

  const email = input.email.toLowerCase();
  const phone = normalizeNigerianPhone(input.phone);
  if (!phone)
    throw ApiError.validation({ phone: "Use a valid Nigerian number, e.g. 0803 000 0000." });

  const existing = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM users WHERE email_normalized = ?",
    [email],
  );
  if (existing) {
    throw ApiError.conflict(
      "An account already uses this email. Sign in and add your business from the console.",
      {
        email: "Already registered.",
      },
    );
  }

  const category = await DB.first<{ id: string; slug: string }>(
    c.env,
    "SELECT id, slug FROM categories WHERE slug = ? AND is_active = 1",
    [input.categorySlug],
  );
  if (!category) throw ApiError.validation({ categorySlug: "Choose a category from the list." });

  const city = input.city.trim();
  const duplicate = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM businesses WHERE lower(name) = lower(?) AND lower(city) = lower(?)",
    [input.businessName, city],
  );
  if (duplicate) {
    throw ApiError.conflict(
      "A listing with that name already exists in this city. Claim it instead of duplicating it.",
      {
        businessName: "Already listed here.",
      },
    );
  }

  const now = nowIso();
  const userId = newId("usr");
  const businessId = newId("biz");
  const slug = await ensureUniqueSlug(c, input.businessName, "");
  const passwordHash = await hashPassword(input.password);

  await DB.write(c.env, [
    {
      sql: `INSERT INTO users (id, email, email_normalized, phone, password_hash, display_name, role, status, created_at, updated_at, marketing_opt_in)
            VALUES (?, ?, ?, ?, ?, ?, 'owner', 'active', ?, ?, 0)`,
      params: [userId, email, email, phone, passwordHash, input.displayName, now, now],
    },
    {
      // The directory's public copy is deliberately thin at signup: tagline, about,
      // hours and media are the owner's next actions, and completeness tracks them.
      sql: `INSERT INTO businesses (id, slug, owner_user_id, name, category_id, city, state, phone, whatsapp,
              verified_level, plan, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', 'free', 'draft', ?, ?)`,
      params: [
        businessId,
        slug,
        userId,
        input.businessName.trim(),
        category.id,
        city,
        input.state.trim(),
        phone,
        phone,
        now,
        now,
      ],
    },
    {
      sql: `INSERT INTO memberships (user_id, business_id, role, status, invited_at, joined_at)
            VALUES (?, ?, 'owner', 'active', ?, ?)`,
      params: [userId, businessId, now, now],
    },
    {
      sql: `INSERT INTO business_settings (business_id, autoack_message, notify_new_enquiry, updated_at)
            VALUES (?, ?, 1, ?) ON CONFLICT (business_id) DO NOTHING`,
      params: [
        businessId,
        `Thank you for contacting ${input.businessName.trim()}. We usually reply on WhatsApp within a few hours.`,
        now,
      ],
    },
  ]);

  const session = await startSession(
    c.env,
    { id: userId, session_version: 0 },
    { userAgent: c.request.headers.get("user-agent"), ipHash: c.ipHash },
  );
  await notify(c.env, {
    userId,
    businessId,
    kind: "verification_decision",
    title: "Your listing is saved as a draft",
    body: "Add a photo, opening hours and one service, then publish. Verified listings get about three times more enquiries.",
    href: "/app/profile",
    dedupeKey: `welcome:${userId}`,
  });

  c.log("info", "join_completed", { userId, businessId, category: category.slug });
  return json(
    {
      ok: true,
      session: {
        user: await loadSessionUser(c, userId),
        memberships: await membershipsFor(c, userId),
        csrfToken: await csrfTokenFor(c.env, session.sessionId),
      },
      business: { id: businessId, slug, status: "draft" as const },
      next: { label: "Complete your profile", href: "/app/profile" },
    },
    {
      status: 201,
      headers: { "set-cookie": sessionCookie(c.env, session.sessionId, session.token) },
    },
  );
}

export async function listNotifications(c: AppContext): Promise<Response> {
  const user = requireUser(c).user;
  const limit = Math.min(50, Math.max(1, Number(c.url.searchParams.get("limit")) || 20));
  const rows = await DB.all<{
    id: string;
    type: string;
    title: string;
    body: string;
    href: string | null;
    read_at: string | null;
    created_at: string;
  }>(
    c.env,
    `SELECT id, type, title, body, href, read_at, created_at FROM notifications
      WHERE user_id = ? ${c.url.searchParams.get("unread") === "1" ? "AND read_at IS NULL" : ""}
      ORDER BY created_at DESC LIMIT ?`,
    [user.id, limit],
  );
  return json({
    items: rows.map((row) => ({
      id: row.id,
      kind: row.type,
      title: row.title,
      body: row.body,
      href: row.href,
      read: row.read_at != null,
      createdAt: row.created_at,
    })),
    unread: await DB.count(
      c.env,
      "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL",
      [user.id],
    ),
  });
}

const notificationAction = z.object({ ids: z.array(z.string().max(40)).max(50).optional() });

export async function markNotificationsRead(c: AppContext): Promise<Response> {
  const user = requireUser(c).user;
  const input = await parseBody(notificationAction, c.request).catch(() => ({
    ids: undefined as string[] | undefined,
  }));
  const now = nowIso();
  if (input.ids?.length) {
    await DB.run(
      c.env,
      `UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL AND id IN (${input.ids.map(() => "?").join(",")})`,
      [now, user.id, ...input.ids],
    );
  } else {
    await DB.run(
      c.env,
      "UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL",
      [now, user.id],
    );
  }
  return json({ ok: true });
}

export async function unreadCount(c: AppContext): Promise<Response> {
  const user = requireUser(c).user;
  return json({
    unread: await DB.count(
      c.env,
      "SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL",
      [user.id],
    ),
  });
}
