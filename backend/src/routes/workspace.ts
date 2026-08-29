import { Hono } from "hono";
import type { AppContext, Env, SessionUser } from "../types";
import { getOwnedBusiness, getUser, type BusinessRow } from "../auth";
import { mapBusiness } from "../domain";
import { audit } from "../audit";
import {
  bad,
  body,
  bool,
  int,
  newId,
  notFound,
  nowMs,
  nairaToNumber,
  parseJson,
  str,
} from "../util";

type AppEnv = { Bindings: Env; Variables: { user: SessionUser | null } };

export const workspaceRoutes = new Hono<AppEnv>();

// All workspace routes require a session and resolve the user's business.
workspaceRoutes.use("*", async (c, next) => {
  getUser(c);
  await next();
});

const dayMs = 24 * 60 * 60 * 1000;

function relTs(epoch: number): number {
  return Math.max(0, Math.round((nowMs() - epoch) / 60_000));
}

async function resolveBusiness(c: AppContext): Promise<BusinessRow> {
  return getOwnedBusiness(c);
}

// ---------------------------------------------------------------- summary
workspaceRoutes.get("/summary", async (c) => {
  const db = c.env.DB;
  const biz = await resolveBusiness(c);
  const weekAgo = nowMs() - 7 * dayMs;
  const [contacts7, contactsPrev7, leadsOpen, wonValue, unread, trend, sources, latestLeads] =
    await Promise.all([
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM events WHERE business_id = ?1 AND type = 'contact' AND created_at > ?2`,
        )
        .bind(biz.id, weekAgo)
        .first<{ n: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS n FROM events WHERE business_id = ?1 AND type = 'contact' AND created_at > ?2 AND created_at <= ?3`,
        )
        .bind(biz.id, weekAgo - 7 * dayMs, weekAgo)
        .first<{ n: number }>(),
      db
        .prepare(`SELECT COUNT(*) AS n FROM leads WHERE business_id = ?1 AND created_at > ?2`)
        .bind(biz.id, weekAgo)
        .first<{ n: number }>(),
      db
        .prepare(`SELECT COUNT(*) AS n FROM leads WHERE business_id = ?1 AND stage = 'Won'`)
        .bind(biz.id)
        .first<{ n: number }>(),
      db
        .prepare(`SELECT COALESCE(SUM(unread), 0) AS n FROM conversations WHERE business_id = ?1`)
        .bind(biz.id)
        .first<{ n: number }>(),
      db
        .prepare(
          `SELECT type, COUNT(*) AS n, CAST((?2 - created_at) / ?3 AS INTEGER) AS day FROM events
         WHERE business_id = ?1 AND created_at > ?2 - 7 * ?3 AND type IN ('contact', 'lead') GROUP BY day, type`,
        )
        .bind(biz.id, nowMs(), dayMs)
        .all<{ type: string; n: number; day: number }>(),
      db
        .prepare(
          `SELECT source, COUNT(*) AS n FROM events WHERE business_id = ?1 AND created_at > ?2 GROUP BY source ORDER BY n DESC`,
        )
        .bind(biz.id, nowMs() - 30 * dayMs)
        .all<{ source: string; n: number }>(),
      db
        .prepare(`SELECT * FROM leads WHERE business_id = ?1 ORDER BY created_at DESC LIMIT 6`)
        .bind(biz.id)
        .all(),
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
  const sourceData = sources.results.slice(0, 5).map((s) => ({
    label: s.source,
    value: Math.round((s.n / totalSources) * 100),
  }));

  const prev = contactsPrev7?.n ?? 0;
  const curr = contacts7?.n ?? 0;
  const delta = prev === 0 ? 100 : Math.round(((curr - prev) / prev) * 100);

  return c.json({
    business: mapBusiness(biz),
    stats: [
      {
        label: "Contacts gained",
        value: biz.contacts_gained.toLocaleString(),
        delta: `${delta >= 0 ? "+" : ""}${delta}%`,
        hint: "this week",
      },
      { label: "New leads", value: String(leadsOpen?.n ?? 0), hint: "this week" },
      { label: "Reply time", value: `${biz.response_minutes}m 00s`, hint: "average" },
      { label: "Won deals", value: String(wonValue?.n ?? 0), hint: "all time" },
    ],
    trend: trendData.length ? trendData : [],
    sources: sourceData,
    latestLeads: (latestLeads.results as Record<string, unknown>[]).map(mapLead),
    unread: unread?.n ?? 0,
  });
});

type LeadRow = Record<string, unknown>;
function mapLead(r: LeadRow) {
  return {
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    source: r.source,
    channel: r.channel,
    stage: r.stage,
    value: r.value,
    agent: r.agent,
    score: r.score,
    ts: relTs(Number(r.created_at)),
  };
}
function mapTask(r: Record<string, unknown>) {
  return { ...r, businessId: r.business_id, done: r.done === 1, ts: relTs(Number(r.created_at)) };
}
function mapCampaign(r: Record<string, unknown>) {
  return {
    id: r.id,
    businessId: r.business_id,
    name: r.name,
    channel: r.channel,
    scans: r.scans,
    leads: r.leads,
    cost: r.cost,
    cpl:
      Number(r.scans) > 0 && nairaToNumber(String(r.cost)) > 0 && Number(r.leads) > 0
        ? `₦${Math.round(nairaToNumber(String(r.cost)) / Number(r.leads)).toLocaleString()}`
        : "₦0",
    status: r.status,
    ts: relTs(Number(r.created_at)),
  };
}
function mapLink(r: Record<string, unknown>) {
  return {
    id: r.id,
    businessId: r.business_id,
    label: r.label,
    code: r.code,
    scans: r.scans,
    source: r.source,
    ts: relTs(Number(r.created_at)),
  };
}

// ------------------------------------------------------------------- leads
workspaceRoutes.get("/leads", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM leads WHERE business_id = ?1 ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(biz.id)
    .all();
  return c.json({ items: rows.results.map(mapLead) });
});

workspaceRoutes.post("/leads", async (c) => {
  const user = getUser(c);
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const id = newId("LD");
  await c.env.DB.prepare(
    `INSERT INTO leads (id, business_id, name, source, channel, stage, value, agent, score, created_at, updated_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)`,
  )
    .bind(
      id,
      biz.id,
      str(b.name, "Name", { max: 120 }),
      str(b.source, "Source", { max: 120, optional: true }) || "Manual entry",
      str(b.channel, "Channel", { max: 60, optional: true }) || "WhatsApp",
      str(b.stage, "Stage", { max: 20, optional: true }) || "New",
      str(b.value, "Value", { max: 40, optional: true }),
      user.name,
      Math.min(100, Math.max(0, int(b.score, 50, { min: 0, max: 100 }))),
      nowMs(),
    )
    .run();
  await audit(c.env.DB, user.name, `Added lead ${id}`, biz.id);
  return c.json({ ok: true, id });
});

workspaceRoutes.patch("/leads/:id", async (c) => {
  const user = getUser(c);
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const sets: string[] = [];
  const binds: unknown[] = [];
  let n = 0;
  const set = (sql: string, v: unknown) => {
    sets.push(sql.replace("?", `?${++n}`));
    binds.push(v);
  };
  if (b.stage !== undefined) set("stage = ?", String(b.stage));
  if (b.agent !== undefined) set("agent = ?", String(b.agent));
  if (b.value !== undefined) set("value = ?", String(b.value));
  if (b.score !== undefined) set("score = ?", Math.min(100, Math.max(0, int(b.score, 50))));
  if (!sets.length) bad("Nothing to update");
  sets.push(`updated_at = ?${++n}`);
  binds.push(nowMs());
  binds.push(c.req.param("id"), biz.id);
  const res = await c.env.DB.prepare(
    `UPDATE leads SET ${sets.join(", ")} WHERE id = ?${n + 1} AND business_id = ?${n + 2}`,
  )
    .bind(...binds)
    .run();
  if ((res.meta?.changes ?? 0) === 0) notFound("Lead not found");
  await audit(c.env.DB, user.name, `Updated lead ${c.req.param("id")}`, biz.id);
  return c.json({ ok: true });
});

workspaceRoutes.delete("/leads/:id", async (c) => {
  const biz = await resolveBusiness(c);
  await c.env.DB.prepare(`DELETE FROM leads WHERE id = ?1 AND business_id = ?2`)
    .bind(c.req.param("id"), biz.id)
    .run();
  return c.json({ ok: true });
});

// ------------------------------------------------------------------- tasks
// ------------------------------------------------------- reviews & replies
workspaceRoutes.get("/reviews", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT id, business_id AS businessId, author, rating, body, reply, status, created_at AS ts
     FROM reviews WHERE business_id = ?1 ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(biz.id)
    .all();
  return c.json({ items: rows.results });
});

workspaceRoutes.patch("/reviews/:id", async (c) => {
  const user = getUser(c);
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const reply = str(b.reply, "Reply", { max: 600 });
  const review = await c.env.DB.prepare(`SELECT id FROM reviews WHERE id = ?1 AND business_id = ?2`)
    .bind(c.req.param("id"), biz.id)
    .first();
  if (!review) notFound("Review not found");
  await c.env.DB.prepare(`UPDATE reviews SET reply = ?1 WHERE id = ?2`)
    .bind(reply, c.req.param("id"))
    .run();
  await audit(c.env.DB, user.name, `Replied to a review on ${biz.id}`, biz.id);
  return c.json({ ok: true });
});

workspaceRoutes.get("/tasks", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM tasks WHERE business_id = ?1 ORDER BY done ASC, created_at DESC LIMIT 200`,
  )
    .bind(biz.id)
    .all();
  return c.json({ items: rows.results.map(mapTask) });
});

workspaceRoutes.post("/tasks", async (c) => {
  const user = getUser(c);
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const id = newId("T");
  await c.env.DB.prepare(
    `INSERT INTO tasks (id, business_id, title, due, owner, priority, done, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)`,
  )
    .bind(
      id,
      biz.id,
      str(b.title, "Task", { max: 200 }),
      str(b.due, "Due", { max: 60, optional: true }) || "Today",
      str(b.owner, "Owner", { max: 80, optional: true }) || user.name,
      str(b.priority, "Priority", { max: 10, optional: true }) || "Medium",
      nowMs(),
    )
    .run();
  return c.json({ ok: true, id });
});

workspaceRoutes.patch("/tasks/:id", async (c) => {
  const biz = await resolveBusiness(c);
  const b = await body(c);
  if (b.done === undefined) bad("Nothing to update");
  const res = await c.env.DB.prepare(
    `UPDATE tasks SET done = ?1 WHERE id = ?2 AND business_id = ?3`,
  )
    .bind(bool(b.done) ? 1 : 0, c.req.param("id"), biz.id)
    .run();
  if ((res.meta?.changes ?? 0) === 0) notFound("Task not found");
  return c.json({ ok: true });
});

workspaceRoutes.delete("/tasks/:id", async (c) => {
  const biz = await resolveBusiness(c);
  await c.env.DB.prepare(`DELETE FROM tasks WHERE id = ?1 AND business_id = ?2`).bind(
    c.req.param("id"),
    biz.id,
  );
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- contacts
workspaceRoutes.get("/contacts", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM contacts WHERE business_id = ?1 ORDER BY created_at DESC LIMIT 200`,
  )
    .bind(biz.id)
    .all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      businessId: r.business_id,
      tags: parseJson<string[]>(String(r.tags ?? "[]"), []),
      ts: relTs(Number(r.created_at)),
    })),
  });
});

workspaceRoutes.post("/contacts", async (c) => {
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const id = newId("CT");
  const tags = Array.isArray(b.tags) ? b.tags.map(String).slice(0, 10) : [];
  await c.env.DB.prepare(
    `INSERT INTO contacts (id, business_id, name, phone, email, tags, source, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(
      id,
      biz.id,
      str(b.name, "Name", { max: 120 }),
      str(b.phone, "Phone", { max: 40, optional: true }),
      str(b.email, "Email", { max: 120, optional: true }) || null,
      JSON.stringify(tags),
      str(b.source, "Source", { max: 120, optional: true }) || "Manual entry",
      nowMs(),
    )
    .run();
  return c.json({ ok: true, id });
});

workspaceRoutes.delete("/contacts/:id", async (c) => {
  const biz = await resolveBusiness(c);
  await c.env.DB.prepare(`DELETE FROM contacts WHERE id = ?1 AND business_id = ?2`).bind(
    c.req.param("id"),
    biz.id,
  );
  return c.json({ ok: true });
});

// ----------------------------------------------------------- conversations
workspaceRoutes.get("/conversations", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM conversations WHERE business_id = ?1 ORDER BY updated_at DESC LIMIT 100`,
  )
    .bind(biz.id)
    .all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      id: r.id,
      businessId: r.business_id,
      name: r.name,
      last: r.last,
      unread: r.unread,
      tag: r.tag,
      assigned: r.assigned,
      ts: relTs(Number(r.updated_at)),
    })),
  });
});

workspaceRoutes.get("/conversations/:id/messages", async (c) => {
  const biz = await resolveBusiness(c);
  const conv = await c.env.DB.prepare(
    `SELECT id FROM conversations WHERE id = ?1 AND business_id = ?2`,
  )
    .bind(c.req.param("id"), biz.id)
    .first();
  if (!conv) notFound("Conversation not found");
  const rows = await c.env.DB.prepare(
    `SELECT sender, body, created_at AS ts FROM messages WHERE conversation_id = ?1 ORDER BY created_at ASC`,
  )
    .bind(c.req.param("id"))
    .all();
  return c.json({ items: rows.results });
});

workspaceRoutes.post("/conversations/:id/messages", async (c) => {
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const text = str(b.body, "Message", { max: 4000 });
  const conv = await c.env.DB.prepare(
    `SELECT id FROM conversations WHERE id = ?1 AND business_id = ?2`,
  )
    .bind(c.req.param("id"), biz.id)
    .first();
  if (!conv) notFound("Conversation not found");
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO messages (conversation_id, sender, body, created_at) VALUES (?1, 'business', ?2, ?3)`,
    ).bind(c.req.param("id"), text, nowMs()),
    c.env.DB.prepare(
      `UPDATE conversations SET last = ?1, unread = 0, updated_at = ?2 WHERE id = ?3`,
    ).bind(text, nowMs(), c.req.param("id")),
  ]);
  return c.json({ ok: true });
});

workspaceRoutes.post("/conversations/:id/read", async (c) => {
  const biz = await resolveBusiness(c);
  await c.env.DB.prepare(
    `UPDATE conversations SET unread = 0 WHERE id = ?1 AND business_id = ?2`,
  ).bind(c.req.param("id"), biz.id);
  return c.json({ ok: true });
});

// --------------------------------------------------------------- campaigns
workspaceRoutes.get("/campaigns", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM campaigns WHERE business_id = ?1 ORDER BY created_at DESC`,
  )
    .bind(biz.id)
    .all();
  return c.json({ items: rows.results.map(mapCampaign) });
});

workspaceRoutes.post("/campaigns", async (c) => {
  const user = getUser(c);
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const id = newId("CMP");
  await c.env.DB.prepare(
    `INSERT INTO campaigns (id, business_id, name, channel, scans, leads, cost, status, created_at) VALUES (?1, ?2, ?3, ?4, 0, 0, ?5, 'Live', ?6)`,
  )
    .bind(
      id,
      biz.id,
      str(b.name, "Campaign name", { max: 120 }),
      str(b.channel, "Channel", { max: 60, optional: true }) || "WhatsApp link",
      str(b.cost, "Cost", { max: 40, optional: true }) || "₦0",
      nowMs(),
    )
    .run();
  await audit(c.env.DB, user.name, `Created campaign ${id}`, biz.id);
  return c.json({ ok: true, id });
});

workspaceRoutes.patch("/campaigns/:id", async (c) => {
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const res = await c.env.DB.prepare(
    `UPDATE campaigns SET status = ?1 WHERE id = ?2 AND business_id = ?3`,
  )
    .bind(str(b.status, "Status", { max: 20 }), c.req.param("id"), biz.id)
    .run();
  if ((res.meta?.changes ?? 0) === 0) notFound("Campaign not found");
  return c.json({ ok: true });
});

// ------------------------------------------------------------------- links
workspaceRoutes.get("/links", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM links WHERE business_id = ?1 ORDER BY created_at DESC`,
  )
    .bind(biz.id)
    .all();
  return c.json({ items: rows.results.map(mapLink) });
});

workspaceRoutes.post("/links", async (c) => {
  const user = getUser(c);
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const id = newId("LK");
  let code = str(b.code, "Code", { max: 60, optional: true }) || slugFor(biz.name);
  const taken = await c.env.DB.prepare(`SELECT 1 AS x FROM links WHERE code = ?1`)
    .bind(code)
    .first();
  if (taken) code = `${code}-${Math.floor(Math.random() * 900 + 100)}`;
  await c.env.DB.prepare(
    `INSERT INTO links (id, business_id, label, code, scans, source, created_at) VALUES (?1, ?2, ?3, ?4, 0, ?5, ?6)`,
  )
    .bind(
      id,
      biz.id,
      str(b.label, "Label", { max: 120 }),
      code,
      str(b.source, "Source", { max: 60, optional: true }) || "Directory",
      nowMs(),
    )
    .run();
  await audit(c.env.DB, user.name, `Created tracked link ${code}`, biz.id);
  return c.json({ ok: true, id, code });
});

function slugFor(v: string): string {
  return (
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "link"
  );
}

workspaceRoutes.delete("/links/:id", async (c) => {
  const biz = await resolveBusiness(c);
  await c.env.DB.prepare(`DELETE FROM links WHERE id = ?1 AND business_id = ?2`).bind(
    c.req.param("id"),
    biz.id,
  );
  return c.json({ ok: true });
});

// ------------------------------------------------------------- automations
workspaceRoutes.get("/automations", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM automations WHERE business_id = ?1 ORDER BY created_at DESC`,
  )
    .bind(biz.id)
    .all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      businessId: r.business_id,
      ts: relTs(Number(r.created_at)),
    })),
  });
});

workspaceRoutes.post("/automations", async (c) => {
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const id = newId("AU");
  await c.env.DB.prepare(
    `INSERT INTO automations (id, business_id, trigger, action, runs, status, created_at) VALUES (?1, ?2, ?3, ?4, 0, 'Active', ?5)`,
  )
    .bind(
      id,
      biz.id,
      str(b.trigger, "Trigger", { max: 200 }),
      str(b.action, "Action", { max: 300 }),
      nowMs(),
    )
    .run();
  return c.json({ ok: true, id });
});

workspaceRoutes.patch("/automations/:id", async (c) => {
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const status = b.status === "Active" || b.status === "Paused" ? String(b.status) : null;
  if (!status) bad("Status must be Active or Paused");
  await c.env.DB.prepare(
    `UPDATE automations SET status = ?1 WHERE id = ?2 AND business_id = ?3`,
  ).bind(status, c.req.param("id"), biz.id);
  return c.json({ ok: true });
});

// -------------------------------------------------------------------- team
workspaceRoutes.get("/team", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM team_members WHERE business_id = ?1 ORDER BY created_at ASC`,
  )
    .bind(biz.id)
    .all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => {
      const lastSeen =
        r.status === "Active"
          ? `${Math.max(1, Math.round((nowMs() - Number(r.created_at)) / 60000))}m ago`
          : "—";
      return { ...r, businessId: r.business_id, ts: relTs(Number(r.created_at)), lastSeen };
    }),
  });
});

workspaceRoutes.post("/team", async (c) => {
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const id = newId("TM");
  await c.env.DB.prepare(
    `INSERT INTO team_members (id, business_id, name, email, role, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 'Invited', ?6)`,
  )
    .bind(
      id,
      biz.id,
      str(b.name, "Name", { max: 120 }),
      str(b.email, "Email", { max: 160 }),
      str(b.role, "Role", { max: 60, optional: true }) || "Staff",
      nowMs(),
    )
    .run();
  return c.json({ ok: true, id });
});

workspaceRoutes.delete("/team/:id", async (c) => {
  const biz = await resolveBusiness(c);
  await c.env.DB.prepare(
    `DELETE FROM team_members WHERE id = ?1 AND business_id = ?2 AND role != 'Owner'`,
  ).bind(c.req.param("id"), biz.id);
  return c.json({ ok: true });
});

// ----------------------------------------------------------------- profile
workspaceRoutes.get("/profile", async (c) => {
  const biz = await resolveBusiness(c);
  return c.json({ business: mapBusiness(biz) });
});

workspaceRoutes.patch("/profile", async (c) => {
  const user = getUser(c);
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const fields: Record<string, unknown> = {};
  const simple = [
    "name",
    "tagline",
    "about",
    "categorySlug",
    "city",
    "state",
    "address",
    "whatsapp",
    "phone",
    "website",
  ] as const;
  for (const key of simple) {
    if (b[key] !== undefined)
      fields[key === "categorySlug" ? "category_slug" : key] = String(b[key]).slice(0, 4000);
  }
  if (b.openNow !== undefined) fields.open_now = bool(b.openNow) ? 1 : 0;
  for (const key of [
    "socials",
    "services",
    "products",
    "amenities",
    "serviceAreas",
    "gallery",
    "team",
  ] as const) {
    if (b[key] !== undefined) {
      if (!Array.isArray(b[key])) bad(`${key} must be a list`);
      fields[key === "serviceAreas" ? "service_areas" : key] = JSON.stringify(b[key]).slice(
        0,
        100_000,
      );
    }
  }
  const keys = Object.keys(fields);
  if (!keys.length) bad("Nothing to update");
  const sets = keys.map((k, i) => `${k} = ?${i + 1}`).join(", ");
  await c.env.DB.prepare(
    `UPDATE businesses SET ${sets}, updated_at = ?${keys.length + 1} WHERE id = ?${keys.length + 2}`,
  )
    .bind(...keys.map((k) => fields[k]), nowMs(), biz.id)
    .run();
  await audit(c.env.DB, user.name, `Updated business profile`, biz.id);
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- billing
workspaceRoutes.get("/invoices", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT * FROM invoices WHERE business_id = ?1 ORDER BY created_at DESC`,
  )
    .bind(biz.id)
    .all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      businessId: r.business_id,
      ts: relTs(Number(r.created_at)),
    })),
    plan: biz.plan,
  });
});

workspaceRoutes.post("/upgrade", async (c) => {
  const user = getUser(c);
  const biz = await resolveBusiness(c);
  const b = await body(c);
  const plan = str(b.plan, "Plan", { max: 20 });
  if (!["Free", "Growth", "Pro"].includes(plan)) bad("Unknown plan");
  const amount = plan === "Pro" ? "₦25,000" : plan === "Growth" ? "₦12,500" : "₦0";
  const id = newId("INV");
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO invoices (id, business_id, plan, amount, status, created_at) VALUES (?1, ?2, ?3, ?4, 'Pending', ?5)`,
    ).bind(id, biz.id, `${plan} — monthly`, amount, nowMs()),
    c.env.DB.prepare(
      `INSERT INTO tickets (id, subject, user, priority, status, created_at) VALUES (?1, ?2, ?3, 'Medium', 'Open', ?4)`,
    ).bind(
      newId("S"),
      `Plan change request: ${biz.plan} → ${plan} (${biz.name})`,
      user.name,
      nowMs(),
    ),
  ]);
  await audit(c.env.DB, user.name, `Requested upgrade to ${plan}`, biz.id);
  return c.json({
    ok: true,
    invoiceId: id,
    instructions: "Our billing team will confirm your payment and activate the plan.",
  });
});

// ------------------------------------------------------------------ audit
workspaceRoutes.get("/audit", async (c) => {
  const biz = await resolveBusiness(c);
  const rows = await c.env.DB.prepare(
    `SELECT id, actor, action, created_at AS ts FROM audit_log WHERE business_id = ?1 ORDER BY created_at DESC LIMIT 100`,
  )
    .bind(biz.id)
    .all();
  return c.json({
    items: rows.results.map((r: Record<string, unknown>) => ({ ...r, ts: relTs(Number(r.ts)) })),
  });
});

// -------------------------------------------------------------- analytics
workspaceRoutes.get("/analytics", async (c) => {
  const db = c.env.DB;
  const biz = await resolveBusiness(c);
  const weekAgo = nowMs() - 7 * dayMs;
  const [trend, sources, funnel, links] = await Promise.all([
    db
      .prepare(
        `SELECT type, COUNT(*) AS n, CAST((?2 - created_at) / ?3 AS INTEGER) AS day FROM events
         WHERE business_id = ?1 AND created_at > ?2 - 7 * ?3 AND type IN ('contact', 'lead') GROUP BY day, type`,
      )
      .bind(biz.id, nowMs(), dayMs)
      .all<{ type: string; n: number; day: number }>(),
    db
      .prepare(
        `SELECT source, COUNT(*) AS n FROM events WHERE business_id = ?1 AND created_at > ?2 GROUP BY source ORDER BY n DESC`,
      )
      .bind(biz.id, nowMs() - 30 * dayMs)
      .all<{ source: string; n: number }>(),
    db
      .prepare(`SELECT stage, COUNT(*) AS n FROM leads WHERE business_id = ?1 GROUP BY stage`)
      .bind(biz.id)
      .all<{ stage: string; n: number }>(),
    db
      .prepare(`SELECT label, scans FROM links WHERE business_id = ?1 ORDER BY scans DESC LIMIT 5`)
      .bind(biz.id)
      .all<{ label: string; scans: number }>(),
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
    trend: trendData,
    sources: sources.results
      .slice(0, 5)
      .map((s) => ({ label: s.source, value: Math.round((s.n / totalSources) * 100) })),
    funnel: funnel.results,
    topLinks: links.results,
  });
});
