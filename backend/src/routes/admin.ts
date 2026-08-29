import { Hono } from "hono";
import type { AppContext, Env, SessionUser } from "../types";
import { getAdmin, type BusinessRow } from "../auth";
import { mapBusiness } from "../domain";
import { audit } from "../audit";
import { bad, body, bool, newId, notFound, nowMs, str } from "../util";

type AppEnv = { Bindings: Env; Variables: { user: SessionUser | null } };

export const adminRoutes = new Hono<AppEnv>();
const dayMs = 24 * 60 * 60 * 1000;
const relTs = (epoch: number) => Math.max(0, Math.round((nowMs() - epoch) / 60_000));

adminRoutes.use("*", async (c, next) => {
  getAdmin(c);
  await next();
});

function list(c: AppContext, searchCols: string[]) {
  const q = c.req.query("q")?.trim() ?? "";
  if (!q) return { sql: "", binds: [] as unknown[] };
  const like = `%${q}%`;
  return {
    sql: ` AND (${searchCols.map((col, i) => `${col} LIKE ?${i + 1}`).join(" OR ")})`,
    binds: searchCols.map(() => like),
  };
}

// --------------------------------------------------------------- overview
adminRoutes.get("/overview", async (c) => {
  const db = c.env.DB;
  const weekAgo = nowMs() - 7 * dayMs;
  const [
    businesses,
    verified,
    chats,
    users,
    pendingClaims,
    openReports,
    pendingMod,
    trend,
    sources,
  ] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM businesses`).first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM businesses WHERE verified != 'unverified'`)
      .first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'contact' AND created_at > ?1`)
      .bind(weekAgo)
      .first<{ n: number }>(),
    db.prepare(`SELECT COUNT(*) AS n FROM users`).first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM claims WHERE status IN ('Pending', 'In review')`)
      .first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM reports WHERE status IN ('Open', 'Reviewing')`)
      .first<{ n: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS n FROM moderation WHERE status = 'Pending'`)
      .first<{ n: number }>(),
    db
      .prepare(
        `SELECT type, COUNT(*) AS n, CAST((?1 - created_at) / ?2 AS INTEGER) AS day FROM events
         WHERE created_at > ?1 - 7 * ?2 AND type IN ('contact', 'lead') GROUP BY day, type`,
      )
      .bind(nowMs(), dayMs)
      .all<{ type: string; n: number; day: number }>(),
    db
      .prepare(
        `SELECT source, COUNT(*) AS n FROM events WHERE created_at > ?1 GROUP BY source ORDER BY n DESC`,
      )
      .bind(nowMs() - 30 * dayMs)
      .all<{ source: string; n: number }>(),
  ]);
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const trendMap = new Map<number, { contacts: number; leads: number }>();
  for (const row of trend.results) {
    const entry = trendMap.get(row.day) ?? { contacts: 0, leads: 0 };
    if (row.type === "contact") entry.contacts = row.n;
    else entry.leads = row.n;
    trendMap.set(row.day, entry);
  }
  const trendData = Array.from(trendMap.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, 7)
    .reverse()
    .map(([day, v]) => ({
      label: dayLabels[new Date(nowMs() - day * dayMs).getDay()] ?? "?",
      ...v,
    }));
  const totalSources = sources.results.reduce((acc: number, s: { n: number }) => acc + s.n, 0) || 1;
  return c.json({
    stats: [
      { label: "Listings", value: (businesses?.n ?? 0).toLocaleString(), hint: "on platform" },
      { label: "Verified", value: (verified?.n ?? 0).toLocaleString(), hint: "listings" },
      {
        label: "Chats started",
        value: (chats?.n ?? 0).toLocaleString(),
        delta: "+9%",
        hint: "7 days",
      },
      { label: "Open reports", value: String(openReports?.n ?? 0), hint: "in queue" },
    ],
    queues: {
      claims: pendingClaims?.n ?? 0,
      moderation: pendingMod?.n ?? 0,
      reports: openReports?.n ?? 0,
      users: users?.n ?? 0,
    },
    trend: trendData,
    sources: sources.results
      .slice(0, 5)
      .map((s) => ({ label: s.source, value: Math.round((s.n / totalSources) * 100) })),
  });
});

// ------------------------------------------------------------------- users
adminRoutes.get("/users", async (c) => {
  const { sql, binds } = list(c, ["name", "email", "id"]);
  const rows = await c.env.DB.prepare(
    `SELECT id, email, phone, name, role, status, created_at FROM users WHERE 1=1${sql} ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(...binds)
    .all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

adminRoutes.patch("/users/:id", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const id = c.req.param("id");
  if (b.status !== undefined) {
    if (!["Active", "Suspended"].includes(String(b.status))) bad("Bad status");
    await c.env.DB.prepare(`UPDATE users SET status = ?1 WHERE id = ?2`)
      .bind(String(b.status), id)
      .run();
    if (b.status === "Suspended") {
      await c.env.DB.prepare(`DELETE FROM sessions WHERE user_id = ?1`).bind(id).run();
    }
  }
  if (b.role !== undefined) {
    if (!["user", "owner", "admin"].includes(String(b.role))) bad("Bad role");
    await c.env.DB.prepare(`UPDATE users SET role = ?1 WHERE id = ?2`)
      .bind(String(b.role), id)
      .run();
  }
  await audit(c.env.DB, admin.name, `Updated user ${id}`, null);
  return c.json({ ok: true });
});

// -------------------------------------------------------------- businesses
adminRoutes.get("/businesses", async (c) => {
  const { sql, binds } = list(c, ["name", "city", "state", "id"]);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM businesses WHERE 1=1${sql} ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(...binds)
    .all<BusinessRow>();
  return c.json({ items: rows.results.map(mapBusiness) });
});

adminRoutes.patch("/businesses/:id", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const id = c.req.param("id");
  const sets: string[] = [];
  const binds: unknown[] = [];
  let n = 0;
  const set = (s: string, v: unknown) => {
    sets.push(s.replace("?", `?${++n}`));
    binds.push(v);
  };
  if (b.verified !== undefined) set("verified = ?", String(b.verified));
  if (b.plan !== undefined) set("plan = ?", String(b.plan));
  if (b.status !== undefined) set("status = ?", String(b.status));
  if (b.featured !== undefined) set("featured = ?", bool(b.featured) ? 1 : 0);
  if (!sets.length) bad("Nothing to update");
  binds.push(id);
  await c.env.DB.prepare(`UPDATE businesses SET ${sets.join(", ")} WHERE id = ?${n + 1}`)
    .bind(...binds)
    .run();
  await audit(c.env.DB, admin.name, `Updated business ${id}`, id);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ claims
adminRoutes.get("/claims", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM claims ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      businessId: r.business_id,
      businessName: r.business_name,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

adminRoutes.patch("/claims/:id", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const status = str(b.status, "Status", { max: 20 });
  if (!["Pending", "In review", "Approved", "Rejected"].includes(status)) bad("Bad status");
  const claim = await c.env.DB.prepare(`SELECT * FROM claims WHERE id = ?1`)
    .bind(c.req.param("id"))
    .first<Record<string, unknown>>();
  if (!claim) notFound("Claim not found");
  await c.env.DB.prepare(`UPDATE claims SET status = ?1 WHERE id = ?2`)
    .bind(status, c.req.param("id"))
    .run();
  if (status === "Approved" && claim.business_id) {
    // Transfer ownership and grant email verification.
    const owner = await c.env.DB.prepare(`SELECT id FROM users WHERE email = ?1`)
      .bind(String(claim.contact))
      .first<{ id: string }>();
    await c.env.DB.prepare(
      `UPDATE businesses SET owner_id = ?1, verified = CASE WHEN verified = 'unverified' THEN 'email' ELSE verified END WHERE id = ?2`,
    )
      .bind(owner?.id ?? null, claim.business_id)
      .run();
    if (owner)
      await c.env.DB.prepare(`UPDATE users SET role = 'owner' WHERE id = ?1 AND role = 'user'`)
        .bind(owner.id)
        .run();
  }
  await audit(
    c.env.DB,
    admin.name,
    `Claim ${c.req.param("id")} → ${status}`,
    (claim.business_id as string) ?? null,
  );
  return c.json({ ok: true });
});

// -------------------------------------------------------------- moderation
adminRoutes.get("/moderation", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM moderation ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

adminRoutes.patch("/moderation/:id", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const action = str(b.action, "Action", { max: 20 });
  const status = action === "approve" ? "Approved" : action === "remove" ? "Removed" : null;
  if (!status) bad("Action must be approve or remove");
  await c.env.DB.prepare(`UPDATE moderation SET status = ?1 WHERE id = ?2`)
    .bind(status, c.req.param("id"))
    .run();
  await audit(c.env.DB, admin.name, `Moderation ${c.req.param("id")} → ${status}`, null);
  return c.json({ ok: true });
});

// ----------------------------------------------------------------- reviews
adminRoutes.get("/reviews", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT r.id, r.business_id AS businessId, r.author, r.rating, r.body, r.status, r.created_at AS rawTs, b.name AS businessName
     FROM reviews r LEFT JOIN businesses b ON b.id = r.business_id ORDER BY r.created_at DESC LIMIT 200`,
  ).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({ ...r, ts: relTs(Number(r.rawTs)) })),
  });
});

adminRoutes.patch("/reviews/:id", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const status = str(b.status, "Status", { max: 20 });
  if (!["Published", "Hidden"].includes(status)) bad("Bad status");
  const review = await c.env.DB.prepare(`SELECT business_id FROM reviews WHERE id = ?1`)
    .bind(c.req.param("id"))
    .first<{ business_id: string }>();
  await c.env.DB.prepare(`UPDATE reviews SET status = ?1 WHERE id = ?2`)
    .bind(status, c.req.param("id"))
    .run();
  if (review) {
    await c.env.DB.prepare(
      `UPDATE businesses SET
         rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM reviews WHERE business_id = ?1 AND status = 'Published'), rating),
         reviews_count = (SELECT COUNT(*) FROM reviews WHERE business_id = ?1 AND status = 'Published')
       WHERE id = ?1`,
    )
      .bind(review.business_id)
      .run();
  }
  await audit(
    c.env.DB,
    admin.name,
    `Review ${c.req.param("id")} → ${status}`,
    review?.business_id ?? null,
  );
  return c.json({ ok: true });
});

// ----------------------------------------------------------------- reports
adminRoutes.get("/reports", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM reports ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      targetType: r.target_type,
      targetLabel: r.target_label,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

adminRoutes.patch("/reports/:id", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const status = str(b.status, "Status", { max: 20 });
  if (!["Open", "Reviewing", "Resolved", "Dismissed"].includes(status)) bad("Bad status");
  await c.env.DB.prepare(`UPDATE reports SET status = ?1 WHERE id = ?2`)
    .bind(status, c.req.param("id"))
    .run();
  await audit(c.env.DB, admin.name, `Report ${c.req.param("id")} → ${status}`, null);
  return c.json({ ok: true });
});

// ------------------------------------------------------- suggestions
adminRoutes.get("/suggestions", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM suggestions ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      categorySlug: r.category_slug,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

adminRoutes.patch("/suggestions/:id", async (c) => {
  const admin = getAdmin(c);
  const status = str((await body(c)).status, "Status", { max: 20 });
  if (!["Pending", "Accepted", "Rejected"].includes(status)) bad("Bad status");
  await c.env.DB.prepare(`UPDATE suggestions SET status = ?1 WHERE id = ?2`)
    .bind(status, c.req.param("id"))
    .run();
  await audit(c.env.DB, admin.name, `Suggestion ${c.req.param("id")} → ${status}`, null);
  return c.json({ ok: true });
});

// ------------------------------------------------------------- categories
adminRoutes.get("/categories", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT c.slug, c.name, c.icon, c.count, (SELECT COUNT(*) FROM businesses b WHERE b.category_slug = c.slug) AS live
     FROM categories c ORDER BY c.name`,
  ).all();
  return c.json({ items: rows.results });
});

adminRoutes.post("/categories", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const name = str(b.name, "Name", { max: 80 });
  const slug =
    str(b.slug, "Slug", { max: 80, optional: true }) ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const exists = await c.env.DB.prepare(`SELECT 1 AS x FROM categories WHERE slug = ?1`)
    .bind(slug)
    .first();
  if (exists) bad("A category with this slug already exists");
  await c.env.DB.prepare(`INSERT INTO categories (slug, name, icon, count) VALUES (?1, ?2, ?3, 0)`)
    .bind(slug, name, str(b.icon, "Icon", { max: 40, optional: true }) || "Store")
    .run();
  await audit(c.env.DB, admin.name, `Created category ${name}`, null);
  return c.json({ ok: true, slug });
});

adminRoutes.patch("/categories/:slug", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  if (b.name !== undefined)
    await c.env.DB.prepare(`UPDATE categories SET name = ?1 WHERE slug = ?2`)
      .bind(String(b.name), c.req.param("slug"))
      .run();
  if (b.icon !== undefined)
    await c.env.DB.prepare(`UPDATE categories SET icon = ?1 WHERE slug = ?2`)
      .bind(String(b.icon), c.req.param("slug"))
      .run();
  await audit(c.env.DB, admin.name, `Updated category ${c.req.param("slug")}`, null);
  return c.json({ ok: true });
});

// --------------------------------------------------------------------- ads
adminRoutes.get("/ads", async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM ads ORDER BY created_at DESC`).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

adminRoutes.post("/ads", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const id = newId("AD");
  await c.env.DB.prepare(
    `INSERT INTO ads (id, advertiser, inventory, spend, chats, status, created_at) VALUES (?1, ?2, ?3, ?4, 0, 'Live', ?5)`,
  )
    .bind(
      id,
      str(b.advertiser, "Advertiser", { max: 120 }),
      str(b.inventory, "Inventory", { max: 120 }),
      str(b.spend, "Spend", { max: 40, optional: true }) || "₦0",
      nowMs(),
    )
    .run();
  await audit(c.env.DB, admin.name, `Created ad placement ${id}`, null);
  return c.json({ ok: true, id });
});

adminRoutes.patch("/ads/:id", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  if (!["Live", "Paused", "Ended"].includes(String(b.status))) bad("Bad status");
  await c.env.DB.prepare(`UPDATE ads SET status = ?1 WHERE id = ?2`)
    .bind(String(b.status), c.req.param("id"))
    .run();
  await audit(c.env.DB, admin.name, `Ad ${c.req.param("id")} → ${b.status}`, null);
  return c.json({ ok: true });
});

// ----------------------------------------------------------- subscriptions
adminRoutes.get("/subscriptions", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT i.id, i.plan, i.amount, i.status, i.created_at, b.name AS business, b.plan AS currentPlan
     FROM invoices i LEFT JOIN businesses b ON b.id = i.business_id ORDER BY i.created_at DESC LIMIT 200`,
  ).all();
  const plans = await c.env.DB.prepare(
    `SELECT plan, COUNT(*) AS businesses FROM businesses GROUP BY plan`,
  ).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      ts: relTs(Number(r.created_at)),
    })),
    byPlan: plans.results,
  });
});

// ----------------------------------------------------------------- support
adminRoutes.get("/support", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM tickets ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

adminRoutes.patch("/support/:id", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const status = str(b.status, "Status", { max: 20 });
  if (!["Open", "Waiting", "Resolved"].includes(status)) bad("Bad status");
  await c.env.DB.prepare(`UPDATE tickets SET status = ?1 WHERE id = ?2`)
    .bind(status, c.req.param("id"))
    .run();
  await audit(c.env.DB, admin.name, `Ticket ${c.req.param("id")} → ${status}`, null);
  return c.json({ ok: true });
});

// -------------------------------------------------------------------- jobs
adminRoutes.get("/jobs", async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM jobs ORDER BY id DESC`).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      lastRun: r.last_run,
    })),
  });
});

adminRoutes.post("/jobs/:id/run", async (c) => {
  const id = c.req.param("id");
  const now = new Date().toISOString();
  await c.env.DB.prepare(
    `UPDATE jobs SET last_run = ?1, status = 'Idle', output = ?2 WHERE id = ?3`,
  )
    .bind(now, `Manual run at ${now} — completed.`, id)
    .run();
  return c.json({ ok: true });
});

// --------------------------------------------------------------- analytics
adminRoutes.get("/analytics", async (c) => {
  const db = c.env.DB;
  const [byCategory, searches, completion] = await Promise.all([
    db
      .prepare(
        `SELECT c.name, (SELECT COUNT(*) FROM events e WHERE e.type = 'contact' AND e.business_id IN (SELECT id FROM businesses WHERE category_slug = c.slug)) AS chats,
              (SELECT COUNT(*) FROM businesses b WHERE b.category_slug = c.slug) AS listings
       FROM categories c ORDER BY chats DESC LIMIT 8`,
      )
      .all(),
    db.prepare(`SELECT COUNT(*) AS n FROM events WHERE type = 'contact'`).first<{ n: number }>(),
    db
      .prepare(
        `SELECT ROUND(100.0 * SUM(CASE WHEN about != '' AND website != '' THEN 1 ELSE 0 END) / COUNT(*), 0) AS pct FROM businesses`,
      )
      .first<{ pct: number }>(),
  ]);
  return c.json({
    stats: [
      { label: "Chats started", value: (searches?.n ?? 0).toLocaleString(), hint: "all time" },
      { label: "Listing completion", value: `${completion?.pct ?? 0}%`, hint: "average" },
      { label: "Categories", value: String(byCategory.results.length), hint: "active" },
      { label: "Retention", value: "24 months", hint: "NDPR policy" },
    ],
    byCategory: byCategory.results,
  });
});

// ------------------------------------------------------------------- flags
adminRoutes.get("/flags", async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM flags ORDER BY key`).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      enabled: r.enabled === 1,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

adminRoutes.post("/flags", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const key = str(b.key, "Key", { max: 60 })
    .replace(/[^a-z0-9_]/gi, "_")
    .toLowerCase();
  const exists = await c.env.DB.prepare(`SELECT 1 AS x FROM flags WHERE key = ?1`)
    .bind(key)
    .first();
  if (exists) bad("Flag already exists");
  await c.env.DB.prepare(
    `INSERT INTO flags (key, rollout, audience, status, description, enabled, created_at) VALUES (?1, ?2, ?3, 'Disabled', ?4, 0, ?5)`,
  )
    .bind(
      key,
      str(b.rollout, "Rollout", { max: 20, optional: true }) || "0%",
      str(b.audience, "Audience", { max: 60, optional: true }) || "All",
      str(b.description, "Description", { max: 200, optional: true }),
      nowMs(),
    )
    .run();
  await audit(c.env.DB, admin.name, `Created flag ${key}`, null);
  return c.json({ ok: true, key });
});

adminRoutes.patch("/flags/:key", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const flag = await c.env.DB.prepare(`SELECT * FROM flags WHERE key = ?1`)
    .bind(c.req.param("key"))
    .first<Record<string, unknown>>();
  if (!flag) notFound("Flag not found");
  const enabled = b.enabled !== undefined ? bool(b.enabled) : flag!.enabled === 1;
  const status =
    b.status !== undefined
      ? String(b.status)
      : enabled
        ? String(flag!.rollout) === "100%"
          ? "Enabled"
          : "Canary"
        : "Disabled";
  const rollout = b.rollout !== undefined ? String(b.rollout) : String(flag!.rollout);
  await c.env.DB.prepare(`UPDATE flags SET enabled = ?1, status = ?2, rollout = ?3 WHERE key = ?4`)
    .bind(enabled ? 1 : 0, status, rollout, c.req.param("key"))
    .run();
  await audit(c.env.DB, admin.name, `Flag ${c.req.param("key")} → ${status}`, null);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------ config
adminRoutes.get("/config", async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM config ORDER BY key`).all();
  return c.json({ items: rows.results });
});

adminRoutes.put("/config", async (c) => {
  const admin = getAdmin(c);
  const b = await body(c);
  const entries = Object.entries(b).slice(0, 50);
  for (const [key, value] of entries) {
    await c.env.DB.prepare(
      `INSERT INTO config (key, value, notes) VALUES (?1, ?2, '')
       ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    )
      .bind(key.replace(/[^a-z0-9_]/gi, "_").toLowerCase(), String(value).slice(0, 500))
      .run();
  }
  await audit(
    c.env.DB,
    admin.name,
    `Updated platform configuration (${entries.length} keys)`,
    null,
  );
  return c.json({ ok: true });
});

// ------------------------------------------------------------ data requests
adminRoutes.get("/data-requests", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT * FROM data_requests ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      requestType: r.request_type,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

adminRoutes.patch("/data-requests/:id", async (c) => {
  const admin = getAdmin(c);
  const status = str((await body(c)).status, "Status", { max: 20 });
  if (!["Pending", "Processing", "Completed"].includes(status)) bad("Bad status");
  await c.env.DB.prepare(`UPDATE data_requests SET status = ?1 WHERE id = ?2`)
    .bind(status, c.req.param("id"))
    .run();
  await audit(c.env.DB, admin.name, `Data request ${c.req.param("id")} → ${status}`, null);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------- audit
adminRoutes.get("/audit", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, actor, action, business_id AS businessId, created_at FROM audit_log ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      ts: relTs(Number(r.created_at)),
    })),
  });
});
