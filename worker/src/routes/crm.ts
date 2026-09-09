import { z } from "zod";

import {
  contactInput,
  enquiryStatusInput,
  leadInput,
  leadStageInput,
  leadUpdateInput,
  taskInput,
  workspaceLeadQuery,
  type LeadDto,
} from "../../../shared/api.ts";
import {
  LEAD_STAGES,
  canMoveStage,
  normalizeNigerianPhone,
  scoreLead,
  type LeadStage,
} from "../../../shared/domain.ts";
import { requireUser } from "../auth.ts";
import { DB } from "../db-access.ts";
import { newId, nowIso, today } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseBody, parseQuery } from "../http.ts";
import { recordAudit } from "../audit.ts";
import { sendMail } from "../mail.ts";
import { notify } from "../notifications.ts";
import { access } from "./guards.ts";
import type { AppContext } from "../types.ts";

const LEAD_SELECT = `l.id, l.code, l.business_id, l.contact_id, l.enquiry_id, l.name, l.phone, l.email, l.stage, l.score,
  l.value_minor, l.source, l.priority, l.assignee_user_id, l.note, l.lost_reason, l.last_activity_at, l.created_at,
  l.updated_at, l.won_at, a.display_name AS assignee_name`;

const LEAD_FROM = `FROM leads l LEFT JOIN users a ON a.id = l.assignee_user_id`;

// ------------------------------------------------------------------- leads ----

export async function listLeads(c: AppContext): Promise<Response> {
  const actor = await access(c, "leads:read");
  const query = parseQuery(workspaceLeadQuery, c.url);
  const clauses: string[] = ["l.business_id = ?"];
  const params: unknown[] = [actor.businessId];

  if (query.stage) {
    clauses.push("l.stage = ?");
    params.push(query.stage);
  }
  if (query.assignee === "me") {
    clauses.push("l.assignee_user_id = ?");
    params.push(requireUser(c).user.id);
  } else if (query.assignee === "unassigned") {
    clauses.push("l.assignee_user_id IS NULL");
  }
  const term = (query.q ?? "").trim();
  if (term.length >= 2) {
    clauses.push("(lower(l.name) LIKE ? OR lower(l.code) LIKE ? OR l.phone LIKE ?)");
    const like = `%${term.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    params.push(like, like, like);
  }
  const whereSql = clauses.join(" AND ");
  const orderBy =
    query.sort === "score"
      ? "l.score DESC, l.last_activity_at DESC"
      : query.sort === "value"
        ? "(l.value_minor IS NULL), l.value_minor DESC"
        : "l.last_activity_at DESC";

  const [rows, total] = await Promise.all([
    DB.all<LeadRow>(
      c.env,
      `SELECT ${LEAD_SELECT} ${LEAD_FROM} WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, query.perPage, (query.page - 1) * query.perPage],
    ),
    DB.count(c.env, `SELECT COUNT(*) AS n FROM leads l WHERE ${whereSql}`, params),
  ]);

  // One query for every lead on the page — no per-row history fetch.
  const history = rows.length
    ? await DB.all<LeadEventRow>(
        c.env,
        `SELECT e.id, e.lead_id, e.from_stage, e.to_stage, e.created_at, e.note, e.actor_label AS actor
           FROM lead_events e WHERE e.lead_id IN (${rows.map(() => "?").join(",")}) ORDER BY e.created_at`,
        rows.map((row) => row.id),
      )
    : [];
  const byLead = new Map<string, LeadDto["history"]>();
  for (const event of history) {
    const list = byLead.get(event.lead_id) ?? [];
    list.push({
      id: event.id,
      fromStage: event.from_stage,
      toStage: event.to_stage,
      at: event.created_at,
      actor: event.actor,
      note: event.note,
    });
    byLead.set(event.lead_id, list);
  }

  return json({
    items: rows.map((row) => mapLead(row, byLead.get(row.id) ?? [])),
    meta: {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    },
  });
}

type LeadRow = {
  id: string;
  code: string;
  business_id: string;
  contact_id: string | null;
  enquiry_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  stage: LeadStage;
  score: number;
  value_minor: number | null;
  source: LeadDto["source"];
  priority: "low" | "medium" | "high" | null;
  assignee_user_id: string | null;
  assignee_name: string | null;
  note: string | null;
  lost_reason: string | null;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  won_at: string | null;
};

type LeadEventRow = {
  id: string;
  lead_id: string;
  from_stage: string | null;
  to_stage: string;
  created_at: string;
  note: string | null;
  actor: string | null;
};

function mapLead(row: LeadRow, history: LeadDto["history"]): LeadDto {
  return {
    id: row.id,
    code: row.code,
    businessId: row.business_id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    stage: row.stage,
    score: row.score,
    valueMinor: row.value_minor,
    source: row.source,
    priority: row.priority,
    assigneeUserId: row.assignee_user_id,
    assigneeName: row.assignee_name,
    enquiryId: row.enquiry_id,
    contactId: row.contact_id,
    note: row.note,
    lastActivityAt: row.last_activity_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    wonAt: row.won_at,
    lostReason: row.lost_reason,
    history,
  };
}

export async function getLead(c: AppContext): Promise<Response> {
  const actor = await access(c, "leads:read");
  const row = await DB.first<LeadRow>(
    c.env,
    `SELECT ${LEAD_SELECT} ${LEAD_FROM} WHERE l.id = ? AND l.business_id = ?`,
    [c.params["leadId"] ?? "", actor.businessId],
  );
  if (!row) throw ApiError.notFound("Lead not found.");
  const historyRows = await DB.all<LeadEventRow>(
    c.env,
    "SELECT id, lead_id, from_stage, to_stage, created_at, note, actor_label AS actor FROM lead_events WHERE lead_id = ? ORDER BY created_at",
    [row.id],
  );
  const history = historyRows.map((event) => ({
    id: event.id,
    fromStage: event.from_stage,
    toStage: event.to_stage,
    at: event.created_at,
    actor: event.actor,
    note: event.note,
  }));
  const enquiry = row.enquiry_id
    ? await DB.first<{
        need: string;
        preferred_date: string | null;
        budget_minor: number | null;
        source: string;
      }>(c.env, "SELECT need, preferred_date, budget_minor, source FROM enquiries WHERE id = ?", [
        row.enquiry_id,
      ])
    : null;
  return json({ lead: mapLead(row, history), enquiry });
}

export async function createLead(c: AppContext): Promise<Response> {
  const actor = await access(c, "leads:write");
  const input = await parseBody(leadInput, c.request);
  const phone = input.phone ? normalizeNigerianPhone(input.phone) : null;
  if (input.phone && !phone) throw ApiError.validation({ phone: "Enter a valid Nigerian number." });

  const count = await DB.count(c.env, "SELECT COUNT(*) AS n FROM leads WHERE business_id = ?", [
    actor.businessId,
  ]);
  const code = `LD-${(1000 + count).toString()}`;
  const clash = await DB.first<{ id: string }>(c.env, "SELECT id FROM leads WHERE code = ?", [
    code,
  ]);
  const finalCode = clash ? `LD-${Date.now().toString().slice(-6)}` : code;

  const now = nowIso();
  const id = newId("led");
  const contact =
    input.phone || input.email ? await findOrCreateContact(c, actor.businessId, input) : null;
  const score = scoreLead({
    source: input.source,
    stage: input.stage,
    valueMinor: input.valueMinor ?? null,
    hoursSinceActivity: 0,
  });

  await DB.write(c.env, [
    {
      sql: `INSERT INTO leads (id, code, business_id, contact_id, name, phone, email, stage, score, value_minor, source,
              priority, assignee_user_id, note, last_activity_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        id,
        finalCode,
        actor.businessId,
        contact?.id ?? null,
        input.name,
        phone,
        input.email || null,
        input.stage,
        score,
        input.valueMinor ?? null,
        input.source,
        input.priority ?? "medium",
        input.ownerId ?? c.session?.user.id ?? null,
        input.note ?? null,
        now,
        now,
        now,
      ],
    },
    {
      sql: "INSERT INTO lead_events (id, lead_id, from_stage, to_stage, actor_user_id, actor_label, note, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?)",
      params: [
        newId("lev"),
        id,
        input.stage,
        c.session?.user.id ?? null,
        c.session?.user.displayName ?? "System",
        "Lead created in workspace",
        now,
      ],
    },
    {
      sql: "UPDATE businesses SET contacts_gained = (SELECT COUNT(*) FROM leads WHERE business_id = ?) WHERE id = ?",
      params: [actor.businessId, actor.businessId],
    },
  ]);

  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "lead.create",
    resourceType: "lead",
    resourceId: id,
    metadata: { code: finalCode, source: input.source, stage: input.stage },
    ipHash: c.ipHash,
    requestId: c.requestId,
  });
  return json({ ok: true, lead: await loadLead(c, id) }, { status: 201 });
}

async function findOrCreateContact(
  c: AppContext,
  businessId: string,
  input: { name: string; phone?: string | null | undefined; email?: string | null | undefined },
) {
  const phone = input.phone ? normalizeNigerianPhone(input.phone) : null;
  if (phone) {
    const existing = await DB.first<{ id: string }>(
      c.env,
      "SELECT id FROM contacts WHERE business_id = ? AND phone = ?",
      [businessId, phone],
    );
    if (existing) return existing;
  }
  const id = newId("con");
  const now = nowIso();
  await DB.run(
    c.env,
    `INSERT INTO contacts (id, business_id, name, phone, email, whatsapp, tags_json, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '[]', 'manual', ?, ?)`,
    [id, businessId, input.name, phone, input.email || null, phone, now, now],
  );
  return { id };
}

async function loadLead(c: AppContext, id: string): Promise<LeadDto> {
  const row = await DB.first<LeadRow>(c.env, `SELECT ${LEAD_SELECT} ${LEAD_FROM} WHERE l.id = ?`, [
    id,
  ]);
  if (!row) throw ApiError.notFound("Lead not found.");
  return mapLead(row, []);
}

export async function updateLead(c: AppContext): Promise<Response> {
  const actor = await access(c, "leads:write");
  const input = await parseBody(leadUpdateInput, c.request);
  const current = await DB.first<LeadRow>(
    c.env,
    `SELECT ${LEAD_SELECT} ${LEAD_FROM} WHERE l.id = ? AND l.business_id = ?`,
    [c.params["leadId"] ?? "", actor.businessId],
  );
  if (!current) throw ApiError.notFound("Lead not found.");

  const phone =
    input.phone === undefined
      ? current.phone
      : input.phone
        ? normalizeNigerianPhone(input.phone)
        : null;
  if (input.phone && !phone) throw ApiError.validation({ phone: "Enter a valid Nigerian number." });

  const next = {
    name: input.name ?? current.name,
    valueMinor: input.valueMinor === undefined ? current.value_minor : (input.valueMinor ?? null),
    source: (input.source ?? current.source) as LeadDto["source"],
    priority: input.priority ?? current.priority,
    assignee: input.ownerId === undefined ? current.assignee_user_id : (input.ownerId ?? null),
    note: input.note === undefined ? current.note : (input.note ?? null),
  };
  const score = scoreLead({
    source: next.source,
    stage: current.stage,
    valueMinor: next.valueMinor,
    hoursSinceActivity: Math.max(
      0,
      (Date.now() - new Date(current.last_activity_at).getTime()) / 3600_000,
    ),
  });

  await DB.run(
    c.env,
    `UPDATE leads SET name = ?, phone = ?, email = ?, value_minor = ?, source = ?, priority = ?, assignee_user_id = ?,
        note = ?, score = ?, updated_at = ? WHERE id = ? AND business_id = ?`,
    [
      next.name,
      phone,
      input.email === undefined ? current.email : input.email || null,
      next.valueMinor,
      next.source,
      next.priority,
      next.assignee,
      next.note,
      score,
      nowIso(),
      current.id,
      actor.businessId,
    ],
  );
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "lead.update",
    resourceType: "lead",
    resourceId: current.id,
    metadata: { score },
    requestId: c.requestId,
  });
  return json({ ok: true, lead: await loadLead(c, current.id) });
}

/**
 * Stage changes are the one write the CRM must not get wrong: the transition is
 * validated against the domain graph, the old row version is re-checked inside the
 * same statement (so two tabs cannot both "win" a lead) and history is appended.
 */
export async function moveLeadStage(c: AppContext): Promise<Response> {
  const actor = await access(c, "leads:write");
  const input = await parseBody(leadStageInput, c.request);
  const id = c.params["leadId"] ?? "";
  const current = await DB.first<{
    stage: LeadStage;
    last_activity_at: string;
    name: string;
    assignee_user_id: string | null;
    value_minor: number | null;
    source: LeadDto["source"];
  }>(
    c.env,
    "SELECT stage, last_activity_at, name, assignee_user_id, value_minor, source FROM leads WHERE id = ? AND business_id = ?",
    [id, actor.businessId],
  );
  if (!current) throw ApiError.notFound("Lead not found.");
  if (current.stage === input.stage) return json({ ok: true, unchanged: true, stage: input.stage });
  if (!canMoveStage(current.stage, input.stage)) {
    throw ApiError.domain(
      `Leads cannot move directly from "${current.stage}" to "${input.stage}". Use the pipeline steps in order.`,
      { stage: `Invalid transition: ${current.stage} → ${input.stage}` },
    );
  }
  if (input.stage === "lost" && !input.lostReason) {
    throw ApiError.validation({ lostReason: "Tell us why so the team can learn from it." });
  }

  // Optimistic concurrency: the UPDATE only lands if the stage has not moved since we read it.
  const now = nowIso();
  const result = await DB.run(
    c.env,
    `UPDATE leads SET stage = ?, score = ?, lost_reason = ?, won_at = ?, closed_at = ?, last_activity_at = ?, updated_at = ?,
            assignee_user_id = COALESCE(assignee_user_id, ?)
      WHERE id = ? AND business_id = ? AND stage = ?`,
    [
      input.stage,
      scoreLead({
        source: current.source,
        stage: input.stage,
        valueMinor: current.value_minor,
        hoursSinceActivity: 0,
      }),
      input.stage === "lost" ? (input.lostReason ?? null) : null,
      input.stage === "won" ? now : null,
      input.stage === "won" || input.stage === "lost" ? now : null,
      now,
      now,
      c.session?.user.id ?? null,
      id,
      actor.businessId,
      current.stage,
    ],
  );
  const changes = (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
  if (changes === 0) {
    throw ApiError.conflict("Someone else updated this lead a moment ago. Reload and try again.");
  }

  await DB.write(c.env, [
    {
      sql: "INSERT INTO lead_events (id, lead_id, from_stage, to_stage, actor_user_id, actor_label, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      params: [
        newId("lev"),
        id,
        current.stage,
        input.stage,
        c.session?.user.id ?? null,
        c.session?.user.displayName ?? "System",
        input.note ?? null,
        now,
      ],
    },
    {
      sql: `INSERT INTO metrics_daily (business_id, day, views, enquiries, whatsapp_chats, leads, won_value_minor, updated_at)
            VALUES (?, ?, 0, 0, 0, 0, ?, ?)
            ON CONFLICT (business_id, day) DO UPDATE SET won_value_minor = won_value_minor + excluded.won_value_minor, updated_at = excluded.updated_at`,
      params: [
        actor.businessId,
        today(),
        input.stage === "won" ? (current.value_minor ?? 0) : 0,
        now,
      ],
    },
  ]);

  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "lead.stage",
    resourceType: "lead",
    resourceId: id,
    metadata: { from: current.stage, to: input.stage },
    ipHash: c.ipHash,
    requestId: c.requestId,
  });

  return json({ ok: true, lead: await loadLead(c, id) });
}

export async function assignLead(c: AppContext): Promise<Response> {
  const actor = await access(c, "leads:write");
  const input = await parseBody(assignInput, c.request);
  const leadId = c.params["leadId"] ?? "";
  if (input.userId) {
    const member = await DB.first<{ user_id: string }>(
      c.env,
      "SELECT user_id FROM memberships WHERE business_id = ? AND user_id = ? AND status = 'active'",
      [actor.businessId, input.userId],
    );
    if (!member) throw ApiError.validation({ userId: "Assign work only to active team members." });
  }
  const now = nowIso();
  await DB.run(
    c.env,
    "UPDATE leads SET assignee_user_id = ?, last_activity_at = ?, updated_at = ? WHERE id = ? AND business_id = ?",
    [input.userId || null, now, now, leadId, actor.businessId],
  );
  if (input.userId) {
    await notify(c.env, {
      userId: input.userId,
      businessId: actor.businessId,
      kind: "lead_assigned",
      title: "A lead was assigned to you",
      body: input.note ?? "Open the workspace to reply while the enquiry is still warm.",
      href: "/app/leads",
      dedupeKey: `lead_assigned:${leadId}:${now.slice(0, 13)}`,
    });
  }
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "lead.assign",
    resourceType: "lead",
    resourceId: leadId,
    metadata: { assignee: input.userId ?? "unassigned" },
    requestId: c.requestId,
  });
  return json({ ok: true, lead: await loadLead(c, leadId) });
}

const assignInput = z.object({
  userId: z.string().max(40).optional().or(z.literal("")),
  note: z.string().trim().max(300).optional(),
});

export async function leadStats(c: AppContext): Promise<Response> {
  const actor = await access(c, "analytics:read");
  const rows = await DB.all<{ stage: LeadStage; n: number; value: number }>(
    c.env,
    "SELECT stage, COUNT(*) AS n, COALESCE(SUM(value_minor), 0) AS value FROM leads WHERE business_id = ? GROUP BY stage",
    [actor.businessId],
  );
  const byStage = new Map(rows.map((row) => [row.stage, row]));
  return json({
    stages: LEAD_STAGES.map((stage) => ({
      stage,
      count: Number(byStage.get(stage)?.n ?? 0),
      valueMinor: Number(byStage.get(stage)?.value ?? 0),
    })),
  });
}

// ---------------------------------------------------------------- contacts ----

export async function listContacts(c: AppContext): Promise<Response> {
  const actor = await access(c, "leads:read");
  const term = (c.url.searchParams.get("q") ?? "").trim().toLowerCase();
  const page = Math.min(200, Math.max(1, Number(c.url.searchParams.get("page")) || 1));
  const params: unknown[] = [actor.businessId];
  let whereSql = "business_id = ?";
  if (term) {
    whereSql += " AND (lower(name) LIKE ? OR phone LIKE ? OR lower(COALESCE(email,'')) LIKE ?)";
    const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    params.push(like, like, like);
  }
  const [rows, total] = await Promise.all([
    DB.all<{
      id: string;
      name: string;
      phone: string | null;
      email: string | null;
      tags_json: string | null;
      source: string;
      message_count: number;
      last_contacted_at: string | null;
      created_at: string;
      lead_count: number;
    }>(
      c.env,
      `SELECT id, name, phone, email, tags_json, source, message_count, last_contacted_at, created_at,
              (SELECT COUNT(*) FROM leads l WHERE l.contact_id = contacts.id) AS lead_count
         FROM contacts WHERE ${whereSql} ORDER BY COALESCE(last_contacted_at, created_at) DESC LIMIT 50 OFFSET ?`,
      [...params, (page - 1) * 50],
    ),
    DB.count(c.env, `SELECT COUNT(*) AS n FROM contacts WHERE ${whereSql}`, params),
  ]);
  return json({
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      tags: parseArray(row.tags_json),
      source: row.source,
      messageCount: Number(row.message_count ?? 0),
      leadCount: Number(row.lead_count ?? 0),
      lastContactedAt: row.last_contacted_at,
      createdAt: row.created_at,
    })),
    meta: { page, perPage: 50, total, totalPages: Math.max(1, Math.ceil(total / 50)) },
  });
}

export async function createContact(c: AppContext): Promise<Response> {
  const actor = await access(c, "leads:write");
  const input = await parseBody(contactInput, c.request);
  const phone = input.phone ? normalizeNigerianPhone(input.phone) : null;
  if (input.phone && !phone) throw ApiError.validation({ phone: "Enter a valid Nigerian number." });
  const clash = phone
    ? await DB.first<{ id: string }>(
        c.env,
        "SELECT id FROM contacts WHERE business_id = ? AND phone = ?",
        [actor.businessId, phone],
      )
    : null;
  if (clash)
    throw ApiError.conflict("You already have a contact with that number.", {
      phone: "Duplicate contact.",
    });
  const id = newId("con");
  const now = nowIso();
  await DB.run(
    c.env,
    `INSERT INTO contacts (id, business_id, name, phone, email, whatsapp, tags_json, notes, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)`,
    [
      id,
      actor.businessId,
      input.name,
      phone,
      input.email?.toLowerCase() || null,
      phone,
      JSON.stringify(input.tags),
      input.notes || null,
      now,
      now,
    ],
  );
  return json({ ok: true, id }, { status: 201 });
}

export async function updateContact(c: AppContext): Promise<Response> {
  const actor = await access(c, "leads:write");
  const input = await parseBody(contactInput, c.request);
  const phone = input.phone ? normalizeNigerianPhone(input.phone) : null;
  const result = await DB.run(
    c.env,
    "UPDATE contacts SET name = ?, phone = ?, email = ?, whatsapp = ?, tags_json = ?, notes = ?, updated_at = ? WHERE id = ? AND business_id = ?",
    [
      input.name,
      phone,
      input.email?.toLowerCase() || null,
      phone,
      JSON.stringify(input.tags),
      input.notes || null,
      nowIso(),
      c.params["contactId"] ?? "",
      actor.businessId,
    ],
  );
  if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
    throw ApiError.notFound("Contact not found.");
  return json({ ok: true });
}

// ------------------------------------------------------------------- tasks ----

export async function listTasks(c: AppContext): Promise<Response> {
  const actor = await access(c, "tasks:write");
  const status = c.url.searchParams.get("status");
  const rows = await DB.all<{
    id: string;
    title: string;
    due_at: string | null;
    priority: "low" | "medium" | "high";
    status: string;
    assignee_user_id: string | null;
    assignee: string | null;
    lead_code: string | null;
    lead_name: string | null;
    created_at: string;
  }>(
    c.env,
    `SELECT t.id, t.title, t.due_at, t.priority, t.status, t.assignee_user_id, t.created_at,
            a.display_name AS assignee, l.code AS lead_code, l.name AS lead_name
       FROM tasks t LEFT JOIN users a ON a.id = t.assignee_user_id LEFT JOIN leads l ON l.id = t.lead_id
      WHERE t.business_id = ? ${status === "open" || status === "done" ? "AND t.status = ?" : ""}
      ORDER BY CASE WHEN t.due_at IS NULL THEN 1 ELSE 0 END, t.due_at, t.priority DESC LIMIT 100`,
    status === "open" || status === "done" ? [actor.businessId, status] : [actor.businessId],
  );
  return json({
    items: rows.map((row) => ({
      id: row.id,
      title: row.title,
      dueAt: row.due_at,
      priority: row.priority,
      status: row.status,
      assigneeUserId: row.assignee_user_id,
      assignee: row.assignee,
      lead: row.lead_code ? { code: row.lead_code, name: row.lead_name } : null,
      createdAt: row.created_at,
    })),
  });
}

export async function createTask(c: AppContext): Promise<Response> {
  const actor = await access(c, "tasks:write");
  const input = await parseBody(taskInput, c.request);
  if (input.leadId) {
    const lead = await DB.first<{ id: string }>(
      c.env,
      "SELECT id FROM leads WHERE id = ? AND business_id = ?",
      [input.leadId, actor.businessId],
    );
    if (!lead) throw ApiError.validation({ leadId: "That lead is not in your workspace." });
  }
  const id = newId("tsk");
  const now = nowIso();
  await DB.run(
    c.env,
    `INSERT INTO tasks (id, business_id, lead_id, title, due_at, priority, status, assignee_user_id, created_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'open', ?, ?, ?, ?)`,
    [
      id,
      actor.businessId,
      input.leadId ?? null,
      input.title,
      input.dueAt ? new Date(input.dueAt).toISOString() : null,
      input.priority,
      input.assigneeUserId ?? c.session?.user.id ?? null,
      c.session?.user.id ?? null,
      now,
      now,
    ],
  );
  return json({ ok: true, id }, { status: 201 });
}

export async function updateTask(c: AppContext): Promise<Response> {
  const actor = await access(c, "tasks:write");
  const input = await parseBody(taskUpdateInput, c.request);
  const now = nowIso();
  const result = await DB.run(
    c.env,
    `UPDATE tasks SET title = ?, due_at = ?, priority = ?, status = ?, assignee_user_id = ?, completed_at = ?, updated_at = ?
      WHERE id = ? AND business_id = ?`,
    [
      input.title,
      input.dueAt ? new Date(input.dueAt).toISOString() : null,
      input.priority,
      input.status,
      input.assigneeUserId ?? null,
      input.status === "done" ? now : null,
      now,
      c.params["taskId"] ?? "",
      actor.businessId,
    ],
  );
  if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
    throw ApiError.notFound("Task not found.");
  return json({ ok: true });
}

const taskUpdateInput = z.object({
  title: z.string().trim().min(3).max(200).optional(),
  dueAt: z.string().max(40).optional().or(z.literal("")),
  priority: z.enum(["low", "medium", "high"]).optional(),
  status: z.enum(["open", "done", "archived"]).optional(),
  assigneeUserId: z.string().max(40).optional().or(z.literal("")),
});

export async function toggleTask(c: AppContext): Promise<Response> {
  const actor = await access(c, "tasks:write");
  const now = nowIso();
  const result = await DB.run(
    c.env,
    `UPDATE tasks SET status = CASE WHEN status = 'done' THEN 'open' ELSE 'done' END,
            completed_at = CASE WHEN status = 'done' THEN NULL ELSE ? END, updated_at = ?
      WHERE id = ? AND business_id = ?`,
    [now, now, c.params["taskId"] ?? "", actor.businessId],
  );
  if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
    throw ApiError.notFound("Task not found.");
  // Returned so a row can flip in place without refetching the list.
  const task = await DB.first<{
    id: string;
    title: string;
    due_at: string | null;
    priority: "low" | "medium" | "high";
    status: string;
    completed_at: string | null;
  }>(
    c.env,
    "SELECT id, title, due_at, priority, status, completed_at FROM tasks WHERE id = ? AND business_id = ?",
    [c.params["taskId"] ?? "", actor.businessId],
  );
  return json({
    ok: true,
    task: task
      ? {
          id: task.id,
          title: task.title,
          dueAt: task.due_at,
          priority: task.priority,
          status: task.status,
          completedAt: task.completed_at,
        }
      : null,
  });
}

export async function deleteTask(c: AppContext): Promise<Response> {
  const actor = await access(c, "tasks:write");
  await DB.run(
    c.env,
    "UPDATE tasks SET status = 'archived', updated_at = ? WHERE id = ? AND business_id = ?",
    [nowIso(), c.params["taskId"] ?? "", actor.businessId],
  );
  return json({ ok: true });
}

// -------------------------------------------------------------- inbox (enq) ----

export async function listEnquiries(c: AppContext): Promise<Response> {
  const actor = await access(c, "enquiries:read");
  const status = c.url.searchParams.get("status");
  const params: unknown[] = [actor.businessId];
  let whereSql = "e.business_id = ?";
  if (status && ["new", "read", "replied", "closed"].includes(status)) {
    whereSql += " AND e.status = ?";
    params.push(status);
  }
  const rows = await DB.all<EnquiryRow>(
    c.env,
    `SELECT e.id, e.name, e.phone, e.email, e.need, e.status, e.source, e.created_at, e.last_message_at, e.reply_count,
            l.id AS lead_id, l.code AS lead_code, l.stage AS lead_stage, s.name AS service_name, b.whatsapp,
            (SELECT COUNT(*) FROM enquiry_messages m WHERE m.enquiry_id = e.id) AS message_count
       FROM enquiries e
       LEFT JOIN leads l ON l.enquiry_id = e.id
       LEFT JOIN services s ON s.id = e.service_id
       JOIN businesses b ON b.id = e.business_id
      WHERE ${whereSql} ORDER BY e.last_message_at DESC LIMIT 50`,
    params,
  );

  return json({
    items: rows.map((row) => ({
      id: row.id,
      name: row.name,
      // Contact details are shown to the business that owns the enquiry, and are
      // truncated for the list view so a shoulder-surfed screen leaks nothing.
      phone: row.phone,
      email: row.email,
      need: row.need,
      status: row.status,
      source: row.source,
      createdAt: row.created_at,
      lastMessageAt: row.last_message_at,
      replyCount: Number(row.reply_count ?? 0),
      messageCount: Number(row.message_count ?? 0),
      lead: row.lead_code ? { code: row.lead_code, stage: row.lead_stage } : null,
      serviceName: row.service_name,
      whatsappUrl: row.whatsapp ? `https://wa.me/${row.whatsapp.replace(/\D/g, "")}` : null,
    })),
  });
}

type EnquiryRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  need: string;
  status: string;
  source: string;
  created_at: string;
  last_message_at: string;
  reply_count: number | null;
  lead_id: string | null;
  lead_code: string | null;
  lead_stage: string | null;
  service_name: string | null;
  whatsapp: string | null;
  message_count: number | null;
};

export async function getEnquiry(c: AppContext): Promise<Response> {
  const actor = await access(c, "enquiries:read");
  const enquiry = await DB.first<
    EnquiryRow & { preferred_date: string | null; budget_minor: number | null }
  >(
    c.env,
    `SELECT e.id, e.name, e.phone, e.email, e.need, e.status, e.source, e.created_at, e.last_message_at, e.reply_count,
            e.preferred_date, e.budget_minor, l.id AS lead_id, l.code AS lead_code, l.stage AS lead_stage,
            (SELECT COUNT(*) FROM enquiry_messages m WHERE m.enquiry_id = e.id) AS message_count
       FROM enquiries e LEFT JOIN leads l ON l.enquiry_id = e.id
      WHERE e.id = ? AND e.business_id = ?`,
    [c.params["enquiryId"] ?? "", actor.businessId],
  );
  if (!enquiry) throw ApiError.notFound("Enquiry not found.");
  const messages = await DB.all<{
    id: string;
    body: string;
    from_business: number;
    created_at: string;
    author: string | null;
  }>(
    c.env,
    `SELECT m.id, m.body, m.from_business, m.created_at, u.display_name AS author
       FROM enquiry_messages m LEFT JOIN users u ON u.id = m.author_user_id
      WHERE m.enquiry_id = ? ORDER BY m.created_at`,
    [enquiry.id],
  );
  return json({ enquiry, messages });
}

export async function setEnquiryStatus(c: AppContext): Promise<Response> {
  const actor = await access(c, "enquiries:reply");
  const input = await parseBody(enquiryStatusInput, c.request);
  const now = nowIso();
  const result = await DB.run(
    c.env,
    "UPDATE enquiries SET status = ?, updated_at = ? WHERE id = ? AND business_id = ?",
    [input.status, now, c.params["enquiryId"] ?? "", actor.businessId],
  );
  if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
    throw ApiError.notFound("Enquiry not found.");
  return json({ ok: true, status: input.status });
}

export async function replyToEnquiry(c: AppContext): Promise<Response> {
  const actor = await access(c, "enquiries:reply");
  const input = await parseBody(replyInput, c.request);
  const enquiryId = c.params["enquiryId"] ?? "";
  const now = nowIso();
  const exists = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM enquiries WHERE id = ? AND business_id = ?",
    [enquiryId, actor.businessId],
  );
  if (!exists) throw ApiError.notFound("Enquiry not found.");

  await DB.write(c.env, [
    {
      sql: "INSERT INTO enquiry_messages (id, enquiry_id, author_user_id, from_business, body, created_at) VALUES (?, ?, ?, 1, ?, ?)",
      params: [newId("msg"), enquiryId, c.session?.user.id ?? null, input.body, now],
    },
    {
      sql: "UPDATE enquiries SET status = 'replied', reply_count = reply_count + 1, owner_reply = ?, last_message_at = ?, updated_at = ? WHERE id = ?",
      params: [input.body.slice(0, 900), now, now, enquiryId],
    },
    {
      sql: "UPDATE leads SET stage = CASE WHEN stage = 'new' THEN 'qualified' ELSE stage END, last_activity_at = ?, updated_at = ? WHERE enquiry_id = ? AND business_id = ?",
      params: [now, now, enquiryId, actor.businessId],
    },
  ]);

  if (input.notifySender && input.senderEmail) {
    c.execution.waitUntil(
      notifyByEmail(c, input.senderEmail, `A reply from ${actor.business.name}`, input.body).catch(
        () => undefined,
      ),
    );
  }
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "enquiry.reply",
    resourceType: "enquiry",
    resourceId: enquiryId,
    requestId: c.requestId,
  });
  return json({ ok: true }, { status: 201 });
}

async function notifyByEmail(
  c: AppContext,
  to: string,
  subject: string,
  body: string,
): Promise<void> {
  await sendMail(c.env, { to, subject, text: body });
}

const replyInput = z.object({
  body: z.string().trim().min(2).max(2000),
  notifySender: z.boolean().default(false),
  senderEmail: z.string().email().optional(),
});

function parseArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
