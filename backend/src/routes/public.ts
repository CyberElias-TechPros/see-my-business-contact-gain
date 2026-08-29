import { Hono } from "hono";
import type { Env, SessionUser } from "../types";
import { getUser, type BusinessRow } from "../auth";
import { mapBusiness } from "../domain";
import { audit } from "../audit";
import {
  bad,
  body,
  bool,
  clientIp,
  int,
  newId,
  notFound,
  nowMs,
  parseJson,
  rateLimit,
  str,
  validEmail,
} from "../util";

type AppEnv = { Bindings: Env; Variables: { user: SessionUser | null } };

export const publicRoutes = new Hono<AppEnv>();

// ------------------------------------------------------------------- meta
publicRoutes.get("/meta", async (c) => {
  const db = c.env.DB;
  const [categories, locations, liveCounts, stats] = await Promise.all([
    db.prepare(`SELECT slug, name, icon, count FROM categories ORDER BY name`).all<{
      slug: string;
      name: string;
      icon: string;
      count: number;
    }>(),
    db.prepare(`SELECT slug, name, areas, count FROM locations ORDER BY count DESC`).all<{
      slug: string;
      name: string;
      areas: string;
      count: number;
    }>(),
    db
      .prepare(
        `SELECT category_slug AS slug, COUNT(*) AS live FROM businesses WHERE status = 'Active' GROUP BY category_slug`,
      )
      .all<{ slug: string; live: number }>(),
    db
      .prepare(
        `SELECT (SELECT COUNT(*) FROM categories) AS categories,
              (SELECT COALESCE(SUM(count), 0) FROM categories) AS businesses,
              (SELECT COUNT(*) FROM events WHERE type = 'contact') AS chats,
              (SELECT COUNT(DISTINCT state) FROM businesses) AS states`,
      )
      .first<{ categories: number; businesses: number; chats: number; states: number }>(),
  ]);
  const live = new Map(liveCounts.results.map((r: Record<string, unknown>) => [r.slug, r.live]));
  return c.json({
    categories: categories.results.map((cat) => ({ ...cat, live: live.get(cat.slug) ?? 0 })),
    locations: locations.results.map((loc) => ({
      ...loc,
      areas: parseJson<string[]>(loc.areas, []),
    })),
    stats: {
      businesses: stats?.businesses ?? 0,
      chats: (stats?.chats ?? 0) + 1_200_000,
      states: Math.max(stats?.states ?? 0, 36),
    },
  });
});

// -------------------------------------------------------------- businesses
publicRoutes.get("/businesses", async (c) => {
  const db = c.env.DB;
  const q = c.req.query("q")?.trim() ?? "";
  const category = c.req.query("category")?.trim() ?? "";
  const location = c.req.query("location")?.trim() ?? "";
  const area = c.req.query("area")?.trim() ?? "";
  const minRating = Number(c.req.query("minRating") ?? "0") || 0;
  const sort = c.req.query("sort") ?? "relevance";
  const page = Math.max(1, int(c.req.query("page"), 1, { min: 1, max: 10_000 }));
  const pageSize = Math.min(48, Math.max(4, int(c.req.query("pageSize"), 12, { min: 1, max: 48 })));

  const where: string[] = [`status = 'Active'`];
  const binds: unknown[] = [];
  let n = 0;
  const bind = (v: unknown) => {
    binds.push(v);
    return `?${++n}`;
  };
  if (q) {
    const like = `%${q}%`;
    where.push(
      `(${["b.name", "b.tagline", "b.about", "b.city", "b.state"].map((col) => `${col} LIKE ${bind(like)}`).join(" OR ")})`,
    );
  }
  if (category) where.push(`b.category_slug = ${bind(category)}`);
  if (area) where.push(`b.city LIKE ${bind(`%${area}%`)}`);
  if (location) {
    const loc = await db
      .prepare(`SELECT name, areas FROM locations WHERE slug = ?1`)
      .bind(location)
      .first<{
        name: string;
        areas: string;
      }>();
    if (loc) {
      const areaList = parseJson<string[]>(loc.areas, []);
      const placeholders = [loc.name, ...areaList].map((v) => bind(v));
      where.push(
        `(b.state IN (${placeholders.join(",")}) OR b.city IN (${placeholders.join(",")}))`,
      );
    }
  }
  if (minRating > 0) where.push(`b.rating >= ${bind(minRating)}`);
  if (bool(c.req.query("openNow"))) where.push(`b.open_now = 1`);
  if (bool(c.req.query("verifiedOnly"))) where.push(`b.verified != 'unverified'`);
  for (const amenity of ["Offers delivery", "Accepts card", "Home service"]) {
    const flag = c.req.query(amenity.toLowerCase().replace(/\s+/g, ""));
    if (bool(flag)) {
      const needle = amenity.replace("Offers ", "").replace("Accepts ", "");
      where.push(`b.amenities LIKE ${bind(`%${needle}%`)}`);
    }
  }

  const orderBy =
    sort === "rating"
      ? `b.rating DESC, b.reviews_count DESC`
      : sort === "response"
        ? `b.response_minutes ASC`
        : sort === "contacts"
          ? `b.contacts_gained DESC`
          : `b.featured DESC, b.contacts_gained DESC, b.rating DESC`;

  const whereSql = where.join(" AND ");
  const total = await db
    .prepare(`SELECT COUNT(*) AS n FROM businesses b WHERE ${whereSql}`)
    .bind(...binds)
    .first<{ n: number }>();
  const rows = await db
    .prepare(
      `SELECT b.*, c.name AS category_name FROM businesses b
       LEFT JOIN categories c ON c.slug = b.category_slug
       WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
    )
    .bind(...binds)
    .all<BusinessRow & { category_name: string | null }>();

  const items = rows.results.map((row) => {
    const mapped = mapBusiness(row);
    if (row.category_name) mapped.categoryName = row.category_name;
    return mapped;
  });
  return c.json({
    items,
    total: total?.n ?? 0,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil((total?.n ?? 0) / pageSize)),
  });
});

publicRoutes.get("/businesses/:id", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT b.*, c.name AS category_name FROM businesses b
     LEFT JOIN categories c ON c.slug = b.category_slug WHERE b.id = ?1`,
  )
    .bind(c.req.param("id"))
    .first<BusinessRow & { category_name: string | null }>();
  if (!row) notFound("Business not found");
  const business = mapBusiness(row!);
  if (row!.category_name) business.categoryName = row!.category_name;
  const [reviews, saved] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, business_id AS businessId, author, rating, body, status, created_at AS ts
       FROM reviews WHERE business_id = ?1 AND status = 'Published' ORDER BY created_at DESC LIMIT 20`,
    )
      .bind(row!.id)
      .all(),
    (() => {
      const user = c.get("user");
      if (!user) return Promise.resolve(null);
      return c.env.DB.prepare(
        `SELECT 1 AS x FROM saved_businesses WHERE user_id = ?1 AND business_id = ?2`,
      )
        .bind(user.id, row!.id)
        .first();
    })(),
  ]);
  return c.json({ business, reviews: reviews.results, saved: saved != null });
});

publicRoutes.get("/businesses/:id/reviews", async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, business_id AS businessId, author, rating, body, status, created_at AS ts
     FROM reviews WHERE business_id = ?1 AND status = 'Published' ORDER BY created_at DESC LIMIT 50`,
  )
    .bind(c.req.param("id"))
    .all();
  return c.json({ items: rows.results });
});

publicRoutes.post("/businesses/:id/reviews", async (c) => {
  const user = getUser(c);
  const b = await body(c);
  await rateLimit(c.env.DB, clientIp(c), "reviews", 5, 60_000);
  const businessId = c.req.param("id");
  const business = await c.env.DB.prepare(`SELECT id FROM businesses WHERE id = ?1`)
    .bind(businessId)
    .first();
  if (!business) notFound("Business not found");
  const author = str(b.author, "Name", { max: 80 });
  const rating = Math.min(5, Math.max(1, int(b.rating, 5, { min: 1, max: 5 })));
  const text = str(b.body, "Review", { max: 2000 });
  if (text.length < 10) bad("Review is a little short — tell us a bit more");
  const id = newId("R");
  await c.env.DB.prepare(
    `INSERT INTO reviews (id, business_id, user_id, author, rating, body, status, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'Published', ?7)`,
  )
    .bind(id, businessId, user.id, author, rating, text, nowMs())
    .run();
  await c.env.DB.prepare(
    `UPDATE businesses SET
       rating = (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE business_id = ?1 AND status = 'Published'),
       reviews_count = (SELECT COUNT(*) FROM reviews WHERE business_id = ?1 AND status = 'Published')
     WHERE id = ?1`,
  )
    .bind(businessId)
    .run();
  await c.env.DB.prepare(
    `INSERT INTO events (business_id, type, source, created_at) VALUES (?1, 'review', 'Directory profile', ?2)`,
  )
    .bind(businessId, nowMs())
    .run();
  await audit(c.env.DB, user.name, `Posted a review on ${businessId}`, businessId);
  return c.json({ ok: true, id });
});

publicRoutes.post("/businesses/:id/enquiries", async (c) => {
  const db = c.env.DB;
  await rateLimit(db, clientIp(c), "enquiries", 10, 60_000);
  const b = await body(c);
  const businessId = c.req.param("id");
  const business = await db
    .prepare(`SELECT id, name FROM businesses WHERE id = ?1`)
    .bind(businessId)
    .first<{
      id: string;
      name: string;
    }>();
  if (!business) notFound("Business not found");
  const name = str(b.name, "Your name", { max: 120 });
  const whatsapp = str(b.whatsapp, "WhatsApp number", { max: 40 });
  const message = str(b.message, "Message", { max: 2000, optional: true });
  const service = str(b.service, "Service", { max: 200, optional: true });
  const user = c.get("user");
  const leadId = newId("LD");
  const enquiryId = newId("EN");
  const convId = newId("CV");
  const ts = nowMs();

  const stmts = [
    db
      .prepare(
        `INSERT INTO enquiries (id, business_id, user_id, name, whatsapp, message, service, source, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'Directory profile', 'New', ?8)`,
      )
      .bind(enquiryId, businessId, user?.id ?? null, name, whatsapp, message, service, ts),
    db
      .prepare(
        `INSERT INTO leads (id, business_id, name, source, channel, stage, value, agent, score, created_at, updated_at)
         VALUES (?1, ?2, ?3, 'Directory profile', 'Form', 'New', '', 'Unassigned', 50, ?4, ?4)`,
      )
      .bind(leadId, businessId, name, ts),
    db
      .prepare(
        `INSERT INTO conversations (id, business_id, name, last, unread, tag, assigned, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 1, 'New enquiry', 'Unassigned', ?5, ?5)`,
      )
      .bind(convId, businessId, name, message || "New quote request from your profile", ts),
    db
      .prepare(
        `INSERT INTO messages (conversation_id, sender, body, created_at) VALUES (?1, 'contact', ?2, ?3)`,
      )
      .bind(convId, message || "New quote request from your profile", ts),
    db
      .prepare(`UPDATE businesses SET contacts_gained = contacts_gained + 1 WHERE id = ?1`)
      .bind(businessId),
    db
      .prepare(
        `INSERT INTO events (business_id, type, source, created_at) VALUES (?1, 'lead', 'Directory profile', ?2)`,
      )
      .bind(businessId, ts),
    db
      .prepare(
        `INSERT INTO audit_log (actor, action, business_id, created_at) VALUES ('System', ?2, ?1, ?3)`,
      )
      .bind(businessId, `New enquiry from ${name} (Directory profile)`, ts),
  ];
  await db.batch(stmts);
  return c.json({ ok: true, enquiryId, leadId });
});

// ------------------------------------------------------------------ events
publicRoutes.post("/events", async (c) => {
  const b = await body(c);
  const businessId = str(b.businessId, "businessId", { max: 80 });
  const type = str(b.type, "type", { max: 20 });
  if (!["contact", "call", "save", "share", "view"].includes(type)) bad("Unknown event type");
  const source = str(b.source, "source", { max: 80, optional: true }) || "Directory profile";
  const stmts = [
    c.env.DB.prepare(
      `INSERT INTO events (business_id, type, source, created_at) VALUES (?1, ?2, ?3, ?4)`,
    ).bind(businessId, type, source, nowMs()),
  ];
  if (type === "contact")
    stmts.push(
      c.env.DB.prepare(
        `UPDATE businesses SET contacts_gained = contacts_gained + 1 WHERE id = ?1`,
      ).bind(businessId),
    );
  if (type === "save")
    stmts.push(
      c.env.DB.prepare(`UPDATE businesses SET saved_by = saved_by + 1 WHERE id = ?1`).bind(
        businessId,
      ),
    );
  await c.env.DB.batch(stmts);
  return c.json({ ok: true });
});

// ------------------------------------------------------------------- rooms
publicRoutes.get("/rooms", async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  const state = c.req.query("state")?.trim() ?? "";
  let sql = `SELECT * FROM rooms WHERE status = 'Active'`;
  const binds: unknown[] = [];
  if (q) {
    binds.push(`%${q}%`);
    sql += ` AND (name LIKE ?1 OR purpose LIKE ?1)`;
  }
  if (state && state !== "all") {
    binds.push(state);
    sql += ` AND state = ?${binds.length}`;
  }
  sql += ` ORDER BY members DESC`;
  const rows = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all<Record<string, unknown>>();
  const rooms = rows.results.map((r: Record<string, unknown>) => mapRoom(r));
  return c.json({ items: rooms });
});

function mapRoom(r: Record<string, unknown>) {
  const slots = Number(r.slots);
  const members = Number(r.members);
  return {
    id: r.id,
    name: r.name,
    purpose: r.purpose,
    members,
    slots,
    slotsLeft: Math.max(0, slots - members),
    rule: r.rule,
    verifiedOnly: r.verified_only === 1,
    state: r.state,
    status: r.status,
    ownerId: r.owner_id,
    ts: Math.max(0, Math.round((nowMs() - Number(r.created_at)) / 60_000)),
  };
}

publicRoutes.get("/rooms/:id", async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM rooms WHERE id = ?1`)
    .bind(c.req.param("id"))
    .first<Record<string, unknown>>();
  if (!row) notFound("Room not found");
  const [members, activity] = await Promise.all([
    c.env.DB.prepare(
      `SELECT room_id AS roomId, name, niche, save_back AS saveBack FROM room_members WHERE room_id = ?1 ORDER BY save_back DESC`,
    )
      .bind(c.req.param("id"))
      .all(),
    c.env.DB.prepare(
      `SELECT text, created_at AS ts FROM room_activity WHERE room_id = ?1 ORDER BY created_at DESC LIMIT 20`,
    )
      .bind(c.req.param("id"))
      .all(),
  ]);
  return c.json({ ...mapRoom(row!), members: members.results, activity: activity.results });
});

publicRoutes.post("/rooms", async (c) => {
  const user = getUser(c);
  const b = await body(c);
  const name = str(b.name, "Room name", { max: 120 });
  const purpose = str(b.purpose, "Purpose", { max: 300, optional: true });
  const rule = str(b.rule, "House rules", { max: 2000, optional: true });
  const slots = Math.min(5000, Math.max(50, int(b.slots, 5000, { min: 50, max: 5000 })));
  const state = str(b.state, "State", { max: 60, optional: true }) || "Nationwide";
  const verifiedOnly = bool(b.verifiedOnly);
  const id = newId("RM").toLowerCase();
  await c.env.DB.prepare(
    `INSERT INTO rooms (id, name, purpose, rule, verified_only, state, slots, members, status, owner_id, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 'Pending', ?8, ?9)`,
  )
    .bind(id, name, purpose, rule, verifiedOnly ? 1 : 0, state, slots, user.id, nowMs())
    .run();
  await audit(c.env.DB, user.name, `Submitted contact-gain room “${name}” for approval`, null);
  return c.json({ ok: true, id, status: "Pending" });
});

publicRoutes.post("/rooms/:id/join", async (c) => {
  const user = getUser(c);
  const db = c.env.DB;
  const room = await db
    .prepare(`SELECT * FROM rooms WHERE id = ?1`)
    .bind(c.req.param("id"))
    .first<Record<string, unknown>>();
  if (!room) notFound("Room not found");
  if (room!.status !== "Active") bad("This room is not accepting members yet");
  if (Number(room!.slots) - Number(room!.members) <= 0) bad("This room is full — try another one");

  let memberName = user.name;
  let niche = "Member";
  let verified = false;
  const business = await db
    .prepare(`SELECT * FROM businesses WHERE owner_id = ?1 LIMIT 1`)
    .bind(user.id)
    .first<BusinessRow>();
  if (business) {
    memberName = business.name;
    niche = business.category_slug.replace(/-/g, " ");
    verified = business.verified !== "unverified";
  }
  if (room!.verified_only === 1 && !verified) {
    bad("This room is for verified businesses only — verify your listing first", 403);
  }
  const existing = await db
    .prepare(`SELECT 1 AS x FROM room_members WHERE room_id = ?1 AND name = ?2`)
    .bind(room!.id, memberName)
    .first();
  if (existing) return c.json({ ok: true, alreadyMember: true });
  await db.batch([
    db
      .prepare(
        `INSERT INTO room_members (room_id, name, niche, save_back, joined_at) VALUES (?1, ?2, ?3, 100, ?4)`,
      )
      .bind(room!.id, memberName, niche, nowMs()),
    db.prepare(`UPDATE rooms SET members = members + 1 WHERE id = ?1`).bind(room!.id),
    db
      .prepare(`INSERT INTO room_activity (room_id, text, created_at) VALUES (?1, ?2, ?3)`)
      .bind(room!.id, `${memberName} joined the room`, nowMs()),
  ]);
  return c.json({ ok: true });
});

publicRoutes.post("/rooms/:id/report", async (c) => {
  const user = c.get("user");
  await rateLimit(c.env.DB, clientIp(c), "reports", 10, 60_000);
  const b = await body(c);
  const details = str(b.details, "Details", { max: 2000, optional: true });
  const room = await c.env.DB.prepare(`SELECT name FROM rooms WHERE id = ?1`)
    .bind(c.req.param("id"))
    .first<{
      name: string;
    }>();
  if (!room) notFound("Room not found");
  const risk = /scam|fraud|fake|impersonat/i.test(details) ? "High" : "Medium";
  await c.env.DB.prepare(
    `INSERT INTO reports (id, target_type, target_label, reason, details, contact, status, risk, created_at)
     VALUES (?1, 'Room', ?2, 'Room report', ?3, ?4, 'Open', ?5, ?6)`,
  )
    .bind(newId("RP"), room!.name, details, user?.email ?? "", risk, nowMs())
    .run();
  return c.json({ ok: true });
});

// ----------------------------------------------- claims / suggestions / reports
publicRoutes.post("/claims", async (c) => {
  await rateLimit(c.env.DB, clientIp(c), "claims", 5, 60_000);
  const user = c.get("user");
  const b = await body(c);
  const businessId = str(b.businessId, "Listing", { max: 80, optional: true }) || null;
  const claimant = str(b.claimant, "Your name", { max: 120 });
  const role = str(b.role, "Role", { max: 60, optional: true }) || "Owner";
  const contact = validEmail(b.contact);
  const evidence = str(b.evidence, "Evidence", { max: 500, optional: true });
  const notes = str(b.notes, "Notes", { max: 2000, optional: true });
  let businessName = str(b.businessName, "Business", { max: 120, optional: true });
  if (businessId) {
    const biz = await c.env.DB.prepare(`SELECT name FROM businesses WHERE id = ?1`)
      .bind(businessId)
      .first<{
        name: string;
      }>();
    if (biz) businessName = biz.name;
  }
  if (!businessName) bad("Pick a listing to claim");
  const id = newId("CL");
  await c.env.DB.prepare(
    `INSERT INTO claims (id, business_id, business_name, claimant, role, contact, evidence, notes, status, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'Pending', ?9)`,
  )
    .bind(id, businessId, businessName, claimant, role, contact, evidence, notes, nowMs())
    .run();
  await audit(c.env.DB, claimant, `Submitted ownership claim for ${businessName}`, businessId);
  return c.json({ ok: true, id });
});

publicRoutes.post("/suggestions", async (c) => {
  await rateLimit(c.env.DB, clientIp(c), "suggestions", 10, 60_000);
  const b = await body(c);
  const id = newId("SG");
  await c.env.DB.prepare(
    `INSERT INTO suggestions (id, type, category_slug, name, contact, address, details, status, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'Pending', ?8)`,
  )
    .bind(
      id,
      str(b.type, "Type", { max: 60, optional: true }) || "New business",
      str(b.categorySlug, "Category", { max: 80, optional: true }),
      str(b.name, "Business name", { max: 120 }),
      str(b.contact, "Contact", { max: 120, optional: true }),
      str(b.address, "Address", { max: 300, optional: true }),
      str(b.details, "Details", { max: 2000, optional: true }),
      nowMs(),
    )
    .run();
  return c.json({ ok: true, id });
});

const HIGH_RISK = /scam|fraud|fake|nud|impersonat|advance[- ]fee/i;

publicRoutes.post("/reports", async (c) => {
  await rateLimit(c.env.DB, clientIp(c), "reports", 10, 60_000);
  const b = await body(c);
  const targetType = str(b.targetType, "Type", { max: 60 });
  const targetLabel = str(b.targetLabel, "What are you reporting?", { max: 200 });
  const reason = str(b.reason, "Reason", { max: 200 });
  const details = str(b.details, "Details", { max: 2000, optional: true });
  const contact = str(b.contact, "Contact", { max: 200, optional: true });
  const id = newId("RP");
  await c.env.DB.prepare(
    `INSERT INTO reports (id, target_type, target_label, reason, details, contact, status, risk, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'Open', ?7, ?8)`,
  )
    .bind(
      id,
      targetType,
      targetLabel,
      reason,
      details,
      contact,
      HIGH_RISK.test(`${reason} ${details}`) ? "High" : "Medium",
      nowMs(),
    )
    .run();
  return c.json({ ok: true, id });
});

publicRoutes.post("/data-requests", async (c) => {
  await rateLimit(c.env.DB, clientIp(c), "data-requests", 5, 60_000);
  const b = await body(c);
  const id = newId("DR");
  await c.env.DB.prepare(
    `INSERT INTO data_requests (id, name, email, request_type, details, status, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, 'Pending', ?6)`,
  )
    .bind(
      id,
      str(b.name, "Name", { max: 120 }),
      validEmail(b.email),
      str(b.requestType, "Request type", { max: 60 }),
      str(b.details, "Details", { max: 2000, optional: true }),
      nowMs(),
    )
    .run();
  return c.json({ ok: true, id });
});

// ------------------------------------------------------------- signed-in me
publicRoutes.get("/me/saved", async (c) => {
  const user = getUser(c);
  const rows = await c.env.DB.prepare(
    `SELECT b.* FROM saved_businesses s JOIN businesses b ON b.id = s.business_id
     WHERE s.user_id = ?1 ORDER BY s.created_at DESC`,
  )
    .bind(user.id)
    .all<BusinessRow>();
  return c.json({ items: rows.results.map(mapBusiness) });
});

publicRoutes.post("/me/saved", async (c) => {
  const user = getUser(c);
  const b = await body(c);
  const businessId = str(b.businessId, "businessId", { max: 80 });
  const exists = await c.env.DB.prepare(
    `SELECT 1 AS x FROM saved_businesses WHERE user_id = ?1 AND business_id = ?2`,
  )
    .bind(user.id, businessId)
    .first();
  if (!exists) {
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO saved_businesses (user_id, business_id, created_at) VALUES (?1, ?2, ?3)`,
      ).bind(user.id, businessId, nowMs()),
      c.env.DB.prepare(`UPDATE businesses SET saved_by = saved_by + 1 WHERE id = ?1`).bind(
        businessId,
      ),
      c.env.DB.prepare(
        `INSERT INTO events (business_id, type, source, created_at) VALUES (?1, 'save', 'Directory profile', ?2)`,
      ).bind(businessId, nowMs()),
    ]);
  }
  return c.json({ ok: true, saved: true });
});

publicRoutes.delete("/me/saved/:businessId", async (c) => {
  const user = getUser(c);
  await c.env.DB.prepare(
    `DELETE FROM saved_businesses WHERE user_id = ?1 AND business_id = ?2`,
  ).bind(user.id, c.req.param("businessId"));
  return c.json({ ok: true, saved: false });
});

publicRoutes.get("/me/reviews", async (c) => {
  const user = getUser(c);
  const rows = await c.env.DB.prepare(
    `SELECT id, business_id AS businessId, author, rating, body, status, created_at AS ts
     FROM reviews WHERE user_id = ?1 ORDER BY created_at DESC`,
  )
    .bind(user.id)
    .all();
  return c.json({ items: rows.results });
});

publicRoutes.get("/me/enquiries", async (c) => {
  const user = getUser(c);
  const rows = await c.env.DB.prepare(
    `SELECT e.*, b.name AS businessName FROM enquiries e JOIN businesses b ON b.id = e.business_id
     WHERE e.user_id = ?1 ORDER BY e.created_at DESC LIMIT 50`,
  )
    .bind(user.id)
    .all<Record<string, unknown>>();
  return c.json({ items: rows.results });
});

// ------------------------------------------------- business creation (join)
publicRoutes.post("/businesses", async (c) => {
  const user = getUser(c);
  const db = c.env.DB;
  const b = await body(c);
  const name = str(b.name, "Business name", { max: 120 });
  const categorySlug = str(b.categorySlug, "Category", { max: 80 });
  const whatsapp = str(b.whatsapp, "WhatsApp number", { max: 40 });
  const cat = await db
    .prepare(`SELECT slug FROM categories WHERE slug = ?1`)
    .bind(categorySlug)
    .first();
  if (!cat) bad("Unknown category");
  const city = str(b.city, "City", { max: 80, optional: true }) || "Lagos";
  const state = str(b.state, "State", { max: 80, optional: true }) || "Lagos";
  let id = str(b.id, "Slug", { max: 80, optional: true }) || slugifyName(name);
  const taken = await db.prepare(`SELECT 1 AS x FROM businesses WHERE id = ?1`).bind(id).first();
  if (taken) id = `${id}-${Math.floor(Math.random() * 900 + 100)}`;

  await db.batch([
    db
      .prepare(
        `INSERT INTO businesses (id, owner_id, name, tagline, about, category_slug, city, state, address, whatsapp, phone, website, status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10, ?11, 'Active', ?12, ?12)`,
      )
      .bind(
        id,
        user.id,
        name,
        str(b.tagline, "Tagline", { max: 160, optional: true }),
        str(b.about, "About", { max: 4000, optional: true }),
        categorySlug,
        city,
        state,
        str(b.address, "Address", { max: 300, optional: true }),
        whatsapp,
        str(b.website, "Website", { max: 200, optional: true }),
        nowMs(),
      ),
    db.prepare(`UPDATE users SET role = 'owner' WHERE id = ?1 AND role = 'user'`).bind(user.id),
    db
      .prepare(
        `INSERT INTO audit_log (actor, action, business_id, created_at) VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(user.name, `Created business listing ${name}`, id, nowMs()),
  ]);
  return c.json({ ok: true, id });
});

function slugifyName(v: string): string {
  return (
    v
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "business"
  );
}
