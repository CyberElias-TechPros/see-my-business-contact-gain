import {
  adminBusinessInput,
  adminUserQuery,
  adminUserStatusInput,
  categoryInput,
  claimDecisionInput,
  configInput,
  flagInput,
  ticketUpdateInput,
} from "../../../shared/api.ts";
import type { VerificationLevel } from "../../../shared/domain.ts";
import { VERIFICATION_RANK } from "../../../shared/domain.ts";
import { requireAdmin } from "../auth.ts";
import { DB } from "../db-access.ts";
import { newId, nowIso } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseBody, parseQuery } from "../http.ts";
import { recordAudit, systemAudit } from "../audit.ts";
import {
  getConfig,
  listFlags,
  upsertFlag,
  deleteFlag,
  readJobRuns,
  setConfig,
  type FeatureFlag,
} from "../cache.ts";
import { notify } from "../notifications.ts";
import { moderationDecisionInput } from "../../../shared/api.ts";
import { reportResolutionInput } from "../../../shared/api.ts";
import { z } from "zod";
import type { AppContext } from "../types.ts";

export async function adminStats(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const [row] = await Promise.all([
    DB.first<{
      users: number;
      businesses: number;
      published: number;
      pending: number;
      enquiries: number;
      leads: number;
      won: number;
      rooms: number;
      reports: number;
      claims: number;
      verification: number;
      tickets: number;
    }>(
      c.env,
      `SELECT
        (SELECT COUNT(*) FROM users WHERE deleted_at IS NULL) AS users,
        (SELECT COUNT(*) FROM businesses) AS businesses,
        (SELECT COUNT(*) FROM businesses WHERE status = 'published') AS published,
        (SELECT COUNT(*) FROM businesses WHERE status = 'pending') AS pending,
        (SELECT COUNT(*) FROM enquiries) AS enquiries,
        (SELECT COUNT(*) FROM leads) AS leads,
        (SELECT COALESCE(SUM(value_minor), 0) FROM leads WHERE stage = 'won') AS won,
        (SELECT COUNT(*) FROM rooms WHERE status = 'active') AS rooms,
        (SELECT COUNT(*) FROM reports WHERE status = 'open') AS reports,
        (SELECT COUNT(*) FROM claims WHERE status IN ('pending','in_review')) AS claims,
        (SELECT COUNT(*) FROM verification_requests WHERE status = 'pending') AS verification,
        (SELECT COUNT(*) FROM tickets WHERE status = 'open') AS tickets`,
    ),
  ]);
  const today = nowIso().slice(0, 10);
  const activity = await DB.first<{ views: number; enquiries: number; whatsapp: number }>(
    c.env,
    "SELECT COALESCE(SUM(views), 0) AS views, COALESCE(SUM(enquiries), 0) AS enquiries, COALESCE(SUM(whatsapp_chats), 0) AS whatsapp FROM metrics_daily WHERE day = ?",
    [today],
  );
  return json({
    totals: {
      users: Number(row?.users ?? 0),
      businesses: Number(row?.businesses ?? 0),
      published: Number(row?.published ?? 0),
      pendingReview: Number(row?.pending ?? 0),
      enquiries: Number(row?.enquiries ?? 0),
      leads: Number(row?.leads ?? 0),
      wonValueMinor: Number(row?.won ?? 0),
      rooms: Number(row?.rooms ?? 0),
      openReports: Number(row?.reports ?? 0),
      openClaims: Number(row?.claims ?? 0),
      pendingVerification: Number(row?.verification ?? 0),
      openTickets: Number(row?.tickets ?? 0),
    },
    today: {
      views: Number(activity?.views ?? 0),
      enquiries: Number(activity?.enquiries ?? 0),
      whatsappChats: Number(activity?.whatsapp ?? 0),
    },
  });
}

export async function listUsers(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const query = parseQuery(adminUserQuery, c.url);
  const clauses: string[] = ["deleted_at IS NULL"];
  const params: unknown[] = [];
  const term = (query.q ?? "").trim();
  if (term) {
    clauses.push("(lower(display_name) LIKE ? OR lower(email_normalized) LIKE ?)");
    const like = `%${term.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    params.push(like, like);
  }
  if (query.role) {
    clauses.push("role = ?");
    params.push(query.role);
  }
  if (query.status) {
    clauses.push("status = ?");
    params.push(query.status);
  }
  const whereSql = clauses.join(" AND ");
  const [rows, total] = await Promise.all([
    DB.all<{
      id: string;
      email: string;
      display_name: string;
      role: string;
      status: string;
      created_at: string;
      last_login_at: string | null;
      businesses: number;
      locked: number;
    }>(
      c.env,
      `SELECT u.id, u.email_normalized AS email, u.display_name, u.role, u.status, u.created_at, u.last_login_at,
              u.locked_until IS NOT NULL AS locked,
              (SELECT COUNT(*) FROM memberships m WHERE m.user_id = u.id AND m.status = 'active') AS businesses
         FROM users u WHERE ${whereSql} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
      [...params, query.perPage, (query.page - 1) * query.perPage],
    ),
    DB.count(c.env, `SELECT COUNT(*) AS n FROM users WHERE ${whereSql}`, params),
  ]);
  return json({
    items: rows.map((row) => ({
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      status: row.status,
      listings: Number(row.businesses ?? 0),
      lastLoginAt: row.last_login_at,
      createdAt: row.created_at,
      locked: Boolean(row.locked),
    })),
    meta: {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    },
  });
}

export async function setUserStatus(c: AppContext): Promise<Response> {
  const admin = requireAdmin(c);
  const input = await parseBody(adminUserStatusInput, c.request);
  const userId = c.params["userId"] ?? "";
  if (userId === admin.user.id) throw ApiError.domain("You cannot suspend your own admin account.");
  const target = await DB.first<{ role: string; email: string }>(
    c.env,
    "SELECT role, email_normalized AS email FROM users WHERE id = ? AND deleted_at IS NULL",
    [userId],
  );
  if (!target) throw ApiError.notFound("User not found.");

  const now = nowIso();
  await DB.write(c.env, [
    {
      sql: "UPDATE users SET status = ?, updated_at = ? WHERE id = ?",
      params: [input.status, now, userId],
    },
    ...(input.status === "active"
      ? [
          {
            sql: "UPDATE users SET locked_until = NULL, failed_login_count = 0 WHERE id = ?",
            params: [userId],
          },
        ]
      : [
          {
            sql: "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            params: [now, userId],
          },
        ]),
  ]);
  await recordAudit(
    c.env,
    systemAudit({
      businessId: null,
      actorUserId: admin.user.id,
      actorLabel: admin.user.displayName,
      actorKind: "admin",
      action: `user.${input.status}`,
      resourceType: "user",
      resourceId: userId,
      metadata: { reason: input.reason },
      ipHash: c.ipHash,
      requestId: c.requestId,
    }),
  );
  return json({ ok: true, status: input.status });
}

export async function listBusinesses(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const status = c.url.searchParams.get("status") ?? "";
  const term = (c.url.searchParams.get("q") ?? "").trim();
  const page = Math.min(500, Math.max(1, Number(c.url.searchParams.get("page")) || 1));
  const perPage = 25;
  const clauses: string[] = ["1 = 1"];
  const params: unknown[] = [];
  if (["draft", "pending", "published", "suspended", "hidden"].includes(status)) {
    clauses.push("b.status = ?");
    params.push(status);
  }
  if (term) {
    clauses.push("(lower(b.name) LIKE ? OR lower(b.city) LIKE ?)");
    const like = `%${term.toLowerCase().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    params.push(like, like);
  }
  const whereSql = clauses.join(" AND ");
  const [rows, total] = await Promise.all([
    DB.all<AdminBusinessRow>(
      c.env,
      `SELECT b.id, b.slug, b.name, b.city, b.state, b.status, b.plan, b.verified_level, b.rating_avg, b.rating_count,
              b.enquiry_count, b.view_count, b.profile_complete AS completeness, b.updated_at, o.display_name AS owner_name, cat.name AS category
         FROM businesses b
         LEFT JOIN users o ON o.id = b.owner_user_id
         JOIN categories cat ON cat.id = b.category_id
        WHERE ${whereSql} ORDER BY b.updated_at DESC LIMIT ? OFFSET ?`,
      [...params, perPage, (page - 1) * perPage],
    ),
    DB.count(c.env, `SELECT COUNT(*) AS n FROM businesses b WHERE ${whereSql}`, params),
  ]);
  return json({
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      city: row.city,
      state: row.state,
      status: row.status,
      plan: row.plan,
      verification: row.verified_level,
      rating: Number(row.rating_avg ?? 0),
      reviews: Number(row.rating_count ?? 0),
      enquiries: Number(row.enquiry_count ?? 0),
      views: Number(row.view_count ?? 0),
      completeness: Number(row.completeness ?? 0),
      owner: row.owner_name,
      category: row.category,
      updatedAt: row.updated_at,
    })),
    meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
  });
}

type AdminBusinessRow = {
  id: string;
  slug: string;
  name: string;
  city: string;
  state: string;
  status: string;
  plan: string;
  verified_level: VerificationLevel;
  rating_avg: number | null;
  rating_count: number | null;
  enquiry_count: number | null;
  view_count: number | null;
  completeness: number | null;
  updated_at: string;
  owner_name: string | null;
  category: string | null;
};

export async function moderateBusiness(c: AppContext): Promise<Response> {
  const admin = requireAdmin(c);
  const input = await parseBody(adminBusinessInput, c.request);
  const businessId = c.params["businessId"] ?? "";
  const business = await DB.first<{
    id: string;
    name: string;
    status: string;
    verified_level: string;
  }>(c.env, "SELECT id, name, status, verified_level FROM businesses WHERE id = ?", [businessId]);
  if (!business) throw ApiError.notFound("Listing not found.");

  const now = nowIso();
  const sets: string[] = ["updated_at = ?"];
  const params: unknown[] = [now];
  let note = "";
  switch (input.action) {
    case "publish":
      sets.push("status = 'published'", "published_at = COALESCE(published_at, ?)");
      params.push(now);
      note = "Approved and published by an admin.";
      break;
    case "hide":
      sets.push("status = 'hidden'");
      note = "Hidden from the directory by an admin.";
      break;
    case "suspend":
      sets.push("status = 'suspended'");
      note = input.note ?? "Suspended for a policy breach.";
      break;
    case "restore":
      sets.push("status = 'published'");
      note = "Restored by an admin.";
      break;
    case "feature":
      sets.push("is_featured = 1");
      note = "Featured on the homepage.";
      break;
    case "unfeature":
      sets.push("is_featured = 0");
      note = "No longer featured.";
      break;
    case "verify_documents":
    case "verify_premium":
      sets.push("verified_level = ?");
      params.push(input.action === "verify_premium" ? "premium" : "documents");
      note = `Verification raised to ${input.action === "verify_premium" ? "premium" : "documents"}.`;
      break;
  }
  sets.push("moderation_note = ?");
  params.push(input.note ? `${note} ${input.note}`.slice(0, 500) : note);
  params.push(businessId);
  await DB.run(c.env, `UPDATE businesses SET ${sets.join(", ")} WHERE id = ?`, params);

  // Closing the moderation item keeps the queue from showing decided work twice.
  await DB.run(
    c.env,
    "UPDATE moderation_items SET status = ?, decided_at = ?, decided_by = ?, decision_note = ? WHERE business_id = ? AND status = 'pending'",
    [
      input.action === "suspend" || input.action === "hide" ? "removed" : "approved",
      now,
      admin.user.id,
      note,
      businessId,
    ],
  );

  const owners = await DB.all<{ user_id: string }>(
    c.env,
    "SELECT user_id FROM memberships WHERE business_id = ? AND role IN ('owner','manager') AND status = 'active' LIMIT 10",
    [businessId],
  );
  for (const owner of owners) {
    await notify(c.env, {
      userId: owner.user_id,
      businessId,
      kind: "moderation_action",
      title: `Update on ${business.name}`,
      body: note,
      href: "/app/settings",
      dedupeKey: `moderation:${businessId}:${now.slice(0, 10)}:${input.action}`,
    });
  }
  await recordAudit(
    c.env,
    systemAudit({
      businessId,
      actorUserId: admin.user.id,
      actorLabel: admin.user.displayName,
      actorKind: "admin",
      action: `business.${input.action}`,
      resourceType: "business",
      resourceId: businessId,
      metadata: { note },
      ipHash: c.ipHash,
      requestId: c.requestId,
    }),
  );
  return json({ ok: true, action: input.action });
}

// ------------------------------------------------------------ moderation ----

export async function moderationQueue(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const status = ["pending", "approved", "rejected", "removed"].includes(
    c.url.searchParams.get("status") ?? "",
  )
    ? (c.url.searchParams.get("status") as string)
    : "pending";
  const rows = await DB.all<ModerationRow>(
    c.env,
    `SELECT m.id, m.item_type, m.target_id, m.business_id, m.reason, m.risk, m.status, m.source, m.created_at, m.decided_at,
            b.name AS business_name, b.slug AS business_slug, d.display_name AS decided_by_name
       FROM moderation_items m
       LEFT JOIN businesses b ON b.id = m.business_id
       LEFT JOIN users d ON d.id = m.decided_by
      WHERE m.status = ?
      ORDER BY CASE m.risk WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, m.created_at
      LIMIT 200`,
    [status],
  );
  return json({
    items: rows.map((row) => ({
      id: row.id,
      type: row.item_type,
      targetId: row.target_id,
      businessId: row.business_id,
      businessName: row.business_name,
      businessSlug: row.business_slug,
      reason: row.reason,
      risk: row.risk,
      status: row.status,
      source: row.source,
      createdAt: row.created_at,
      decidedAt: row.decided_at,
      decidedBy: row.decided_by_name,
    })),
  });
}

type ModerationRow = {
  id: string;
  item_type: string;
  target_id: string;
  business_id: string | null;
  reason: string;
  risk: string;
  status: string;
  source: string;
  created_at: string;
  decided_at: string | null;
  business_name: string | null;
  business_slug: string | null;
  decided_by_name: string | null;
};

export async function decideModeration(c: AppContext): Promise<Response> {
  const admin = requireAdmin(c);
  const input = await parseBody(moderationDecisionInput, c.request);
  const id = c.params["itemId"] ?? "";
  const item = await DB.first<ModerationRow & { detail_json: string }>(
    c.env,
    "SELECT id, item_type, target_id, business_id, reason, risk, status, source, created_at, decided_at, detail_json FROM moderation_items WHERE id = ?",
    [id],
  );
  if (!item) throw ApiError.notFound("Moderation item not found.");
  if (item.status !== "pending") throw ApiError.conflict("This item was already decided.");

  const now = nowIso();
  const nextStatus =
    input.decision === "approve"
      ? "approved"
      : input.decision === "reject"
        ? "rejected"
        : "removed";
  await DB.write(c.env, [
    {
      sql: "UPDATE moderation_items SET status = ?, decided_at = ?, decided_by = ?, decision_note = ? WHERE id = ?",
      params: [nextStatus, now, admin.user.id, input.note ?? null, id],
    },
    ...(item.item_type === "media"
      ? [
          {
            sql: "UPDATE media SET moderation_status = ? WHERE id = ?",
            params: [nextStatus === "approved" ? "approved" : "rejected", item.target_id],
          },
        ]
      : []),
    ...(item.item_type === "review"
      ? // reviews.status is CHECK-constrained to pending|published|hidden; the note stays
        // on moderation_items.decision_note, which is where reviewers' reasoning belongs.
        [
          {
            sql: "UPDATE reviews SET status = ?, updated_at = ? WHERE id = ?",
            params: [nextStatus === "approved" ? "published" : "hidden", now, item.target_id],
          },
        ]
      : []),
    ...(item.item_type === "room" && nextStatus === "approved"
      ? [
          {
            sql: "UPDATE rooms SET status = 'active', updated_at = ? WHERE id = ? AND status = 'pending'",
            params: [now, item.target_id],
          },
        ]
      : []),
    ...(item.item_type === "room" && nextStatus !== "approved"
      ? [
          {
            sql: "UPDATE rooms SET status = 'closed', updated_at = ? WHERE id = ?",
            params: [now, item.target_id],
          },
        ]
      : []),
    ...(item.item_type === "listing"
      ? [
          {
            sql: `UPDATE businesses SET status = ?, updated_at = ?, published_at = COALESCE(published_at, ?), moderation_note = ? WHERE id = ? AND status = 'pending'`,
            params: [
              nextStatus === "approved" ? "published" : "hidden",
              now,
              nextStatus === "approved" ? now : null,
              input.note ?? null,
              item.business_id,
            ],
          },
        ]
      : []),
  ]);
  return json({ ok: true, status: nextStatus });
}

// --------------------------------------------------- reports / claims / verify ----

export async function listReports(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const status = c.url.searchParams.get("status") ?? "open";
  const rows = await DB.all<{
    id: string;
    target_type: string;
    target_id: string;
    reason: string;
    detail: string | null;
    status: string;
    risk: string;
    resolution_note: string | null;
    action_taken: string | null;
    created_at: string;
    business_name: string | null;
    reporter_email: string | null;
  }>(
    c.env,
    `SELECT r.id, r.target_type, r.target_id, r.reason, substr(r.detail, 1, 400) AS detail, r.status, r.risk,
            r.resolution_note, r.action_taken, r.created_at,
            b.name AS business_name, u.email_normalized AS reporter_email
       FROM reports r
       LEFT JOIN businesses b ON b.id = CASE WHEN r.target_type = 'business' THEN r.target_id ELSE NULL END
       LEFT JOIN users u ON u.id = r.reporter_user_id
      WHERE r.status = ? ORDER BY CASE r.risk WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, r.created_at LIMIT 200`,
    [status],
  );
  return json({ items: rows });
}

export async function resolveReport(c: AppContext): Promise<Response> {
  const admin = requireAdmin(c);
  const input = await parseBody(reportResolutionInput, c.request);
  const id = c.params["reportId"] ?? "";
  const report = await DB.first<{
    id: string;
    target_type: string;
    target_id: string;
    business_id: string | null;
    status: string;
    reporter_user_id: string | null;
  }>(
    c.env,
    "SELECT id, target_type, target_id, business_id, status, reporter_user_id FROM reports WHERE id = ?",
    [id],
  );
  if (!report) throw ApiError.notFound("Report not found.");
  if (report.status === "actioned" || report.status === "dismissed")
    throw ApiError.conflict("This report is already closed.");

  const now = nowIso();
  const statements: { sql: string; params: unknown[] }[] = [
    {
      sql: `UPDATE reports SET status = ?, action_taken = ?, resolution_note = ?, assigned_to = COALESCE(assigned_to, ?),
              resolved_at = ?, updated_at = ? WHERE id = ?`,
      params: [
        input.status,
        input.action,
        input.note,
        admin.user.id,
        input.status === "reviewing" ? null : now,
        now,
        id,
      ],
    },
  ];
  if (input.status === "actioned" && report.target_type === "business") {
    statements.push({
      sql: "UPDATE businesses SET status = 'hidden', moderation_note = ?, updated_at = ? WHERE id = ?",
      params: [`Actioned: ${input.note}`, now],
    });
    statements.push({
      sql: `INSERT INTO moderation_items (id, item_type, target_id, business_id, reason, detail_json, risk, status, source, created_at, decided_at, decided_by, decision_note)
            VALUES (?, 'listing', ?, ?, 'Admin actioned a report', '{}', 'high', 'removed', 'user_report', ?, ?, ?, ?)`,
      params: [
        newId("mod"),
        report.target_id,
        report.target_id,
        now,
        now,
        admin.user.id,
        input.note,
      ],
    });
  }
  await DB.write(c.env, statements);
  if (report.reporter_user_id) {
    await notify(c.env, {
      userId: report.reporter_user_id,
      kind: "moderation_action",
      title:
        input.status === "dismissed"
          ? "We reviewed your report"
          : "Thank you — we acted on your report",
      body:
        input.status === "dismissed"
          ? "We did not find a policy breach on this listing."
          : "The listing has been hidden while we work with the owner.",
      href: null,
      dedupeKey: `report_resolved:${id}`,
    });
  }
  return json({ ok: true });
}

export async function listClaims(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const rows = await DB.all<{
    id: string;
    business_id: string;
    claimant_user_id: string;
    role: string;
    note: string;
    status: string;
    submitted_at: string;
    review_note: string | null;
    business_name: string | null;
    claimant_name: string | null;
    claimant_email: string | null;
    evidence: string | null;
  }>(
    c.env,
    `SELECT cl.id, cl.business_id, cl.claimant_user_id, cl.role, cl.note, cl.status, cl.submitted_at, cl.review_note,
            b.name AS business_name, u.display_name AS claimant_name, u.email_normalized AS claimant_email, cl.evidence_media_id AS evidence
       FROM claims cl JOIN users u ON u.id = cl.claimant_user_id
       LEFT JOIN businesses b ON b.id = cl.business_id
      WHERE cl.status = ? ORDER BY cl.submitted_at LIMIT 200`,
    [c.url.searchParams.get("status") ?? "pending"],
  );
  return json({ items: rows });
}

export async function decideClaim(c: AppContext): Promise<Response> {
  const admin = requireAdmin(c);
  const input = await parseBody(claimDecisionInput, c.request);
  const id = c.params["claimId"] ?? "";
  const claim = await DB.first<{
    id: string;
    business_id: string;
    claimant_user_id: string;
    status: string;
  }>(c.env, "SELECT id, business_id, claimant_user_id, status FROM claims WHERE id = ?", [id]);
  if (!claim) throw ApiError.notFound("Claim not found.");
  if (claim.status !== "pending" && claim.status !== "in_review")
    throw ApiError.conflict("This claim is already decided.");

  const now = nowIso();
  const next =
    input.decision === "approve"
      ? "approved"
      : input.decision === "reject"
        ? "rejected"
        : "contested";
  await DB.write(c.env, [
    {
      sql: "UPDATE claims SET status = ?, review_note = ?, reviewed_by = ?, decided_at = ? WHERE id = ?",
      params: [next, input.note, admin.user.id, now, id],
    },
    ...(next === "approved"
      ? [
          {
            sql: `INSERT INTO memberships (user_id, business_id, role, status, invited_by, invited_at, joined_at)
                  VALUES (?, ?, 'owner', 'active', ?, ?, ?)
                  ON CONFLICT (user_id, business_id) DO UPDATE SET role = 'owner', status = 'active', revoked_at = NULL, joined_at = excluded.joined_at`,
            params: [claim.claimant_user_id, claim.business_id, admin.user.id, now, now],
          },
          {
            sql: "UPDATE businesses SET owner_user_id = ?, status = CASE WHEN status = 'draft' THEN 'pending' ELSE status END, updated_at = ? WHERE id = ?",
            params: [claim.claimant_user_id, now, claim.business_id],
          },
        ]
      : []),
  ]);
  await notify(c.env, {
    userId: claim.claimant_user_id,
    businessId: claim.business_id,
    kind: "claim_decision",
    title: next === "approved" ? "Your claim was approved" : "Update on your listing claim",
    body:
      next === "approved"
        ? "You now own this workspace. Confirm your contact details before publishing."
        : input.note,
    href: "/app/profile",
    dedupeKey: `claim_decision:${id}`,
  });
  return json({ ok: true, status: next });
}

export async function listVerificationRequests(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const rows = await DB.all<{
    id: string;
    business_id: string;
    user_id: string;
    level_requested: string;
    note: string | null;
    status: string;
    submitted_at: string;
    business_name: string | null;
    requester: string | null;
    document_media_id: string | null;
  }>(
    c.env,
    `SELECT v.id, v.business_id, v.user_id, v.level_requested, v.note, v.status, v.submitted_at, v.document_media_id,
            b.name AS business_name, u.display_name AS requester
       FROM verification_requests v
       LEFT JOIN businesses b ON b.id = v.business_id
       LEFT JOIN users u ON u.id = v.user_id
      WHERE v.status = ? ORDER BY v.submitted_at LIMIT 200`,
    [c.url.searchParams.get("status") ?? "pending"],
  );
  return json({ items: rows });
}

export async function decideVerification(c: AppContext): Promise<Response> {
  const admin = requireAdmin(c);
  const input = await parseBody(verificationDecision, c.request);
  const id = c.params["requestId"] ?? "";
  const request = await DB.first<{
    id: string;
    business_id: string;
    user_id: string;
    level_requested: string;
    status: string;
  }>(
    c.env,
    "SELECT id, business_id, user_id, level_requested, status FROM verification_requests WHERE id = ?",
    [id],
  );
  if (!request) throw ApiError.notFound("Request not found.");
  if (request.status !== "pending") throw ApiError.conflict("This request is already decided.");

  const now = nowIso();
  const next = input.decision === "approve" ? "approved" : "rejected";
  await DB.write(c.env, [
    {
      sql: "UPDATE verification_requests SET status = ?, review_note = ?, reviewed_by = ?, decided_at = ? WHERE id = ?",
      params: [next, input.note, admin.user.id, now, id],
    },
    ...(next === "approved"
      ? [
          {
            sql: `UPDATE businesses SET verified_level = ?, updated_at = ?,
                    completeness = MAX(completeness, 90) WHERE id = ?`,
            params: [request.level_requested, now, request.business_id],
          },
        ]
      : []),
  ]);
  await notify(c.env, {
    userId: request.user_id,
    businessId: request.business_id,
    kind: "verification_decision",
    title:
      next === "approved" ? "You are verified on GainHub" : "We could not verify your business yet",
    body:
      next === "approved"
        ? "Your listing now shows the verified badge and ranks higher in search."
        : input.note,
    href: "/app/verification",
    dedupeKey: `verification:${id}`,
  });
  return json({ ok: true, status: next });
}

const verificationDecision = z.object({
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().min(5).max(500),
});

/** Rank is used to refuse downgrades: approving "email" over "documents" would be a bug. */
export function rankOf(level: string): number {
  return VERIFICATION_RANK[level as VerificationLevel] ?? 0;
}

// --------------------------------------------------------- categories / misc ----

export async function adminListCategories(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const rows = await DB.all<{
    id: string;
    slug: string;
    name: string;
    icon: string;
    description: string;
    checklist_json: string;
    required_media_json: string;
    sort: number;
    is_active: number;
    listings: number;
  }>(
    c.env,
    `SELECT id, slug, name, icon, description, checklist_json, required_media_json, sort, is_active,
            (SELECT COUNT(*) FROM businesses b WHERE b.category_id = categories.id) AS listings
       FROM categories ORDER BY sort, name`,
  );
  return json({
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      icon: row.icon,
      description: row.description,
      checklist: parseJsonArray(row.checklist_json),
      requiredMedia: parseJsonArray(row.required_media_json),
      sort: row.sort,
      active: row.is_active === 1,
      listings: Number(row.listings ?? 0),
    })),
  });
}

export async function adminUpsertCategory(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const input = await parseBody(categoryInput, c.request);
  const slug =
    input.slug ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const id = c.params["categoryId"];
  const now = nowIso();
  if (id) {
    const result = await DB.run(
      c.env,
      `UPDATE categories SET name = ?, slug = ?, icon = ?, description = ?, checklist_json = ?, required_media_json = ?, sort = ?, is_active = ?, updated_at = ?
        WHERE id = ?`,
      [
        input.name,
        slug,
        input.icon,
        input.description ?? "",
        JSON.stringify(input.checklist),
        JSON.stringify(input.requiredMedia),
        input.sort,
        1,
        now,
        id,
      ],
    );
    if (!(result as unknown as { meta?: { changes?: number } }).meta?.changes)
      throw ApiError.notFound("Category not found.");
    return json({ ok: true, id });
  }
  const clash = await DB.first<{ id: string }>(c.env, "SELECT id FROM categories WHERE slug = ?", [
    slug,
  ]);
  if (clash) throw ApiError.conflict("A category with that slug already exists.");
  const newCategoryId = newId("cat");
  await DB.run(
    c.env,
    `INSERT INTO categories (id, slug, name, icon, description, checklist_json, required_media_json, sort, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    [
      newCategoryId,
      slug,
      input.name,
      input.icon,
      input.description ?? "",
      JSON.stringify(input.checklist),
      JSON.stringify(input.requiredMedia),
      input.sort,
      now,
      now,
    ],
  );
  return json({ ok: true, id: newCategoryId }, { status: 201 });
}

export async function adminToggleCategory(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const id = c.params["categoryId"] ?? "";
  const category = await DB.first<{ is_active: number; listings: number }>(
    c.env,
    `SELECT c.is_active, (SELECT COUNT(*) FROM businesses b WHERE b.category_id = c.id) AS listings FROM categories c WHERE c.id = ?`,
    [id],
  );
  if (!category) throw ApiError.notFound("Category not found.");
  if (category.is_active === 1 && Number(category.listings) > 0) {
    throw ApiError.domain("Move or archive the listings in this category before deactivating it.");
  }
  await DB.run(
    c.env,
    "UPDATE categories SET is_active = CASE WHEN is_active = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?",
    [nowIso(), id],
  );
  return json({ ok: true, active: category.is_active === 0 });
}

export async function adminListTickets(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const rows = await DB.all<{
    id: string;
    code: string;
    subject: string;
    body: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    updated_at: string;
    requester: string | null;
    business_name: string | null;
  }>(
    c.env,
    `SELECT t.id, t.code, t.subject, t.body, t.category, t.priority, t.status, t.created_at, t.updated_at,
            u.display_name AS requester, b.name AS business_name
       FROM tickets t LEFT JOIN users u ON u.id = t.user_id LEFT JOIN businesses b ON b.id = t.business_id
      WHERE t.status = ? ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.updated_at LIMIT 100`,
    [c.url.searchParams.get("status") ?? "open"],
  );
  return json({ items: rows });
}

export async function adminReplyTicket(c: AppContext): Promise<Response> {
  const admin = requireAdmin(c);
  const input = await parseBody(ticketUpdateInput, c.request);
  const id = c.params["ticketId"] ?? "";
  const ticket = await DB.first<{
    id: string;
    user_id: string | null;
    status: string;
    code: string;
  }>(c.env, "SELECT id, user_id, status, code FROM tickets WHERE id = ?", [id]);
  if (!ticket) throw ApiError.notFound("Ticket not found.");
  const now = nowIso();
  await DB.write(c.env, [
    {
      sql: "UPDATE tickets SET status = ?, priority = COALESCE(?, priority), assigned_to = ?, updated_at = ?, resolved_at = ? WHERE id = ?",
      params: [
        input.status,
        input.priority ?? null,
        admin.user.id,
        now,
        input.status === "resolved" || input.status === "closed" ? now : null,
        id,
      ],
    },
    {
      sql: "INSERT INTO ticket_messages (id, ticket_id, author_user_id, from_staff, body, created_at) VALUES (?, ?, ?, 1, ?, ?)",
      params: [newId("tmsg"), id, admin.user.id, input.reply, now],
    },
  ]);
  if (ticket.user_id) {
    await notify(c.env, {
      userId: ticket.user_id,
      kind: "moderation_action",
      title: `Reply on ${ticket.code}`,
      body: input.reply.slice(0, 300),
      href: "/app/support",
      dedupeKey: `ticket:${id}:${now.slice(0, 16)}`,
    });
  }
  return json({ ok: true });
}

export async function adminAudit(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const term = c.url.searchParams.get("q") ?? "";
  const params: unknown[] = [];
  let whereSql = "1 = 1";
  if (term) {
    whereSql += " AND (a.action LIKE ? OR a.actor_label LIKE ? OR a.resource_id = ?)";
    params.push(`%${term}%`, `%${term.toLowerCase()}%`, term);
  }
  const rows = await DB.all<{
    id: string;
    action: string;
    actor_label: string;
    actor_kind: string;
    resource_type: string;
    resource_id: string;
    created_at: string;
    business_name: string | null;
    metadata_json: string;
  }>(
    c.env,
    `SELECT a.id, a.action, a.actor_label, a.actor_kind, a.resource_type, a.resource_id, a.created_at, a.metadata_json,
            b.name AS business_name
       FROM audit_logs a LEFT JOIN businesses b ON b.id = a.business_id
      WHERE ${whereSql} ORDER BY a.created_at DESC LIMIT 200`,
    params,
  );
  return json({ items: rows });
}

export async function adminFlags(c: AppContext): Promise<Response> {
  requireAdmin(c);
  return json({ items: await listFlags(c.env) });
}

export async function adminUpsertFlag(c: AppContext): Promise<Response> {
  const admin = requireAdmin(c);
  const input = await parseBody(flagInput, c.request);
  const flag: FeatureFlag = {
    key: input.key,
    enabled: input.enabled,
    rolloutPercent: input.rolloutPercent,
    description: input.description ?? "",
    updatedAt: nowIso(),
  };
  await upsertFlag(c.env, flag);
  await recordAudit(
    c.env,
    systemAudit({
      actorUserId: admin.user.id,
      actorLabel: admin.user.displayName,
      actorKind: "admin",
      action: "flag.upsert",
      resourceType: "flag",
      resourceId: input.key,
      metadata: { enabled: input.enabled, rolloutPercent: input.rolloutPercent },
      requestId: c.requestId,
    }),
  );
  return json({ ok: true });
}

export async function adminDeleteFlag(c: AppContext): Promise<Response> {
  requireAdmin(c);
  await deleteFlag(c.env, c.params["key"] ?? "");
  return json({ ok: true });
}

export async function adminConfig(c: AppContext): Promise<Response> {
  requireAdmin(c);
  return json({ config: await getConfig(c.env) });
}

export async function adminUpdateConfig(c: AppContext): Promise<Response> {
  const admin = requireAdmin(c);
  const input = await parseBody(configInput, c.request);
  // `exactOptionalPropertyTypes` means an absent key must not be forwarded as
  // `undefined`, or a partial edit would wipe the stored value.
  // The stored config is deep-merged here rather than replaced: the admin UI sends
  // the switch it touched, and a partial PATCH must not reset the others.
  const current = await getConfig(c.env);
  const patch: Parameters<typeof setConfig>[1] = {};
  if (input.maintenance !== undefined) patch.maintenance = input.maintenance;
  if (input.moderation !== undefined) {
    patch.moderation = {
      slaHours: input.moderation.slaHours ?? current.moderation.slaHours,
      autoHideRisk: input.moderation.autoHideRisk ?? current.moderation.autoHideRisk,
    };
  }
  if (input.verification !== undefined) {
    patch.verification = { slaHours: input.verification.slaHours ?? current.verification.slaHours };
  }
  if (input.signup !== undefined) {
    patch.signup = {
      requireEmailVerification:
        input.signup.requireEmailVerification ?? current.signup.requireEmailVerification,
      closed: input.signup.closed ?? current.signup.closed,
    };
  }
  const config = await setConfig(c.env, patch);
  await recordAudit(
    c.env,
    systemAudit({
      actorUserId: admin.user.id,
      actorLabel: admin.user.displayName,
      actorKind: "admin",
      action: "config.update",
      resourceType: "config",
      resourceId: "platform",
      metadata: { keys: Object.keys(input) },
      requestId: c.requestId,
    }),
  );
  return json({ ok: true, config });
}

const JOBS = [
  "aggregate_daily",
  "stale_leads",
  "moderation_sla",
  "purge_media",
  "purge_link_events",
  "weekly_digest",
];

export async function adminJobs(c: AppContext): Promise<Response> {
  requireAdmin(c);
  const [heartbeat, history] = await Promise.all([
    readJobRuns(c.env, JOBS),
    DB.all<{
      job: string;
      status: string;
      items_processed: number;
      duration_ms: number | null;
      error: string | null;
      started_at: string;
      finished_at: string | null;
    }>(
      c.env,
      `SELECT job, status, items_processed, duration_ms, error, started_at, finished_at FROM cron_runs
        ORDER BY started_at DESC LIMIT 40`,
    ),
  ]);
  return json({
    heartbeat,
    runs: history.map((row) => ({
      job: row.job,
      status: row.status,
      items: Number(row.items_processed ?? 0),
      durationMs: row.duration_ms,
      error: row.error,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
    })),
  });
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}
