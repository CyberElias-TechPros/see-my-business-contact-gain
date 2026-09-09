import { z } from "zod";

import {
  automationInput,
  billingChangeInput,
  campaignInput,
  linkInput,
  teamInviteInput,
} from "../../../shared/api.ts";
import { PLAN_LIMITS, PLAN_PRICING_MINOR, type BusinessPlan } from "../../../shared/domain.ts";
import { hashToken, randomId, shortCode } from "../crypto.ts";
import { DB } from "../db-access.ts";
import { newId, nowIso, today } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseBody } from "../http.ts";
import { recordAudit } from "../audit.ts";
import { notify } from "../notifications.ts";
import { assertWithinPlan, access } from "./guards.ts";
import { frontendUrl, sendMail } from "../mail.ts";
import type { AppContext } from "../types.ts";

// ------------------------------------------------------------ links & QR ----

export async function listLinks(c: AppContext): Promise<Response> {
  const actor = await access(c, "links:write");
  const rows = await DB.all<LinkRow>(
    c.env,
    `SELECT l.id, l.code, l.label, l.kind, l.target_url, l.whatsapp_message, l.scans, l.clicks, l.chats_started,
            l.leads_created, l.active, l.created_at, ca.name AS campaign_name,
            (SELECT COUNT(*) FROM enquiries e WHERE e.link_id = l.id) AS enquiries
       FROM links l LEFT JOIN campaigns ca ON ca.id = l.campaign_id
      WHERE l.business_id = ? ORDER BY l.created_at DESC LIMIT 100`,
    [actor.businessId],
  );
  const base = (c.env.PUBLIC_URL ?? "https://gainhub.ng").replace(/\/$/, "");
  return json({
    items: rows.map((row) => ({
      id: row.id,
      code: row.code,
      label: row.label,
      kind: row.kind,
      shortUrl: `${base}/go/${row.code}`,
      targetUrl: row.target_url,
      whatsappMessage: row.whatsapp_message,
      scans: Number(row.scans ?? 0),
      clicks: Number(row.clicks ?? 0),
      chatsStarted: Number(row.chats_started ?? 0),
      enquiries: Number(row.enquiries ?? 0),
      leadsCreated: Number(row.leads_created ?? 0),
      active: row.active === 1,
      campaign: row.campaign_name,
      createdAt: row.created_at,
      qrPayload: `${base}/go/${row.code}`,
    })),
  });
}

type LinkRow = {
  id: string;
  code: string;
  label: string;
  kind: string;
  target_url: string | null;
  whatsapp_message: string | null;
  scans: number | null;
  clicks: number | null;
  chats_started: number | null;
  leads_created: number | null;
  active: number;
  created_at: string;
  campaign_name: string | null;
  enquiries: number | null;
};

export async function createLink(c: AppContext): Promise<Response> {
  const actor = await access(c, "links:write");
  const input = await parseBody(linkInput, c.request);
  const current = await DB.count(
    c.env,
    "SELECT COUNT(*) AS n FROM links WHERE business_id = ? AND active = 1",
    [actor.businessId],
  );
  await assertWithinPlan(c, actor.businessId, "links", current + 1);

  if (input.campaignId) {
    const campaign = await DB.first<{ id: string }>(
      c.env,
      "SELECT id FROM campaigns WHERE id = ? AND business_id = ?",
      [input.campaignId, actor.businessId],
    );
    if (!campaign)
      throw ApiError.validation({ campaignId: "That campaign is not in your workspace." });
  }

  let code = shortCode(7);
  for (let attempt = 0; attempt < 5; attempt++) {
    const clash = await DB.first<{ id: string }>(c.env, "SELECT id FROM links WHERE code = ?", [
      code,
    ]);
    if (!clash) break;
    code = shortCode(8);
  }

  const business = await DB.first<{ whatsapp: string | null; slug: string }>(
    c.env,
    "SELECT whatsapp, slug FROM businesses WHERE id = ?",
    [actor.businessId],
  );
  const target =
    input.targetUrl ||
    (input.kind === "whatsapp" && business?.whatsapp
      ? `https://wa.me/${business.whatsapp.replace(/\D/g, "")}${input.message ? `?text=${encodeURIComponent(input.message)}` : ""}`
      : `${(c.env.PUBLIC_URL ?? "https://gainhub.ng").replace(/\/$/, "")}/business/${business?.slug ?? ""}`);
  if (!target.startsWith("https://"))
    throw ApiError.validation({ targetUrl: "Destination must be an https:// URL." });

  const id = newId("lnk");
  const now = nowIso();
  await DB.run(
    c.env,
    `INSERT INTO links (id, code, business_id, campaign_id, label, kind, target_url, whatsapp_message, created_by, active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      id,
      code,
      actor.businessId,
      input.campaignId ?? null,
      input.label,
      input.kind,
      target,
      input.message ?? null,
      c.session?.user.id ?? null,
      now,
      now,
    ],
  );
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "link.create",
    resourceType: "link",
    resourceId: id,
    metadata: { code, kind: input.kind },
    requestId: c.requestId,
  });
  return json(
    {
      ok: true,
      id,
      code,
      shortUrl: `${(c.env.PUBLIC_URL ?? c.url.origin).replace(/\/$/, "")}/go/${code}`,
    },
    { status: 201 },
  );
}

export async function setLinkActive(c: AppContext): Promise<Response> {
  const actor = await access(c, "links:write");
  const input = await parseBody(activeFlag, c.request);
  const result = await DB.run(
    c.env,
    "UPDATE links SET active = ?, updated_at = ? WHERE id = ? AND business_id = ?",
    [input.active ? 1 : 0, nowIso(), c.params["linkId"] ?? "", actor.businessId],
  );
  if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
    throw ApiError.notFound("Link not found.");
  return json({ ok: true, active: input.active });
}

const activeFlag = z.object({ active: z.boolean() });

export async function linkStats(c: AppContext): Promise<Response> {
  const actor = await access(c, "analytics:read");
  const link = await DB.first<{ id: string; code: string; label: string }>(
    c.env,
    "SELECT id, code, label FROM links WHERE id = ? AND business_id = ?",
    [c.params["linkId"] ?? "", actor.businessId],
  );
  if (!link) throw ApiError.notFound("Link not found.");
  const [days, totals] = await Promise.all([
    DB.all<{ day: string; scans: number; clicks: number; chats: number }>(
      c.env,
      `SELECT day,
              SUM(CASE WHEN kind = 'scan' THEN 1 ELSE 0 END) AS scans,
              SUM(CASE WHEN kind = 'click' THEN 1 ELSE 0 END) AS clicks,
              SUM(CASE WHEN kind = 'chat' THEN 1 ELSE 0 END) AS chats
         FROM link_events WHERE link_id = ? AND day >= date('now', '-29 days') GROUP BY day ORDER BY day`,
      [link.id],
    ),
    DB.first<{ enquiries: number; leads: number; value: number }>(
      c.env,
      `SELECT (SELECT COUNT(*) FROM enquiries WHERE link_id = ?) AS enquiries,
              (SELECT COUNT(*) FROM leads WHERE enquiry_id IN (SELECT id FROM enquiries WHERE link_id = ?)) AS leads,
              (SELECT COALESCE(SUM(value_minor), 0) FROM leads WHERE enquiry_id IN (SELECT id FROM enquiries WHERE link_id = ?) AND stage = 'won') AS value`,
      [link.id, link.id, link.id],
    ),
  ]);
  return json({
    link: { id: link.id, code: link.code, label: link.label },
    days: days.map((row) => ({
      date: row.day,
      scans: Number(row.scans),
      clicks: Number(row.clicks),
      chats: Number(row.chats),
    })),
    totals: {
      enquiries: Number(totals?.enquiries ?? 0),
      leads: Number(totals?.leads ?? 0),
      wonValueMinor: Number(totals?.value ?? 0),
    },
  });
}

// -------------------------------------------------------------- campaigns ----

export async function listCampaigns(c: AppContext): Promise<Response> {
  const actor = await access(c, "campaigns:write");
  const rows = await DB.all<{
    id: string;
    name: string;
    channel: string;
    status: string;
    budget_minor: number | null;
    spend_minor: number;
    starts_at: string | null;
    ends_at: string | null;
    created_at: string;
    links: number;
    enquiries: number;
    leads: number;
    won: number;
  }>(
    c.env,
    `SELECT ca.id, ca.name, ca.channel, ca.status, ca.budget_minor, ca.spend_minor, ca.starts_at, ca.ends_at, ca.created_at,
            (SELECT COUNT(*) FROM links l WHERE l.campaign_id = ca.id) AS links,
            (SELECT COUNT(*) FROM enquiries e WHERE e.campaign_id = ca.id) AS enquiries,
            (SELECT COUNT(*) FROM leads le WHERE le.enquiry_id IN (SELECT id FROM enquiries WHERE campaign_id = ca.id)) AS leads,
            (SELECT COALESCE(SUM(value_minor), 0) FROM leads le WHERE le.stage = 'won' AND le.enquiry_id IN (SELECT id FROM enquiries WHERE campaign_id = ca.id)) AS won
       FROM campaigns ca WHERE ca.business_id = ? ORDER BY ca.created_at DESC LIMIT 50`,
    [actor.businessId],
  );
  return json({
    items: rows.map((row) => {
      const enquiries = Number(row.enquiries ?? 0);
      const budget = row.budget_minor ?? null;
      return {
        id: row.id,
        name: row.name,
        channel: row.channel,
        status: row.status,
        budgetMinor: budget,
        spendMinor: Number(row.spend_minor ?? 0),
        links: Number(row.links ?? 0),
        enquiries,
        leads: Number(row.leads ?? 0),
        wonValueMinor: Number(row.won ?? 0),
        costPerEnquiryMinor: enquiries
          ? Math.round(Number(row.spend_minor ?? 0) / enquiries)
          : null,
        startsAt: row.starts_at,
        endsAt: row.ends_at,
        createdAt: row.created_at,
      };
    }),
  });
}

export async function createCampaign(c: AppContext): Promise<Response> {
  const actor = await access(c, "campaigns:write");
  const input = await parseBody(campaignInput, c.request);
  const current = await DB.count(
    c.env,
    "SELECT COUNT(*) AS n FROM campaigns WHERE business_id = ?",
    [actor.businessId],
  );
  await assertWithinPlan(c, actor.businessId, "campaigns", current + 1);
  const id = newId("cmp");
  const now = nowIso();
  await DB.run(
    c.env,
    `INSERT INTO campaigns (id, business_id, name, channel, status, budget_minor, starts_at, ends_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      actor.businessId,
      input.name,
      input.channel,
      input.status,
      input.budgetMinor ?? null,
      input.startsAt ?? null,
      input.endsAt ?? null,
      now,
      now,
    ],
  );
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "campaign.create",
    resourceType: "campaign",
    resourceId: id,
    metadata: { channel: input.channel, status: input.status },
    requestId: c.requestId,
  });
  return json({ ok: true, id }, { status: 201 });
}

export async function updateCampaign(c: AppContext): Promise<Response> {
  const actor = await access(c, "campaigns:write");
  const input = await parseBody(campaignInput.partial(), c.request);
  const id = c.params["campaignId"] ?? "";
  const sets: string[] = [];
  const params: unknown[] = [];
  if (input.name !== undefined) {
    sets.push("name = ?");
    params.push(input.name);
  }
  if (input.status !== undefined) {
    sets.push("status = ?");
    params.push(input.status);
  }
  if (input.budgetMinor !== undefined) {
    sets.push("budget_minor = ?");
    params.push(input.budgetMinor);
  }
  if (input.channel !== undefined) {
    sets.push("channel = ?");
    params.push(input.channel);
  }
  if (sets.length === 0) return json({ ok: true, unchanged: true });
  sets.push("updated_at = ?");
  params.push(nowIso(), id, actor.businessId);
  const result = await DB.run(
    c.env,
    `UPDATE campaigns SET ${sets.join(", ")} WHERE id = ? AND business_id = ?`,
    params,
  );
  if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
    throw ApiError.notFound("Campaign not found.");
  return json({ ok: true });
}

// ------------------------------------------------------------ automations ----

export async function listAutomations(c: AppContext): Promise<Response> {
  const actor = await access(c, "automation:write");
  const rows = await DB.all<{
    id: string;
    trigger_key: string;
    action: string;
    config_json: string | null;
    enabled: number;
    runs: number;
    last_run_at: string | null;
    created_at: string;
  }>(
    c.env,
    `SELECT id, trigger_key, action, config_json, enabled, runs, last_run_at, created_at FROM automations
      WHERE business_id = ? ORDER BY created_at DESC`,
    [actor.businessId],
  );
  const limits =
    PLAN_LIMITS[
      (
        await DB.first<{ plan: BusinessPlan }>(c.env, "SELECT plan FROM businesses WHERE id = ?", [
          actor.businessId,
        ])
      )?.plan ?? "free"
    ];
  return json({
    plan: limits,
    items: rows.map((row) => ({
      id: row.id,
      trigger: row.trigger_key,
      action: row.action,
      config: parseJson<Record<string, unknown>>(row.config_json, {}),
      enabled: row.enabled === 1,
      runs: Number(row.runs ?? 0),
      lastRunAt: row.last_run_at,
      createdAt: row.created_at,
    })),
    limit: limits.automations,
  });
}

export async function createAutomation(c: AppContext): Promise<Response> {
  const actor = await access(c, "automation:write");
  const input = await parseBody(automationInput, c.request);
  const current = await DB.count(
    c.env,
    "SELECT COUNT(*) AS n FROM automations WHERE business_id = ?",
    [actor.businessId],
  );
  await assertWithinPlan(c, actor.businessId, "automations", current + 1);
  const id = newId("aut");
  const now = nowIso();
  await DB.run(
    c.env,
    `INSERT INTO automations (id, business_id, trigger_key, action, config_json, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id, trigger_key) DO UPDATE SET action = excluded.action, config_json = excluded.config_json, enabled = excluded.enabled, updated_at = excluded.updated_at`,
    [
      id,
      actor.businessId,
      input.trigger,
      input.action,
      JSON.stringify(input.config),
      input.enabled ? 1 : 0,
      now,
      now,
    ],
  );
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "automation.upsert",
    resourceType: "automation",
    resourceId: id,
    metadata: { trigger: input.trigger, action: input.action },
    requestId: c.requestId,
  });
  return json({ ok: true, id }, { status: 201 });
}

export async function toggleAutomation(c: AppContext): Promise<Response> {
  const actor = await access(c, "automation:write");
  const input = await parseBody(activeFlag, c.request);
  const result = await DB.run(
    c.env,
    "UPDATE automations SET enabled = ?, updated_at = ? WHERE id = ? AND business_id = ?",
    [input.active ? 1 : 0, nowIso(), c.params["automationId"] ?? "", actor.businessId],
  );
  if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
    throw ApiError.notFound("Automation not found.");
  return json({ ok: true, enabled: input.active });
}

export async function deleteAutomation(c: AppContext): Promise<Response> {
  const actor = await access(c, "automation:write");
  await DB.run(c.env, "DELETE FROM automations WHERE id = ? AND business_id = ?", [
    c.params["automationId"] ?? "",
    actor.businessId,
  ]);
  return json({ ok: true });
}

// -------------------------------------------------------------------- team ----

export async function listTeam(c: AppContext): Promise<Response> {
  const actor = await access(c, "profile:read");
  const rows = await DB.all<{
    user_id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    last_login_at: string | null;
    joined_at: string | null;
    assigned: number | null;
  }>(
    c.env,
    `SELECT m.user_id, u.display_name AS name, u.email, m.role, m.status, u.last_login_at, m.joined_at,
            (SELECT COUNT(*) FROM leads l WHERE l.assignee_user_id = m.user_id AND l.business_id = m.business_id AND l.stage NOT IN ('won','lost')) AS assigned
       FROM memberships m JOIN users u ON u.id = m.user_id
      WHERE m.business_id = ? AND m.status <> 'revoked'
      ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, u.display_name`,
    [actor.businessId],
  );
  return json({
    items: rows.map((row) => ({
      userId: row.user_id,
      name: row.name,
      email: row.email,
      role: row.role,
      status: row.status,
      lastLoginAt: row.last_login_at,
      joinedAt: row.joined_at,
      openLeads: Number(row.assigned ?? 0),
    })),
    seats: await seats(c, actor.businessId),
  });
}

async function seats(c: AppContext, businessId: string) {
  const plan =
    (
      await DB.first<{ plan: BusinessPlan }>(c.env, "SELECT plan FROM businesses WHERE id = ?", [
        businessId,
      ])
    )?.plan ?? "free";
  const used = await DB.count(
    c.env,
    "SELECT COUNT(*) AS n FROM memberships WHERE business_id = ? AND status = 'active'",
    [businessId],
  );
  return { plan, used, limit: PLAN_LIMITS[plan].teamSeats };
}

export async function inviteTeamMember(c: AppContext): Promise<Response> {
  const actor = await access(c, "team:manage");
  const input = await parseBody(teamInviteInput, c.request);
  const seatInfo = await seats(c, actor.businessId);
  if (seatInfo.used >= seatInfo.limit) {
    throw ApiError.domain(
      `The ${seatInfo.plan} plan includes ${seatInfo.limit} seat${seatInfo.limit === 1 ? "" : "s"}. Upgrade to invite more people.`,
    );
  }
  const invited = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM users WHERE email_normalized = ?",
    [input.email],
  );
  if (invited) {
    const member = await DB.first<{ user_id: string }>(
      c.env,
      "SELECT user_id FROM memberships WHERE business_id = ? AND user_id = ? AND status = 'active'",
      [actor.businessId, invited.id],
    );
    if (member) throw ApiError.conflict("That person is already on your team.");
  }
  const token = randomId("inv");
  const now = nowIso();
  const userId = invited?.id ?? newId("usr");

  await DB.write(c.env, [
    // Placeholder account so the seat exists before the invite is accepted; it has
    // no password and cannot sign in until the invite link sets one.
    invited
      ? { sql: "SELECT 1", params: [] }
      : {
          sql: `INSERT INTO users (id, email, email_normalized, display_name, role, status, password_hash, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'staff', 'active', 'unset', ?, ?)`,
          params: [userId, input.email, input.email, input.email.split("@")[0], now, now],
        },
    {
      sql: `INSERT INTO memberships (user_id, business_id, role, status, invited_by, invite_token_hash, invited_at)
            VALUES (?, ?, ?, 'invited', ?, ?, ?)
            ON CONFLICT (user_id, business_id) DO UPDATE SET role = excluded.role, status = 'invited', invite_token_hash = excluded.invite_token_hash, invited_at = excluded.invited_at, revoked_at = NULL`,
      params: [
        userId,
        actor.businessId,
        input.role,
        c.session?.user.id ?? null,
        await hashToken(token),
        now,
      ],
    },
  ]);

  const businessName = await DB.first<{ name: string }>(
    c.env,
    "SELECT name FROM businesses WHERE id = ?",
    [actor.businessId],
  );
  await notify(c.env, {
    userId,
    businessId: actor.businessId,
    kind: "team_invite",
    title: `Invitation to ${businessName?.name ?? "a workspace"}`,
    body: `${c.session?.user.displayName ?? "A colleague"} added you as ${input.role}.`,
    href: `/accept-invite?token=${token}`,
    dedupeKey: `team_invite:${actor.businessId}:${userId}`,
  });
  if (invited) {
    c.execution.waitUntil(
      sendMail(c.env, {
        to: input.email,
        subject: `You have been invited to ${businessName?.name ?? "GainHub"}`,
        text: `Open ${frontendUrl(c.env, `/accept-invite?token=${token}`)} to accept.`,
      }).catch(() => undefined),
    );
  }

  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "team.invite",
    resourceType: "membership",
    resourceId: userId,
    metadata: { role: input.role },
    requestId: c.requestId,
  });
  return json(
    { ok: true, inviteUrl: frontendUrl(c.env, `/accept-invite?token=${token}`) },
    { status: 201 },
  );
}

export async function removeTeamMember(c: AppContext): Promise<Response> {
  const actor = await access(c, "team:manage");
  const targetId = c.params["userId"] ?? "";
  if (targetId === c.session?.user.id)
    throw ApiError.domain("You cannot remove yourself; ask another owner to transfer the listing.");
  const target = await DB.first<{ role: string }>(
    c.env,
    "SELECT role FROM memberships WHERE business_id = ? AND user_id = ?",
    [actor.businessId, targetId],
  );
  if (!target) throw ApiError.notFound("That person is not on your team.");
  if (target.role === "owner")
    throw ApiError.domain("Transfer ownership before removing the owner.");
  const now = nowIso();
  await DB.write(c.env, [
    {
      sql: "UPDATE memberships SET status = 'revoked', revoked_at = ? WHERE business_id = ? AND user_id = ?",
      params: [now, actor.businessId, targetId],
    },
    // Open work must not stay assigned to someone without access.
    {
      sql: "UPDATE leads SET assignee_user_id = NULL, updated_at = ? WHERE business_id = ? AND assignee_user_id = ?",
      params: [now, actor.businessId, targetId],
    },
    {
      sql: "UPDATE tasks SET assignee_user_id = NULL, updated_at = ? WHERE business_id = ? AND assignee_user_id = ?",
      params: [now, actor.businessId, targetId],
    },
  ]);
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "team.remove",
    resourceType: "membership",
    resourceId: targetId,
    requestId: c.requestId,
  });
  return json({ ok: true });
}

export async function acceptInvite(c: AppContext): Promise<Response> {
  const input = await parseBody(acceptInviteInput, c.request);
  const user = requireSession(c);
  const tokenHash = await hashToken(input.token);
  const membership = await DB.first<{ business_id: string; user_id: string }>(
    c.env,
    "SELECT business_id, user_id FROM memberships WHERE invite_token_hash = ? AND status = 'invited'",
    [tokenHash],
  );
  if (!membership)
    throw ApiError.notFound("That invitation is not valid or has already been used.");
  if (membership.user_id !== user.user.id)
    throw ApiError.forbidden("This invitation was sent to a different account.");
  const now = nowIso();
  await DB.run(
    c.env,
    "UPDATE memberships SET status = 'active', joined_at = ?, invite_token_hash = NULL WHERE business_id = ? AND user_id = ?",
    [now, membership.business_id, user.user.id],
  );
  return json({ ok: true, businessId: membership.business_id });
}

const acceptInviteInput = z.object({ token: z.string().min(10).max(80) });

function requireSession(c: AppContext) {
  if (!c.session) throw ApiError.unauthenticated("Sign in to accept this invitation.");
  return c.session;
}

// ----------------------------------------------------------------- billing ----

export async function getBilling(c: AppContext): Promise<Response> {
  const actor = await access(c, "billing:manage");
  const [subscription, invoices] = await Promise.all([
    DB.first<SubscriptionRow>(c.env, "SELECT * FROM subscriptions WHERE business_id = ?", [
      actor.businessId,
    ]),
    DB.all<{
      number: string;
      description: string;
      amount_minor: number;
      status: string;
      issued_at: string;
      period_start: string | null;
      period_end: string | null;
    }>(
      c.env,
      "SELECT number, description, amount_minor, status, issued_at, period_start, period_end FROM invoices WHERE business_id = ? ORDER BY issued_at DESC LIMIT 24",
      [actor.businessId],
    ),
  ]);
  return json({
    plan: subscription?.plan ?? "free",
    status: subscription?.status ?? "active",
    currentPeriodEnd: subscription?.current_period_end ?? null,
    cancelAtPeriodEnd: subscription?.cancel_at_period_end === 1,
    provider: subscription?.provider ?? "manual",
    prices: PLAN_PRICING_MINOR,
    invoices: invoices.map((row) => ({
      number: row.number,
      description: row.description,
      amountMinor: Number(row.amount_minor),
      status: row.status,
      issuedAt: row.issued_at,
      periodStart: row.period_start,
      periodEnd: row.period_end,
    })),
  });
}

type SubscriptionRow = {
  plan: BusinessPlan;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: number;
  provider: string;
};

/**
 * Plan changes are recorded in the local ledger. Charging money needs a payment
 * provider and is deliberately NOT faked: with no provider configured the route
 * records the intent, issues a zero-value invoice and flags `requiresPayment`.
 */
export async function changePlan(c: AppContext): Promise<Response> {
  const actor = await access(c, "billing:manage");
  const input = await parseBody(billingChangeInput, c.request);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 86_400_000).toISOString();

  const idem = `billing:${actor.businessId}:${input.idempotencyKey}`;
  const replay = await DB.first<{ response_body: string }>(
    c.env,
    "SELECT response_body FROM idempotency_keys WHERE scope = 'billing' AND key = ? AND expires_at > ?",
    [idem, nowIso()],
  );
  if (replay)
    return new Response(replay.response_body, {
      status: 200,
      headers: { "content-type": "application/json; charset=utf-8", "idempotent-replay": "true" },
    });

  const priceMinor = PLAN_PRICING_MINOR[input.plan];
  const businessId = actor.businessId;
  const subId = newId("sub");
  const invoiceId = newId("inv");
  const invoiceNumber = `INV-${nowIso().slice(0, 10).replace(/-/g, "")}-${businessId.slice(-4).toUpperCase()}`;
  await DB.write(c.env, [
    {
      sql: `INSERT INTO subscriptions (id, business_id, plan, status, billing_interval, current_period_start, current_period_end, provider, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'month', ?, ?, 'manual', ?, ?)
            ON CONFLICT (business_id) DO UPDATE SET plan = excluded.plan, status = excluded.status,
              current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end, updated_at = excluded.updated_at`,
      params: [
        subId,
        businessId,
        input.plan,
        input.plan === "free" ? "cancelled" : "active",
        nowIso(),
        periodEnd,
        nowIso(),
        nowIso(),
      ],
    },
    {
      sql: "UPDATE businesses SET plan = ?, updated_at = ? WHERE id = ?",
      params: [input.plan, nowIso(), businessId],
    },
    {
      sql: `INSERT INTO invoices (id, number, business_id, subscription_id, description, amount_minor, currency, status, period_start, period_end, issued_at, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'NGN', ?, ?, ?, ?, ?)`,
      params: [
        invoiceId,
        invoiceNumber,
        businessId,
        subId,
        `${input.plan} plan — monthly`,
        priceMinor,
        priceMinor === 0 ? "paid" : "draft",
        nowIso().slice(0, 10),
        periodEnd.slice(0, 10),
        nowIso(),
        nowIso(),
      ],
    },
    {
      sql: `INSERT INTO idempotency_keys (scope, key, business_id, response_status, response_body, created_at, expires_at)
            VALUES ('billing', ?, ?, 200, ?, ?, ?)
            ON CONFLICT (scope, key) DO UPDATE SET response_body = excluded.response_body`,
      params: [
        idem,
        businessId,
        JSON.stringify({
          ok: true,
          plan: input.plan,
          invoiceNumber,
          requiresPayment: priceMinor > 0,
          periodEnd,
        }),
        nowIso(),
        new Date(Date.now() + 86_400_000).toISOString(),
      ],
    },
  ]);
  await recordAudit(c.env, {
    businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "billing.plan_change",
    resourceType: "subscription",
    resourceId: subId,
    metadata: { plan: input.plan, priceMinor, day: today() },
    requestId: c.requestId,
  });
  return json(
    { ok: true, plan: input.plan, invoiceNumber, requiresPayment: priceMinor > 0, periodEnd },
    { status: 201 },
  );
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
