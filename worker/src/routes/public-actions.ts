import {
  claimInput,
  enquiryInput,
  reportInput,
  reviewInput,
  reviewReplyInput,
  suggestBusinessInput,
} from "../../../shared/api.ts";
import {
  normalizeNigerianPhone,
  scoreLead,
  scoreReportRisk,
  slugify,
  waLink,
} from "../../../shared/domain.ts";
import { requireAccess, requireUser } from "../auth.ts";
import { flagEnabled, getConfig } from "../cache.ts";
import { DB } from "../db-access.ts";
import { newId, nowIso, today } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseBody } from "../http.ts";
import { recordAudit } from "../audit.ts";
import { notify } from "../notifications.ts";
import { enforceLimit, limitIdentity } from "../ratelimit.ts";
import { sendMail } from "../mail.ts";
import { signUploadTicket, UPLOAD_TTL_SECONDS } from "../media.ts";
import type { AppContext } from "../types.ts";

// -------------------------------------------------------------- enquiries ----

export async function createEnquiry(c: AppContext): Promise<Response> {
  const input = await parseBody(enquiryInput, c.request);
  if (input.honeypot) return json({ ok: true, id: "ignored" }, { status: 201 });

  const identity = limitIdentity(c.session?.user.id ?? null, c.ipHash);
  await enforceLimit(c.env, "enquiry", identity);

  const config = await getConfig(c.env);
  if (config.maintenance?.enabled)
    throw ApiError.forbidden(config.maintenance.message || "Briefly paused for maintenance.");

  const formEnabled = await flagEnabled(c.env, "enquiries.form_enabled");
  const business = await DB.first<BusinessForEnquiry>(
    c.env,
    `SELECT b.id, b.name, b.slug, b.status, b.whatsapp, b.phone, b.owner_user_id,
            s.enquiry_form_enabled, s.enquiry_require_phone, s.autoack_message
       FROM businesses b LEFT JOIN business_settings s ON s.business_id = b.id
      WHERE b.id = ? OR b.slug = ?`,
    [input.businessId, input.businessId],
  );
  if (!business || business.status !== "published")
    throw ApiError.notFound("That business is not accepting enquiries.");
  if (!formEnabled || business.enquiry_form_enabled === 0) {
    throw ApiError.forbidden(
      "This business has turned off the enquiry form. Message them on WhatsApp instead.",
    );
  }

  const phone = normalizeNigerianPhone(input.phone);
  if (!phone) throw ApiError.validation({ phone: "Enter a WhatsApp number we can reach you on." });
  if (business.enquiry_require_phone === 0 && input.email && !normalizeNigerianPhone(input.phone)) {
    throw ApiError.validation({ phone: "Enter a valid phone number." });
  }

  // Idempotency: two clicks, two tabs or a retrying client produce one enquiry.
  const existing = await DB.first<{ id: string; status: string; created_at: string }>(
    c.env,
    "SELECT id, status, created_at FROM enquiries WHERE business_id = ? AND idempotency_key = ?",
    [business.id, input.idempotencyKey],
  );
  if (existing) {
    return json(
      {
        ok: true,
        deduplicated: true,
        enquiryId: existing.id,
        status: existing.status,
        whatsappUrl: business.whatsapp
          ? waLink(business.whatsapp, `Enquiry from ${input.name}`)
          : null,
      },
      { status: 200 },
    );
  }

  const now = nowIso();
  const enquiryId = newId("enq");
  const link = input.linkCode
    ? await DB.first<{ id: string; campaign_id: string | null }>(
        c.env,
        "SELECT id, campaign_id FROM links WHERE code = ?",
        [input.linkCode],
      )
    : null;

  // Dedupe on the normalised number: a repeat customer becomes one contact thread.
  const contact = await upsertContact(c, business.id, {
    name: input.name,
    phone,
    email: input.email || null,
    source: input.source,
  });

  const leadId = newId("led");
  const leadCode = await nextLeadCode(c.env, business.id);
  const score = scoreLead({
    source: input.source,
    stage: "new",
    valueMinor: input.budgetMinor ?? null,
    messageLength: input.need.length,
    hoursSinceActivity: 0,
  });

  const statements: { sql: string; params: unknown[] }[] = [
    {
      sql: `INSERT INTO enquiries (id, business_id, sender_user_id, contact_id, name, phone, email, need, service_id,
              budget_minor, preferred_date, status, source, link_id, campaign_id, idempotency_key, last_message_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        enquiryId,
        business.id,
        c.session?.user.id ?? null,
        contact.id,
        input.name,
        phone,
        input.email || null,
        input.need,
        input.serviceId ?? null,
        input.budgetMinor ?? null,
        input.preferredDate ?? null,
        input.source,
        link?.id ?? null,
        link?.campaign_id ?? null,
        input.idempotencyKey,
        now,
        now,
        now,
      ],
    },
    {
      sql: `INSERT INTO leads (id, code, business_id, contact_id, enquiry_id, name, phone, email, stage, score, value_minor,
              source, note, last_activity_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?, ?)`,
      params: [
        leadId,
        leadCode,
        business.id,
        contact.id,
        enquiryId,
        input.name,
        phone,
        input.email || null,
        score,
        input.budgetMinor ?? null,
        input.source,
        input.need.slice(0, 1900),
        now,
        now,
        now,
      ],
    },
    {
      sql: "INSERT INTO lead_events (id, lead_id, from_stage, to_stage, actor_user_id, actor_label, note, created_at) VALUES (?, ?, NULL, 'new', ?, 'System', 'Created from a public enquiry form', ?)",
      params: [newId("lev"), leadId, business.owner_user_id, now],
    },
    {
      sql: "UPDATE businesses SET enquiry_count = enquiry_count + 1, updated_at = ? WHERE id = ?",
      params: [now, business.id],
    },
    {
      sql: `INSERT INTO metrics_daily (business_id, day, views, enquiries, whatsapp_chats, leads, updated_at)
            VALUES (?, ?, 0, 1, 0, 1, ?)
            ON CONFLICT (business_id, day) DO UPDATE SET enquiries = enquiries + 1, leads = leads + 1, updated_at = excluded.updated_at`,
      params: [business.id, today(), now],
    },
  ];
  if (link) {
    statements.push({
      sql: "UPDATE links SET leads_created = leads_created + 1, clicks = clicks + 1, updated_at = ? WHERE id = ?",
      params: [now, link.id],
    });
    statements.push({
      sql: "INSERT INTO link_events (id, link_id, business_id, kind, day, created_at) VALUES (?, ?, ?, 'chat', ?, ?)",
      params: [newId("ev"), link.id, business.id, today(), now],
    });
  }
  await DB.write(c.env, statements);

  const outcomes = await runNewEnquiryAutomations(c, business.id, {
    enquiryId,
    leadId,
    leadCode,
    name: input.name,
    phone,
  });

  if (business.autoack_message && input.email) {
    c.execution.waitUntil(
      sendMail(c.env, {
        to: input.email,
        subject: `We received your message to ${business.name}`,
        text: business.autoack_message
          .replace("{name}", input.name)
          .replace("{business}", business.name),
      })
        .then(() =>
          DB.run(c.env, "UPDATE enquiries SET autoack_sent = 1 WHERE id = ?", [enquiryId]),
        )
        .catch(() => undefined),
    );
  }

  return json(
    {
      ok: true,
      enquiryId,
      lead: { id: leadId, code: leadCode, score },
      whatsappUrl: business.whatsapp
        ? waLink(business.whatsapp, `Enquiry from ${input.name}: ${input.need.slice(0, 200)}`)
        : null,
      automation: outcomes,
    },
    { status: 201 },
  );
}

type BusinessForEnquiry = {
  id: string;
  name: string;
  slug: string;
  status: string;
  whatsapp: string | null;
  phone: string | null;
  owner_user_id: string | null;
  enquiry_form_enabled: number | null;
  enquiry_require_phone: number | null;
  autoack_message: string | null;
};

async function upsertContact(
  c: AppContext,
  businessId: string,
  input: { name: string; phone: string; email: string | null; source: string },
): Promise<{ id: string; created: boolean }> {
  const existing = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM contacts WHERE business_id = ? AND phone = ?",
    [businessId, input.phone],
  );
  if (existing) {
    await DB.run(
      c.env,
      "UPDATE contacts SET last_contacted_at = ?, message_count = message_count + 1, updated_at = ? WHERE id = ?",
      [nowIso(), nowIso(), existing.id],
    );
    return { id: existing.id, created: false };
  }
  const id = newId("con");
  const now = nowIso();
  await DB.run(
    c.env,
    `INSERT INTO contacts (id, business_id, name, phone, email, whatsapp, tags_json, source, last_contacted_at, message_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, '["enquiry"]', ?, ?, 1, ?, ?)`,
    [
      id,
      businessId,
      input.name,
      input.phone,
      input.email,
      input.phone,
      input.source,
      now,
      now,
      now,
    ],
  );
  return { id, created: true };
}

async function nextLeadCode(env: AppContext["env"], businessId: string): Promise<string> {
  const row = await DB.first<{ n: number }>(
    env,
    "SELECT COUNT(*) AS n FROM leads WHERE business_id = ?",
    [businessId],
  );
  const base = 1000 + Number(row?.n ?? 0) + 1;
  // Uniqueness is guaranteed by the unique index; a collision is retried once.
  const suffix = Math.floor(Math.random() * 90 + 10);
  const candidate = `LD-${base}${suffix}`;
  const clash = await DB.first<{ id: string }>(env, "SELECT id FROM leads WHERE code = ?", [
    candidate,
  ]);
  return clash ? `LD-${Date.now().toString().slice(-6)}` : candidate;
}

/** Automation rules that fire on a public enquiry, executed inline (they are cheap and user-visible). */
async function runNewEnquiryAutomations(
  c: AppContext,
  businessId: string,
  context: { enquiryId: string; leadId: string; leadCode: string; name: string; phone: string },
): Promise<string[]> {
  const rules = await DB.all<{ id: string; action: string; config_json: string | null }>(
    c.env,
    "SELECT id, action, config_json FROM automations WHERE business_id = ? AND trigger_key = 'new_enquiry' AND enabled = 1",
    [businessId],
  );
  const executed: string[] = [];
  const now = nowIso();
  for (const rule of rules) {
    if (rule.action === "create_task") {
      await DB.run(
        c.env,
        `INSERT INTO tasks (id, business_id, lead_id, title, priority, status, due_at, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'high', 'open', ?, NULL, ?, ?)`,
        [
          newId("tsk"),
          businessId,
          context.leadId,
          `Reply to ${context.name} about ${context.leadCode}`,
          new Date(Date.now() + 4 * 3600_000).toISOString(),
          now,
          now,
        ],
      );
      executed.push("create_task");
    } else if (rule.action === "tag_contact") {
      await DB.run(
        c.env,
        `UPDATE contacts SET tags_json = JSON_SET(COALESCE(tags_json, '[]'), '$[0]', 'automation') WHERE id = (SELECT contact_id FROM enquiries WHERE id = ?)`,
        [context.enquiryId],
      );
      executed.push("tag_contact");
    } else if (rule.action === "assign_round_robin") {
      const agents = await DB.all<{ user_id: string }>(
        c.env,
        `SELECT user_id FROM memberships WHERE business_id = ? AND status = 'active' AND role IN ('owner','manager','agent')
          ORDER BY (SELECT COUNT(*) FROM leads l WHERE l.assignee_user_id = memberships.user_id AND l.stage NOT IN ('won','lost')) ASC LIMIT 1`,
        [businessId],
      );
      const agent = agents[0];
      if (agent) {
        await DB.run(c.env, "UPDATE leads SET assignee_user_id = ?, updated_at = ? WHERE id = ?", [
          agent.user_id,
          now,
          context.leadId,
        ]);
        await notify(c.env, {
          userId: agent.user_id,
          businessId,
          kind: "lead_assigned",
          title: `New lead assigned: ${context.name}`,
          body: `${context.leadCode} is waiting for a first reply.`,
          href: "/app/leads",
          dedupeKey: `lead_assigned:${context.leadId}`,
        });
        executed.push("assign_round_robin");
      }
    } else if (rule.action === "notify_owner") {
      executed.push("notify_owner");
    }
    await DB.run(c.env, "UPDATE automations SET runs = runs + 1, last_run_at = ? WHERE id = ?", [
      now,
      rule.id,
    ]);
  }
  return executed;
}

// ------------------------------------------------------------------ reviews ----

export async function createReview(c: AppContext): Promise<Response> {
  const user = requireUser(c);
  const input = await parseBody(reviewInput, c.request);
  await enforceLimit(c.env, "review", limitIdentity(user.user.id, c.ipHash));

  const business = await DB.first<{ id: string; name: string; status: string }>(
    c.env,
    "SELECT id, name, status FROM businesses WHERE id = ? OR slug = ?",
    [c.params["idOrSlug"] ?? "", c.params["idOrSlug"] ?? ""],
  );
  if (!business || business.status !== "published") throw ApiError.notFound("Business not found.");
  if (!(await flagEnabled(c.env, "reviews.public_enabled", business.id))) {
    throw ApiError.forbidden("Reviews are temporarily closed for maintenance.");
  }

  const own = await DB.first<{ user_id: string }>(
    c.env,
    "SELECT user_id FROM memberships WHERE business_id = ? AND user_id = ? AND status = 'active'",
    [business.id, user.user.id],
  );
  if (own) throw ApiError.forbidden("Business owners cannot publish reviews on their own listing.");

  const existing = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM reviews WHERE business_id = ? AND author_user_id = ?",
    [business.id, user.user.id],
  );
  if (existing) {
    throw ApiError.conflict("You have already reviewed this business. Edit your review instead.", {
      rating: "One review per business.",
    });
  }

  const id = newId("rev");
  const now = nowIso();
  await DB.run(
    c.env,
    `INSERT INTO reviews (id, business_id, author_user_id, rating, body, visit_date, status, source, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'published', 'directory', ?, ?)`,
    [id, business.id, user.user.id, input.rating, input.body, input.visitDate ?? null, now, now],
  );

  // Owners are told, and `review_published` automations run, off the request path
  // only when the rule exists — a plain review never pays for a queue message.
  const owner = business
    ? await DB.first<{ owner_user_id: string | null }>(
        c.env,
        "SELECT owner_user_id FROM businesses WHERE id = ?",
        [business.id],
      )
    : null;
  if (owner?.owner_user_id) {
    await notify(c.env, {
      userId: owner.owner_user_id,
      businessId: business.id,
      kind: "new_review",
      title: `New ${input.rating}★ review`,
      body: `${business.name} received a review. Reply to it — replies build trust.`,
      href: "/app/reviews",
      dedupeKey: `new_review:${id}`,
    });
  }
  await DB.run(
    c.env,
    `INSERT INTO metrics_daily (business_id, day, views, enquiries, whatsapp_chats, leads, updated_at)
     VALUES (?, ?, 0, 0, 0, 0, ?)
     ON CONFLICT (business_id, day) DO UPDATE SET views = views, updated_at = excluded.updated_at`,
    [business.id, today(), now],
  );
  await recordAudit(c.env, {
    businessId: business.id,
    actorUserId: user.user.id,
    actorLabel: user.user.displayName,
    action: "review.create",
    resourceType: "review",
    resourceId: id,
    metadata: { rating: input.rating },
    requestId: c.requestId,
  });

  return json({ ok: true, reviewId: id }, { status: 201 });
}

export async function updateReview(c: AppContext): Promise<Response> {
  const user = requireUser(c);
  const input = await parseBody(reviewInput, c.request);
  const result = await DB.run(
    c.env,
    "UPDATE reviews SET rating = ?, body = ?, updated_at = ? WHERE id = ? AND author_user_id = ?",
    [input.rating, input.body, nowIso(), c.params["reviewId"] ?? "", user.user.id],
  );
  const meta = (result as unknown as { meta?: { changes?: number } }).meta;
  if (!meta?.changes) throw ApiError.notFound("Review not found, or it is not yours to edit.");
  return json({ ok: true });
}

export async function deleteReview(c: AppContext): Promise<Response> {
  const user = requireUser(c);
  const review = await DB.first<{ id: string; business_id: string }>(
    c.env,
    "SELECT id, business_id FROM reviews WHERE id = ? AND author_user_id = ?",
    [c.params["reviewId"] ?? "", user.user.id],
  );
  if (!review) throw ApiError.notFound("Review not found.");
  await DB.run(c.env, "UPDATE reviews SET status = 'hidden', updated_at = ? WHERE id = ?", [
    nowIso(),
    review.id,
  ]);
  await recordAudit(c.env, {
    businessId: review.business_id,
    actorUserId: user.user.id,
    actorLabel: user.user.displayName,
    action: "review.self_hide",
    resourceType: "review",
    resourceId: review.id,
    requestId: c.requestId,
  });
  return json({ ok: true });
}

export async function replyToReview(c: AppContext): Promise<Response> {
  const input = await parseBody(reviewReplyInput, c.request);
  const review = await DB.first<{ id: string; business_id: string; status: string }>(
    c.env,
    "SELECT id, business_id, status FROM reviews WHERE id = ?",
    [c.params["reviewId"] ?? ""],
  );
  if (!review) throw ApiError.notFound("Review not found.");
  if (review.status !== "published")
    throw ApiError.domain("Only published reviews can be answered.");
  // Authorisation is the whole point of an owner reply: without a membership check any
  // signed-in visitor could put words in the business's mouth on any review.
  await requireAccess(c, review.business_id, "profile:write");
  const now = nowIso();
  await DB.run(
    c.env,
    "UPDATE reviews SET owner_reply = ?, owner_reply_at = ?, updated_at = ? WHERE id = ?",
    [input.body, now, now, review.id],
  );
  await recordAudit(c.env, {
    businessId: review.business_id,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "Business",
    action: "review.reply",
    resourceType: "review",
    resourceId: review.id,
    requestId: c.requestId,
  });
  return json({ ok: true });
}

// ------------------------------------------------------------------ saves ----

export async function saveBusiness(c: AppContext): Promise<Response> {
  const user = requireUser(c);
  const business = await DB.first<{ id: string; status: string }>(
    c.env,
    "SELECT id, status FROM businesses WHERE id = ? OR slug = ?",
    [c.params["idOrSlug"] ?? "", c.params["idOrSlug"] ?? ""],
  );
  if (!business) throw ApiError.notFound("Business not found.");
  await DB.run(
    c.env,
    "INSERT INTO saves (user_id, business_id, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
    [user.user.id, business.id, nowIso()],
  );
  await recomputeSaves(c, business.id);
  return json({ ok: true, saved: true }, { status: 201 });
}

export async function unsaveBusiness(c: AppContext): Promise<Response> {
  const user = requireUser(c);
  const business = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM businesses WHERE id = ? OR slug = ?",
    [c.params["idOrSlug"] ?? "", c.params["idOrSlug"] ?? ""],
  );
  if (!business) throw ApiError.notFound("Business not found.");
  await DB.run(c.env, "DELETE FROM saves WHERE user_id = ? AND business_id = ?", [
    user.user.id,
    business.id,
  ]);
  await recomputeSaves(c, business.id);
  return json({ ok: true, saved: false });
}

async function recomputeSaves(c: AppContext, businessId: string): Promise<void> {
  await DB.run(
    c.env,
    "UPDATE businesses SET saved_count = (SELECT COUNT(*) FROM saves WHERE business_id = ?) WHERE id = ?",
    [businessId, businessId],
  );
}

export async function mySaves(c: AppContext): Promise<Response> {
  const user = requireUser(c);
  const rows = await DB.all<{
    id: string;
    name: string;
    slug: string;
    city: string;
    state: string;
    saved_at: string;
  }>(
    c.env,
    `SELECT b.id, b.name, b.slug, b.city, b.state, s.created_at AS saved_at
       FROM saves s JOIN businesses b ON b.id = s.business_id
      WHERE s.user_id = ? AND b.status = 'published' ORDER BY s.created_at DESC LIMIT 50`,
    [user.user.id],
  );
  return json({ items: rows });
}

export async function myEnquiries(c: AppContext): Promise<Response> {
  const user = requireUser(c);
  const rows = await DB.all<{
    id: string;
    business: string;
    slug: string;
    status: string;
    created_at: string;
    need: string;
  }>(
    c.env,
    `SELECT e.id, b.name AS business, b.slug, e.status, e.created_at, e.need
       FROM enquiries e JOIN businesses b ON b.id = e.business_id
      WHERE e.sender_user_id = ? ORDER BY e.created_at DESC LIMIT 50`,
    [user.user.id],
  );
  return json({ items: rows });
}

// ------------------------------------------------------------- public forms ----

export async function createReport(c: AppContext): Promise<Response> {
  const input = await parseBody(reportInput, c.request);
  if (input.honeypot) return json({ ok: true, reference: "ignored" }, { status: 201 });
  await enforceLimit(c.env, "report", limitIdentity(c.session?.user.id ?? null, c.ipHash));

  const risk = scoreReportRisk(input.reason, input.detail);
  const id = newId("rep");
  const now = nowIso();
  const businessId = await resolveReportBusiness(c, input.targetType, input.targetId);

  const statements: { sql: string; params: unknown[] }[] = [
    {
      sql: `INSERT INTO reports (id, reporter_user_id, reporter_contact, target_type, target_id, business_id, reason, detail, risk, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      params: [
        id,
        c.session?.user.id ?? null,
        input.contact || null,
        input.targetType,
        input.targetId,
        businessId,
        input.reason,
        input.detail,
        risk,
        now,
        now,
      ],
    },
    {
      sql: `INSERT INTO moderation_items (id, item_type, target_id, business_id, reason, detail_json, risk, status, source, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'user_report', ?)
             -- Re-reporting an item that was already decided must bring it back for a
             -- second look; only bumping the risk would strand it outside the queue.
             ON CONFLICT (item_type, target_id) DO UPDATE SET
               risk = excluded.risk,
               reason = excluded.reason,
               detail_json = excluded.detail_json,
               status = 'pending',
               decided_at = NULL,
               decided_by = NULL,
               decision_note = NULL,
               created_at = excluded.created_at`,
      params: [
        newId("mod"),
        input.targetType === "business" ? "listing" : input.targetType,
        input.targetId,
        businessId,
        `Reported: ${input.reason}`,
        JSON.stringify({ reportId: id, reason: input.reason }),
        risk,
        now,
      ],
    },
  ];
  if (input.targetType === "review") {
    statements.push({
      sql: "UPDATE reviews SET reported_count = reported_count + 1 WHERE id = ?",
      params: [input.targetId],
    });
  }
  if (input.targetType === "business") {
    // Bumping updated_at is what tells moderators and the sitemap that this listing changed.
    statements.push({
      sql: "UPDATE businesses SET updated_at = ? WHERE id = ?",
      params: [now, businessId],
    });
  }
  await DB.write(c.env, statements);

  const automationCount = await DB.count(
    c.env,
    "SELECT COUNT(*) AS n FROM automations WHERE business_id = ? AND trigger_key = 'listing_reported' AND enabled = 1",
    [businessId ?? ""],
  );
  if (automationCount > 0 && businessId) {
    await notifyBusinessOwnersQuiet(
      c,
      businessId,
      "listing_reported",
      "A listing report needs review",
      `Reason: ${input.reason}. Risk: ${risk}.`,
    );
  }

  return json(
    {
      ok: true,
      reference: `GH-${id.slice(-6).toUpperCase()}`,
      risk,
      message:
        "Thanks — our moderators review reports in order of risk. High-risk reports are looked at first.",
    },
    { status: 201 },
  );
}

async function resolveReportBusiness(
  c: AppContext,
  targetType: string,
  targetId: string,
): Promise<string | null> {
  switch (targetType) {
    case "business":
    case "listing":
      return (
        (
          await DB.first<{ id: string }>(
            c.env,
            "SELECT id FROM businesses WHERE id = ? OR slug = ?",
            [targetId, targetId],
          )
        )?.id ?? null
      );
    case "review":
      return (
        (
          await DB.first<{ business_id: string }>(
            c.env,
            "SELECT business_id FROM reviews WHERE id = ?",
            [targetId],
          )
        )?.business_id ?? null
      );
    case "media":
      return (
        (
          await DB.first<{ business_id: string }>(
            c.env,
            "SELECT business_id FROM media WHERE id = ?",
            [targetId],
          )
        )?.business_id ?? null
      );
    default:
      return null;
  }
}

async function notifyBusinessOwnersQuiet(
  c: AppContext,
  businessId: string,
  kind: string,
  title: string,
  body: string,
): Promise<void> {
  const owners = await DB.all<{ user_id: string }>(
    c.env,
    "SELECT user_id FROM memberships WHERE business_id = ? AND status = 'active' AND role IN ('owner','manager')",
    [businessId],
  );
  for (const owner of owners) {
    await notify(c.env, {
      userId: owner.user_id,
      businessId,
      kind: kind as never,
      title,
      body,
      dedupeKey: `${kind}:${businessId}:${Date.now()}`,
    }).catch(() => undefined);
  }
}

export async function suggestBusiness(c: AppContext): Promise<Response> {
  const input = await parseBody(suggestBusinessInput, c.request);
  if (input.honeypot) return json({ ok: true, reference: "ignored" }, { status: 201 });
  await enforceLimit(c.env, "suggest", limitIdentity(c.session?.user.id ?? null, c.ipHash));

  const id = newId("sug");
  const now = nowIso();
  const category = input.categorySlug
    ? await DB.first<{ id: string }>(c.env, "SELECT id FROM categories WHERE slug = ?", [
        input.categorySlug,
      ])
    : null;

  await DB.run(
    c.env,
    `INSERT INTO moderation_items (id, item_type, target_id, business_id, reason, detail_json, risk, status, source, created_at)
     VALUES (?, 'listing', ?, NULL, ?, ?, 'low', 'pending', 'user_report', ?)`,
    [
      id,
      input.listingId ?? slugify(input.businessName),
      `Suggestion: ${input.kind}`,
      JSON.stringify({
        kind: input.kind,
        businessName: input.businessName,
        categoryId: category?.id ?? null,
        phone: input.phone || null,
        address: input.address,
        details: input.details,
        contact: input.contact || null,
      }),
      now,
    ],
  );
  return json(
    {
      ok: true,
      reference: `SUG-${id.slice(-6).toUpperCase()}`,
      message:
        "Sent to our category team. Suggestions never give you control of a listing — claim it instead.",
    },
    { status: 201 },
  );
}

export async function createClaim(c: AppContext): Promise<Response> {
  const user = requireUser(c);
  const input = await parseBody(claimInput, c.request);
  const business = await DB.first<{ id: string; name: string; owner_user_id: string | null }>(
    c.env,
    "SELECT id, name, owner_user_id FROM businesses WHERE id = ?",
    [input.businessId],
  );
  if (!business) throw ApiError.notFound("We could not find that listing.");

  const pending = await DB.first<{ id: string; status: string }>(
    c.env,
    "SELECT id, status FROM claims WHERE business_id = ? AND claimant_user_id = ?",
    [business.id, user.user.id],
  );
  if (pending && ["pending", "in_review"].includes(pending.status)) {
    throw ApiError.conflict("You already have a claim in review for this listing.", {
      form: "Check your email for the review status.",
    });
  }

  const id = newId("clm");
  const now = nowIso();
  const mediaId = newId("med");
  const uploadToken = await signClaimUpload(c, mediaId, business.id, input);
  await DB.write(c.env, [
    {
      sql: `INSERT INTO media (id, business_id, uploaded_by_user_id, kind, label, alt, r2_key, content_type, size_bytes, moderation_status, created_at)
            VALUES (?, ?, ?, 'document', 'Ownership evidence', 'Ownership evidence document', ?, ?, ?, 'pending', ?)`,
      params: [
        mediaId,
        business.id,
        user.user.id,
        `business/${business.id}/${mediaId}`,
        input.evidenceMediaType,
        input.evidenceSizeBytes,
        now,
      ],
    },
    {
      sql: `INSERT INTO claims (id, business_id, claimant_user_id, role, note, evidence_media_id, status, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            ON CONFLICT (business_id, claimant_user_id) DO UPDATE SET
              role = excluded.role, note = excluded.note, evidence_media_id = excluded.evidence_media_id,
              status = 'pending', submitted_at = excluded.submitted_at, decided_at = NULL, review_note = NULL`,
      params: [id, business.id, user.user.id, input.role, input.note, mediaId, now],
    },
  ]);

  await recordAudit(c.env, {
    businessId: business.id,
    actorUserId: user.user.id,
    actorLabel: user.user.displayName,
    action: "claim.submit",
    resourceType: "claim",
    resourceId: id,
    metadata: {
      role: input.role,
      evidenceType: input.evidenceMediaType,
      bytes: input.evidenceSizeBytes,
    },
    requestId: c.requestId,
  });

  return json(
    {
      ok: true,
      claimId: id,
      uploadTicket: uploadToken,
      message:
        "Upload your evidence, then our verification team reviews it within the published SLA.",
    },
    { status: 201 },
  );
}

async function signClaimUpload(
  c: AppContext,
  mediaId: string,
  businessId: string,
  input: { evidenceSizeBytes: number; evidenceMediaType: string },
): Promise<{
  mediaId: string;
  method: "PUT";
  url: string;
  expiresInSeconds: number;
  maxSizeBytes: number;
}> {
  const token = await signUploadTicket(c.env, {
    m: mediaId,
    b: businessId,
    u: c.session?.user.id ?? "anon",
    s: input.evidenceSizeBytes,
    t: input.evidenceMediaType,
    e: Math.floor(Date.now() / 1000) + UPLOAD_TTL_SECONDS,
  });
  return {
    mediaId,
    method: "PUT",
    url: `${(c.env.API_URL ?? c.url.origin).replace(/\/$/, "")}/media/upload/${token}`,
    expiresInSeconds: UPLOAD_TTL_SECONDS,
    maxSizeBytes: input.evidenceSizeBytes,
  };
}
