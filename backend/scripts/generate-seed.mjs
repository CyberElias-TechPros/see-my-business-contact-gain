#!/usr/bin/env node
/**
 * Generates `seed.sql` from the canonical demo dataset
 * (`../src/data/dataset.json`). Output goes to stdout:
 *
 *   node scripts/generate-seed.mjs > seed.sql
 *
 * The same dataset drives the frontend demo fallback, so both environments
 * show identical data.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { webcrypto as crypto } from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const raw = JSON.parse(readFileSync(`${__dirname}/../../src/data/dataset.json`, "utf8"));

const now = Date.now();
const MIN = 60_000;
const at = (minutesAgo) => now - minutesAgo * MIN;

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 100_000 },
    key,
    256,
  );
  const b64 = (buf) => Buffer.from(buf).toString("base64");
  return `pbkdf2:100000:${b64(salt)}:${b64(new Uint8Array(bits))}`;
}

const q = (v) => {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  return `'${String(v).replaceAll("'", "''")}'`;
};
const j = (v) => q(JSON.stringify(v));

const rows = [];

// ---------------------------------------------------------------- users
for (const u of raw.users) {
  const hash = await hashPassword(u.password);
  rows.push(
    `INSERT INTO users (id,email,phone,name,password_hash,role,status,whatsapp,created_at) VALUES (${[
      q(u.id),
      q(u.email),
      q(u.phone ?? null),
      q(u.name),
      q(hash),
      q(u.role),
      q(u.status),
      q(u.whatsapp ?? null),
      String(at(u.ts)),
    ].join(",")});`,
  );
}

// ------------------------------------------------- categories & locations
for (const c of raw.categories)
  rows.push(
    `INSERT INTO categories (slug,name,icon,count) VALUES (${q(c.slug)},${q(c.name)},${q(c.icon)},${c.count});`,
  );
for (const l of raw.locations)
  rows.push(
    `INSERT INTO locations (slug,name,areas,count) VALUES (${q(l.slug)},${q(l.name)},${j(l.areas)},${l.count});`,
  );

// ------------------------------------------------------------- businesses
const defaultHours = [
  { day: "Monday", open: "8:00 AM – 6:00 PM" },
  { day: "Tuesday", open: "8:00 AM – 6:00 PM" },
  { day: "Wednesday", open: "8:00 AM – 6:00 PM" },
  { day: "Thursday", open: "8:00 AM – 6:00 PM" },
  { day: "Friday", open: "8:00 AM – 7:00 PM" },
  { day: "Saturday", open: "9:00 AM – 4:00 PM" },
  { day: "Sunday", open: "Closed" },
];
for (const b of raw.businesses) {
  rows.push(
    `INSERT INTO businesses (id,owner_id,name,tagline,about,category_slug,city,state,address,rating,reviews_count,verified,open_now,whatsapp,phone,website,socials,services,products,amenities,service_areas,gallery,team,hours,plan,status,contacts_gained,saved_by,featured,response_minutes,created_at,updated_at) VALUES (${[
      q(b.id),
      q(b.ownerId ?? null),
      q(b.name),
      q(b.tagline),
      q(b.about),
      q(b.categorySlug),
      q(b.city),
      q(b.state),
      q(b.address),
      String(b.rating),
      String(b.reviewsCount),
      q(b.verified),
      b.openNow ? "1" : "0",
      q(b.whatsapp),
      q(b.phone),
      q(b.website),
      j(b.socials),
      j(b.services),
      j(b.products),
      j(b.amenities),
      j(b.serviceAreas),
      j(b.gallery),
      j(b.team),
      j(defaultHours),
      q(b.plan),
      q("Active"),
      String(b.contactsGained),
      String(b.savedBy),
      b.featured ? "1" : "0",
      String(b.responseMinutes),
      String(at(b.ts)),
      String(at(Math.min(b.ts, 60))),
    ].join(",")});`,
  );
}

// ---------------------------------------------------------------- reviews
for (const r of raw.reviews)
  rows.push(
    `INSERT INTO reviews (id,business_id,author,rating,body,status,created_at) VALUES (${[
      q(r.id),
      q(r.businessId),
      q(r.author),
      String(r.rating),
      q(r.body),
      q(r.status),
      String(at(r.ts)),
    ].join(",")});`,
  );

// ------------------------------------------------------------------ rooms
for (const r of raw.rooms)
  rows.push(
    `INSERT INTO rooms (id,name,purpose,rule,verified_only,state,slots,members,status,owner_id,created_at) VALUES (${[
      q(r.id),
      q(r.name),
      q(r.purpose),
      q(r.rule),
      r.verifiedOnly ? "1" : "0",
      q(r.state),
      String(r.slots),
      String(r.members),
      q(r.status),
      q(r.ownerId ?? null),
      String(at(r.ts)),
    ].join(",")});`,
  );
for (const m of raw.roomMembers)
  rows.push(
    `INSERT INTO room_members (room_id,name,niche,save_back,joined_at) VALUES (${[
      q(m.roomId),
      q(m.name),
      q(m.niche),
      String(m.saveBack),
      String(at(1000)),
    ].join(",")});`,
  );
for (const a of raw.roomActivity)
  rows.push(
    `INSERT INTO room_activity (room_id,text,created_at) VALUES (${q(a.roomId)},${q(a.text)},${String(at(a.ts))});`,
  );

// --------------------------------------------------- leads & CRM entities
for (const l of raw.leads)
  rows.push(
    `INSERT INTO leads (id,business_id,name,source,channel,stage,value,agent,score,created_at,updated_at) VALUES (${[
      q(l.id),
      q(l.businessId),
      q(l.name),
      q(l.source),
      q(l.channel),
      q(l.stage),
      q(l.value),
      q(l.agent),
      String(l.score),
      String(at(l.ts)),
      String(at(l.ts)),
    ].join(",")});`,
  );
for (const ct of raw.contacts)
  rows.push(
    `INSERT INTO contacts (id,business_id,name,phone,email,tags,source,created_at) VALUES (${[
      q(ct.id),
      q(ct.businessId),
      q(ct.name),
      q(ct.phone),
      q(ct.email ?? null),
      j(ct.tags),
      q(ct.source),
      String(at(ct.ts)),
    ].join(",")});`,
  );
for (const cv of raw.conversations) {
  const msgs = cv.messages ?? [];
  const last = msgs.at(-1);
  rows.push(
    `INSERT INTO conversations (id,business_id,name,last,unread,tag,assigned,created_at,updated_at) VALUES (${[
      q(cv.id),
      q(cv.businessId),
      q(cv.name),
      q(last?.body ?? cv.last),
      String(cv.unread),
      q(cv.tag),
      q(cv.assigned),
      String(at(msgs[0]?.ts ?? cv.ts)),
      String(at(cv.ts)),
    ].join(",")});`,
  );
  for (const m of msgs)
    rows.push(
      `INSERT INTO messages (conversation_id,sender,body,created_at) VALUES (${q(cv.id)},${q(m.from)},${q(m.body)},${String(at(m.ts))});`,
    );
}
for (const t of raw.tasks)
  rows.push(
    `INSERT INTO tasks (id,business_id,title,due,owner,priority,done,created_at) VALUES (${[
      q(t.id),
      q(t.businessId),
      q(t.title),
      q(t.due),
      q(t.owner),
      q(t.priority),
      t.done ? "1" : "0",
      String(at(t.ts)),
    ].join(",")});`,
  );
for (const c of raw.campaigns)
  rows.push(
    `INSERT INTO campaigns (id,business_id,name,channel,scans,leads,cost,status,created_at) VALUES (${[
      q(c.id),
      q(c.businessId),
      q(c.name),
      q(c.channel),
      String(c.scans),
      String(c.leads),
      q(c.cost),
      q(c.status),
      String(at(c.ts)),
    ].join(",")});`,
  );
for (const l of raw.links)
  rows.push(
    `INSERT INTO links (id,business_id,label,code,scans,source,created_at) VALUES (${[
      q(l.id),
      q(l.businessId),
      q(l.label),
      q(l.code),
      String(l.scans),
      q(l.source),
      String(at(l.ts)),
    ].join(",")});`,
  );
for (const a of raw.automations)
  rows.push(
    `INSERT INTO automations (id,business_id,trigger,action,runs,status,created_at) VALUES (${[
      q(a.id),
      q(a.businessId),
      q(a.trigger),
      q(a.action),
      String(a.runs),
      q(a.status),
      String(at(a.ts)),
    ].join(",")});`,
  );
for (const t of raw.teamMembers)
  rows.push(
    `INSERT INTO team_members (id,business_id,name,email,role,status,created_at) VALUES (${[
      q(t.id),
      q(t.businessId),
      q(t.name),
      q(t.email),
      q(t.role),
      q(t.status),
      String(at(t.ts)),
    ].join(",")});`,
  );
for (const a of raw.auditLog)
  rows.push(
    `INSERT INTO audit_log (actor,action,business_id,created_at) VALUES (${[
      q(a.actor),
      q(a.action),
      q(a.businessId ?? null),
      String(at(a.ts)),
    ].join(",")});`,
  );

// ---------------------------------------- moderation / trust & safety
for (const c of raw.claims)
  rows.push(
    `INSERT INTO claims (id,business_id,business_name,claimant,role,contact,evidence,notes,status,created_at) VALUES (${[
      q(c.id),
      q(c.businessId ?? null),
      q(c.businessName),
      q(c.claimant),
      q(c.role),
      q(c.contact),
      q(c.evidence),
      q(c.notes ?? ""),
      q(c.status),
      String(at(c.ts)),
    ].join(",")});`,
  );
for (const m of raw.moderation)
  rows.push(
    `INSERT INTO moderation (id,type,item,reason,risk,status,created_at) VALUES (${[
      q(m.id),
      q(m.type),
      q(m.item),
      q(m.reason),
      q(m.risk),
      q(m.status),
      String(at(m.ts)),
    ].join(",")});`,
  );
for (const r of raw.reports)
  rows.push(
    `INSERT INTO reports (id,target_type,target_label,reason,details,contact,status,risk,created_at) VALUES (${[
      q(r.id),
      q(r.targetType),
      q(r.targetLabel),
      q(r.reason),
      q(r.details ?? ""),
      q(r.contact ?? ""),
      q(r.status),
      q(r.risk),
      String(at(r.ts)),
    ].join(",")});`,
  );
for (const s of raw.suggestions)
  rows.push(
    `INSERT INTO suggestions (id,type,category_slug,name,contact,address,details,status,created_at) VALUES (${[
      q(s.id),
      q(s.type),
      q(s.categorySlug),
      q(s.name),
      q(s.contact),
      q(s.address),
      q(s.details),
      q(s.status),
      String(at(s.ts)),
    ].join(",")});`,
  );
for (const t of raw.tickets)
  rows.push(
    `INSERT INTO tickets (id,subject,user,priority,status,created_at) VALUES (${[
      q(t.id),
      q(t.subject),
      q(t.user),
      q(t.priority),
      q(t.status),
      String(at(t.ts)),
    ].join(",")});`,
  );
for (const i of raw.invoices)
  rows.push(
    `INSERT INTO invoices (id,business_id,plan,amount,status,created_at) VALUES (${[
      q(i.id),
      q(i.businessId),
      q(i.plan),
      q(i.amount),
      q(i.status),
      String(at(i.ts)),
    ].join(",")});`,
  );
for (const a of raw.ads)
  rows.push(
    `INSERT INTO ads (id,advertiser,inventory,spend,chats,status,created_at) VALUES (${[
      q(a.id),
      q(a.advertiser),
      q(a.inventory),
      q(a.spend),
      String(a.chats),
      q(a.status),
      String(at(a.ts)),
    ].join(",")});`,
  );
for (const f of raw.flags)
  rows.push(
    `INSERT INTO flags (key,rollout,audience,status,description,enabled,created_at) VALUES (${[
      q(f.key),
      q(f.rollout),
      q(f.audience),
      q(f.status),
      q(f.description),
      f.enabled ? "1" : "0",
      String(at(f.ts)),
    ].join(",")});`,
  );
for (const c of raw.config)
  rows.push(
    `INSERT INTO config (key,value,notes) VALUES (${q(c.key)},${q(c.value)},${q(c.notes)});`,
  );
for (const jb of raw.jobs)
  rows.push(
    `INSERT INTO jobs (id,name,schedule,last_run,status,output) VALUES (${[
      q(jb.id),
      q(jb.name),
      q(jb.schedule),
      q(jb.lastRun),
      q(jb.status),
      q(jb.output),
    ].join(",")});`,
  );

// ------------------------------------------- synthesized event analytics
// Fabricate 30 days of contact/lead events for the primary business so that
// dashboards and trends query real aggregates.
const primary = raw.businesses[0];
const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const sourcePool = [];
for (const s of raw.sourceData) for (let i = 0; i < s.value; i++) sourcePool.push(s.label);
let evTs = 1;
const eventRows = [];
for (let d = 29; d >= 0; d--) {
  // Weekly shape from trendData, damped for older weeks.
  const week = Math.floor(d / 7);
  const dayIdx = new Date(now - d * 24 * 60 * 60 * 1000).getDay();
  const label = dayNames[dayIdx];
  const trend = raw.trendData.find((t) => t.label === label) ?? { contacts: 120, leads: 42 };
  const contacts = Math.max(
    4,
    Math.round((trend.contacts / (1 + week * 0.35)) * (0.7 + ((d * 37) % 60) / 100)),
  );
  const leads = Math.max(1, Math.round(contacts * (trend.leads / trend.contacts)));
  const base = now - d * 24 * 60 * 60 * 1000;
  for (let i = 0; i < contacts; i++) {
    const src = sourcePool[(d * 31 + i * 17) % sourcePool.length] ?? "Directory profile";
    eventRows.push(`(${q(primary.id)},'contact',${q(src)},${Math.round(base + (i % 1440) * MIN)})`);
  }
  for (let i = 0; i < leads; i++) {
    const src = sourcePool[(d * 13 + i * 7) % sourcePool.length] ?? "Directory profile";
    eventRows.push(`(${q(primary.id)},'lead',${q(src)},${Math.round(base + (i % 1440) * MIN)})`);
  }
}
for (let i = 0; i < eventRows.length; i += 400) {
  rows.push(
    `INSERT INTO events (business_id,type,source,created_at) VALUES ${eventRows.slice(i, i + 400).join(",")};`,
  );
}

const header = `-- GENERATED by scripts/generate-seed.mjs — do not edit by hand.
-- Generated at ${new Date().toISOString()}
-- Demo accounts: chidi@swiftfix.ng / demo1234 (owner) • admin@gainhub.ng / admin1234 (admin)
PRAGMA foreign_keys = OFF;
BEGIN TRANSACTION;`;
const footer = `COMMIT;
PRAGMA foreign_keys = ON;`;

console.log(`${header}\n${rows.join("\n")}\n${footer}`);
