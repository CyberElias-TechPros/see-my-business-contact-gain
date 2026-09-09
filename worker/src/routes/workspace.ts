import { z } from "zod";

import {
  analyticsQuery,
  businessProfilePatchInput,
  type BusinessProfileInput,
  type BusinessProfilePatchInput,
  type WorkspaceStats,
  type WorkspaceSummary,
} from "../../../shared/api.ts";
import {
  VERIFICATION_RANK,
  type VerificationLevel,
  normalizeNigerianPhone,
  slugify,
} from "../../../shared/domain.ts";
import { DB } from "../db-access.ts";
import { newId, nowIso, today } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseBody, parseQuery } from "../http.ts";
import { recordAudit } from "../audit.ts";
import { access } from "./guards.ts";
import { notifyBusinessOwners } from "../notifications.ts";
import { getConfig } from "../cache.ts";
import type { AppContext } from "../types.ts";

/** Public-facing status gate: a business is discoverable only when complete enough. */
export const MINIMUM_PUBLISH_SCORE = 60;

export async function getSummary(c: AppContext): Promise<Response> {
  const actor = await access(c, "analytics:read");
  const summary = await buildSummary(c, actor.businessId);
  return json(summary, { headers: { "cache-control": "private, max-age=20" } });
}

export async function buildSummary(c: AppContext, businessId: string): Promise<WorkspaceSummary> {
  const business = await DB.first<{
    id: string;
    name: string;
    slug: string;
    plan: "free" | "growth" | "pro";
    status: string;
    contacts_gained: number;
    view_count: number;
    response_minutes: number | null;
    profile_complete: number;
  }>(
    c.env,
    `SELECT id, name, slug, plan, status, contacts_gained, view_count, response_minutes, profile_complete FROM businesses WHERE id = ?`,
    [businessId],
  );
  if (!business) throw ApiError.notFound("Business not found.");

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const prev = new Date(Date.now() - 14 * 86_400_000).toISOString();

  const [metrics, stages, sources, trend, attention] = await Promise.all([
    DB.first<{
      contacts: number;
      new_leads: number;
      prev_leads: number;
      won: number;
      open_tasks: number;
      unassigned: number;
    }>(
      c.env,
      `SELECT
        (SELECT COUNT(*) FROM leads WHERE business_id = ?) AS contacts,
        (SELECT COUNT(*) FROM leads WHERE business_id = ? AND created_at >= ?) AS new_leads,
        (SELECT COUNT(*) FROM leads WHERE business_id = ? AND created_at >= ? AND created_at < ?) AS prev_leads,
        (SELECT COALESCE(SUM(value_minor), 0) FROM leads WHERE business_id = ? AND stage = 'won' AND won_at >= ?) AS won,
        (SELECT COUNT(*) FROM tasks WHERE business_id = ? AND status = 'open') AS open_tasks,
        (SELECT COUNT(*) FROM leads WHERE business_id = ? AND assignee_user_id IS NULL AND stage NOT IN ('won','lost')) AS unassigned`,
      [
        businessId,
        businessId,
        since,
        businessId,
        prev,
        since,
        businessId,
        since,
        businessId,
        businessId,
      ],
    ),
    DB.all<{ stage: string; n: number }>(
      c.env,
      "SELECT stage, COUNT(*) AS n FROM leads WHERE business_id = ? GROUP BY stage",
      [businessId],
    ),
    DB.all<{ source: string; n: number }>(
      c.env,
      "SELECT source, COUNT(*) AS n FROM leads WHERE business_id = ? GROUP BY source ORDER BY n DESC",
      [businessId],
    ),
    DB.all<{ day: string; enquiries: number; leads: number }>(
      c.env,
      `SELECT day, enquiries, leads FROM metrics_daily WHERE business_id = ? AND day >= date('now', '-13 days') ORDER BY day`,
      [businessId],
    ),
    buildAttention(c, businessId, business.profile_complete),
  ]);

  const totalLeads = stages.reduce((sum, row) => sum + Number(row.n), 0);
  const contacts = Number(metrics?.contacts ?? 0);
  const newLeads = Number(metrics?.new_leads ?? 0);
  const prevLeads = Number(metrics?.prev_leads ?? 0);

  return {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      plan: business.plan,
      status: business.status,
    },
    role: (await currentRole(c, businessId)) ?? "agent",
    metrics: {
      contactsGained: contacts,
      contactsGainedDelta: prevLeads ? Math.round(((newLeads - prevLeads) / prevLeads) * 100) : 0,
      newLeads,
      newLeadsDelta: prevLeads ? Math.round(((newLeads - prevLeads) / prevLeads) * 100) : 0,
      avgReplyMinutes: business.response_minutes,
      wonValueMinor: Number(metrics?.won ?? 0),
      openTasks: Number(metrics?.open_tasks ?? 0),
      unassignedLeads: Number(metrics?.unassigned ?? 0),
      profileCompleteness: Number(business.profile_complete ?? 0),
    },
    trend: trend.map((row) => ({
      date: row.day,
      contacts: Number(row.leads),
      leads: Number(row.leads),
      enquiries: Number(row.enquiries),
    })),
    sources: sources.map((row) => ({
      source: row.source as WorkspaceSummary["sources"][number]["source"],
      count: Number(row.n),
      share: totalLeads ? Math.round((Number(row.n) / totalLeads) * 100) : 0,
    })),
    stages: stages.map((row) => ({
      stage: row.stage as WorkspaceSummary["stages"][number]["stage"],
      count: Number(row.n),
    })),
    attention,
  };
}

async function currentRole(c: AppContext, businessId: string) {
  if (!c.session) return null;
  if (c.session.user.role === "admin") return "owner" as const;
  const row = await DB.first<{ role: "owner" | "manager" | "agent" | "marketing" }>(
    c.env,
    "SELECT role FROM memberships WHERE business_id = ? AND user_id = ? AND status = 'active'",
    [businessId, c.session.user.id],
  );
  return row?.role ?? null;
}

async function buildAttention(c: AppContext, businessId: string, completeness: number) {
  const items: WorkspaceSummary["attention"] = [];
  if (completeness < MINIMUM_PUBLISH_SCORE) {
    items.push({
      id: "profile",
      kind: "profile",
      label: "Profile is below publish quality",
      detail: `Score ${completeness}/100. Add hours, photos and prices to rank higher.`,
      href: "/app/profile",
    });
  }
  const status = await DB.first<{ status: string }>(
    c.env,
    "SELECT status FROM businesses WHERE id = ?",
    [businessId],
  );
  if (status?.status === "draft" || status?.status === "pending") {
    items.push({
      id: "publish",
      kind: "publish",
      label: "Listing is not live yet",
      detail: "Publish when you are ready — customers only see published profiles.",
      href: "/app/profile",
    });
  }
  const stale = await DB.count(
    c.env,
    `SELECT COUNT(*) AS n FROM leads WHERE business_id = ? AND stage NOT IN ('won','lost') AND last_activity_at < datetime('now', '-3 days')`,
    [businessId],
  );
  if (stale > 0) {
    items.push({
      id: "stale",
      kind: "leads",
      label: `${stale} lead${stale === 1 ? "" : "s"} gone quiet`,
      detail: "Follow up within 3 days to keep win rates up.",
      href: "/app/leads?filter=stale",
    });
  }
  const unattended = await DB.count(
    c.env,
    "SELECT COUNT(*) AS n FROM enquiries WHERE business_id = ? AND status = 'new'",
    [businessId],
  );
  if (unattended > 0) {
    items.push({
      id: "inbox",
      kind: "inbox",
      label: `${unattended} unread ${unattended === 1 ? "enquiry" : "enquiries"}`,
      detail: "Fast first replies win the ranking.",
      href: "/app/inbox",
    });
  }
  const flagged = await DB.count(
    c.env,
    "SELECT COUNT(*) AS n FROM moderation_items WHERE business_id = ? AND status = 'pending'",
    [businessId],
  );
  if (flagged > 0) {
    items.push({
      id: "moderation",
      kind: "moderation",
      label: "Media awaiting review",
      detail: "Our moderators will notify you when it clears.",
      href: "/app/products",
    });
  }
  return items;
}

// ----------------------------------------------------------------- profile ----

export async function getProfile(c: AppContext): Promise<Response> {
  await access(c, "profile:read");
  const row = await DB.first<ProfileRow>(
    c.env,
    `SELECT b.*, c.slug AS category_slug, c.name AS category_name,
            (SELECT COUNT(*) FROM media m WHERE m.business_id = b.id AND m.deleted_at IS NULL) AS media_count,
            (SELECT COUNT(*) FROM services s WHERE s.business_id = b.id AND s.active = 1) AS service_count,
            (SELECT COUNT(*) FROM products p WHERE p.business_id = b.id AND p.active = 1) AS product_count
       FROM businesses b JOIN categories c ON c.id = b.category_id WHERE b.id = ?`,
    [c.params["businessId"] ?? ""],
  );
  if (!row) throw ApiError.notFound("Business not found.");
  const hours = await DB.all<{
    day_of_week: number;
    opens: string | null;
    closes: string | null;
    closed: number;
  }>(c.env, "SELECT day_of_week, opens, closes, closed FROM business_hours WHERE business_id = ?", [
    row.id,
  ]);
  const settings = await getSettingsRow(c, row.id);
  return json({
    profile: {
      id: row.id,
      slug: row.slug,
      name: row.name,
      tagline: row.tagline,
      about: row.about,
      categorySlug: row.category_slug,
      categoryName: row.category_name,
      city: row.city,
      area: row.area,
      state: row.state,
      address: row.address,
      phone: row.phone,
      whatsapp: row.whatsapp,
      website: row.website,
      socials: parseJson<{ label: string; handle: string; url: string | null }[]>(
        row.socials_json,
        [],
      ),
      amenities: parseJson<string[]>(row.amenities_json, []),
      serviceAreas: parseJson<string[]>(row.service_areas_json, []),
      responseMinutes: row.response_minutes,
      verifiedLevel: row.verified_level,
      status: row.status,
      plan: row.plan,
      profileComplete: row.profile_complete,
      ratingAvg: row.rating_avg,
      ratingCount: row.rating_count,
      contactsGained: row.contacts_gained,
      viewCount: row.view_count,
      savedCount: row.saved_count,
      publishedAt: row.published_at,
      counts: {
        media: Number(row.media_count ?? 0),
        services: Number(row.service_count ?? 0),
        products: Number(row.product_count ?? 0),
      },
      hours: [1, 2, 3, 4, 5, 6, 0].map((day) => {
        const entry = hours.find((h) => h.day_of_week === day);
        return {
          dayOfWeek: day,
          opens: entry?.opens ?? "",
          closes: entry?.closes ?? "",
          closed: entry ? entry.closed === 1 || !entry.opens : true,
        };
      }),
    },
    settings,
  });
}

type ProfileRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  about: string;
  city: string;
  area: string | null;
  state: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  socials_json: string | null;
  amenities_json: string | null;
  service_areas_json: string | null;
  response_minutes: number | null;
  verified_level: string;
  status: string;
  plan: "free" | "growth" | "pro";
  profile_complete: number;
  rating_avg: number;
  rating_count: number;
  contacts_gained: number;
  view_count: number;
  saved_count: number;
  published_at: string | null;
  category_slug: string;
  category_name: string;
  media_count: number | null;
  service_count: number | null;
  product_count: number | null;
};

export async function updateProfile(c: AppContext): Promise<Response> {
  const actor = await access(c, "profile:write");
  const patch = await parseBody(businessProfilePatchInput, c.request);
  const stored = await DB.first<StoredProfile>(
    c.env,
    `SELECT b.name, b.tagline, b.about, b.city, b.area, b.state, b.address, b.phone, b.whatsapp, b.website,
            b.slug, b.socials_json, b.amenities_json, b.service_areas_json, b.response_minutes, c.slug AS category_slug
       FROM businesses b LEFT JOIN categories c ON c.id = b.category_id
      WHERE b.id = ?`,
    [actor.businessId],
  );
  if (!stored) throw ApiError.notFound("Business not found.");
  const input = mergeProfilePatch(stored, patch);
  const category = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM categories WHERE slug = ? AND is_active = 1",
    [input.categorySlug],
  );
  if (!category) throw ApiError.validation({ categorySlug: "Choose a valid category." });

  const location = input.city
    ? await DB.first<{ id: string }>(
        c.env,
        "SELECT id FROM locations WHERE slug = ? OR lower(name) = ? OR lower(state) = ?",
        [slugify(input.city), input.city.toLowerCase(), input.state.toLowerCase()],
      )
    : null;

  const phone = input.phone ? normalizeNigerianPhone(input.phone) : null;
  const whatsapp = input.whatsapp ? normalizeNigerianPhone(input.whatsapp) : null;
  if (input.phone && !phone)
    throw ApiError.validation({ phone: "Enter a valid Nigerian phone number." });
  if (input.whatsapp && !whatsapp)
    throw ApiError.validation({ whatsapp: "Enter a valid Nigerian WhatsApp number." });

  const nameClash = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM businesses WHERE lower(name) = lower(?) AND lower(city) = lower(?) AND id <> ?",
    [input.name, input.city, actor.businessId],
  );
  if (nameClash)
    throw ApiError.conflict("A listing with that name already exists in this city.", {
      name: "Already listed here.",
    });

  const now = nowIso();
  const socials = [
    input.instagram
      ? {
          label: "Instagram",
          handle: `@${input.instagram.replace(/^@/, "")}`,
          url: `https://instagram.com/${input.instagram.replace(/^@/, "")}`,
        }
      : null,
    input.tiktok
      ? {
          label: "TikTok",
          handle: `@${input.tiktok.replace(/^@/, "")}`,
          url: `https://tiktok.com/@${input.tiktok.replace(/^@/, "")}`,
        }
      : null,
  ].filter(Boolean);

  const slug =
    input.name === stored.name
      ? stored.slug
      : await ensureUniqueSlug(c, input.name, actor.businessId);

  const statements: { sql: string; params: unknown[] }[] = [
    {
      sql: `UPDATE businesses SET name = ?, tagline = ?, about = ?, category_id = ?, location_id = ?, city = ?, area = ?,
              state = ?, address = ?, phone = ?, whatsapp = ?, website = ?, socials_json = ?, amenities_json = ?,
              service_areas_json = ?, response_minutes = ?, profile_complete = ?, slug = ?, updated_at = ?
            WHERE id = ?`,
      params: [
        input.name,
        input.tagline,
        input.about,
        category.id,
        location?.id ?? null,
        input.city,
        input.area || null,
        input.state,
        input.address || null,
        phone,
        whatsapp,
        input.website || null,
        JSON.stringify(socials),
        JSON.stringify(input.amenities),
        JSON.stringify(input.serviceAreas),
        input.responseMinutes ?? null,
        0, // recomputed below so the score can never be client-supplied
        slug,
        now,
        actor.businessId,
      ],
    },
  ];

  for (const entry of input.hours) {
    statements.push({
      sql: `INSERT INTO business_hours (business_id, day_of_week, opens, closes, closed)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT (business_id, day_of_week) DO UPDATE SET opens = excluded.opens, closes = excluded.closes, closed = excluded.closed`,
      params: [
        actor.businessId,
        entry.dayOfWeek,
        entry.closed ? null : entry.opens || null,
        entry.closed ? null : entry.closes || null,
        entry.closed || !entry.opens ? 1 : 0,
      ],
    });
  }

  await DB.write(c.env, statements);
  const completeness = await recomputeCompleteness(c, actor.businessId);

  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    actorKind: c.session?.user.role === "admin" ? "admin" : "user",
    action: "business.update_profile",
    resourceType: "business",
    resourceId: actor.businessId,
    metadata: {
      completeness,
      slugChanged: slug !== stored.slug,
      fields: Object.keys(patch).filter((key) => key !== "replace"),
    },
    ipHash: c.ipHash,
    requestId: c.requestId,
  });

  return json({ ok: true, profileComplete: completeness, slug });
}

/** The stored row in the shape the profile form uses, so a partial save can be merged. */
type StoredProfile = {
  name: string;
  tagline: string;
  about: string;
  city: string;
  area: string | null;
  state: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  slug: string;
  socials_json: string;
  amenities_json: string;
  service_areas_json: string;
  response_minutes: number | null;
  category_slug: string | null;
};

function socialHandle(socials: unknown[], label: string): string {
  const found = socials.find(
    (entry) =>
      String((entry as { label?: string }).label ?? "").toLowerCase() === label.toLowerCase(),
  );
  return found ? String((found as { handle?: string }).handle ?? "").replace(/^@/, "") : "";
}

/**
 * Merges a card-sized patch into the stored profile. Only the keys the client sent are
 * re-validated (the patch schema carries every field rule); untouched values are reused
 * verbatim, which is what makes "save this section" safe even on a half-finished listing.
 */
function mergeProfilePatch(
  stored: StoredProfile,
  patch: BusinessProfilePatchInput,
): BusinessProfileInput {
  const socials = parseJson<unknown[]>(stored.socials_json, []);
  return {
    name: patch.name ?? stored.name,
    tagline: patch.tagline ?? stored.tagline,
    about: patch.about ?? stored.about,
    categorySlug: patch.categorySlug ?? stored.category_slug ?? "other",
    city: patch.city ?? stored.city,
    area: patch.area ?? stored.area ?? "",
    state: patch.state ?? stored.state,
    address: patch.address ?? stored.address ?? "",
    phone: patch.phone ?? stored.phone ?? "",
    whatsapp: patch.whatsapp ?? stored.whatsapp ?? "",
    website: patch.website ?? stored.website ?? "",
    instagram: patch.instagram ?? socialHandle(socials, "Instagram"),
    tiktok: patch.tiktok ?? socialHandle(socials, "TikTok"),
    amenities: patch.amenities ?? parseJson<string[]>(stored.amenities_json, []),
    serviceAreas: patch.serviceAreas ?? parseJson<string[]>(stored.service_areas_json, []),
    responseMinutes: patch.responseMinutes ?? stored.response_minutes ?? undefined,
    hours: patch.hours ?? [],
  };
}

export async function ensureUniqueSlug(
  c: AppContext,
  name: string,
  exceptId: string,
): Promise<string> {
  const base = slugify(name) || "business";
  let candidate = base;
  for (let attempt = 2; attempt < 12; attempt++) {
    const clash = await DB.first<{ id: string }>(
      c.env,
      "SELECT id FROM businesses WHERE slug = ? AND id <> ?",
      [candidate, exceptId],
    );
    if (!clash) return candidate;
    candidate = `${base}-${attempt}`;
  }
  return `${base}-${newId("s").slice(2, 6)}`;
}

/** Completeness is derived, never posted — that stops "100%" being cosmetic. */
export async function recomputeCompleteness(c: AppContext, businessId: string): Promise<number> {
  const row = await DB.first<{
    tagline: string;
    about: string;
    phone: string | null;
    whatsapp: string | null;
    address: string | null;
    hours: number;
    media: number;
    services: number;
    verified: string;
  }>(
    c.env,
    `SELECT b.tagline, b.about, b.phone, b.whatsapp, b.address, b.verified_level,
            (SELECT COUNT(*) FROM business_hours h WHERE h.business_id = b.id AND h.closed = 0) AS hours,
            (SELECT COUNT(*) FROM media m WHERE m.business_id = b.id AND m.deleted_at IS NULL AND m.moderation_status = 'approved') AS media,
            (SELECT COUNT(*) FROM services s WHERE s.business_id = b.id AND s.active = 1) AS services
       FROM businesses b WHERE b.id = ?`,
    [businessId],
  );
  if (!row) return 0;
  let score = 0;
  if (row.tagline.length >= 8) score += 10;
  if (row.about.length >= 120) score += 20;
  if (row.whatsapp || row.phone) score += 15;
  if (row.address) score += 10;
  if (Number(row.hours ?? 0) >= 5) score += 15;
  if (Number(row.media ?? 0) >= 3) score += 15;
  if (Number(row.services ?? 0) >= 1) score += 10;
  if (row.verified !== "unverified") score += 5;
  await DB.run(c.env, "UPDATE businesses SET profile_complete = ? WHERE id = ?", [
    Math.min(100, score),
    businessId,
  ]);
  return Math.min(100, score);
}

// ----------------------------------------------------------------- publish ----

export async function publish(c: AppContext): Promise<Response> {
  const actor = await access(c, "profile:write");
  const completeness = await recomputeCompleteness(c, actor.businessId);
  if (completeness < MINIMUM_PUBLISH_SCORE) {
    throw ApiError.domain(
      `Your profile is ${completeness}/100 complete. Add opening hours, at least three photos and one priced service before publishing.`,
      { form: "Profile not complete enough to publish." },
    );
  }
  const current = await DB.first<{ status: string }>(
    c.env,
    "SELECT status FROM businesses WHERE id = ?",
    [actor.businessId],
  );
  if (current?.status === "published")
    return json({ ok: true, status: "published", message: "Already live." });

  const config = await getConfig(c.env);
  const now = nowIso();
  // Newly published listings queue for moderation when the trust flag says so;
  // an already-verified owner goes live immediately.
  const verified = await DB.first<{ verified_level: string }>(
    c.env,
    "SELECT verified_level FROM businesses WHERE id = ?",
    [actor.businessId],
  );
  const needsReview =
    config.signup.requireEmailVerification && verified?.verified_level === "unverified";
  await DB.run(
    c.env,
    "UPDATE businesses SET status = ?, published_at = ?, updated_at = ? WHERE id = ?",
    [needsReview ? "pending" : "published", needsReview ? null : now, now, actor.businessId],
  );
  if (needsReview) {
    await DB.run(
      c.env,
      `INSERT INTO moderation_items (id, item_type, target_id, business_id, reason, detail_json, risk, status, source, created_at)
      VALUES (?, 'listing', ?, ?, 'New listing awaiting first review', '{}', 'low', 'pending', 'system', ?)`,
      [newId("mod"), actor.businessId, actor.businessId, now],
    );
  }
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: needsReview ? "business.submit_for_review" : "business.publish",
    resourceType: "business",
    resourceId: actor.businessId,
    metadata: { completeness, status: needsReview ? "pending" : "published" },
    requestId: c.requestId,
  });
  return json({ ok: true, status: needsReview ? "pending" : "published", completeness });
}

export async function unpublish(c: AppContext): Promise<Response> {
  const actor = await access(c, "profile:write");
  await DB.run(c.env, "UPDATE businesses SET status = 'draft', updated_at = ? WHERE id = ?", [
    nowIso(),
    actor.businessId,
  ]);
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "business.unpublish",
    resourceType: "business",
    resourceId: actor.businessId,
    requestId: c.requestId,
  });
  return json({ ok: true, status: "draft" });
}

// ---------------------------------------------------------------- settings ----

export async function getSettings(c: AppContext): Promise<Response> {
  await access(c, "profile:read");
  return json({ settings: await getSettingsRow(c, c.params["businessId"] ?? "") });
}

async function getSettingsRow(c: AppContext, businessId: string) {
  const row = await DB.first<SettingsRow>(
    c.env,
    "SELECT * FROM business_settings WHERE business_id = ?",
    [businessId],
  );
  return {
    enquiryForm: {
      enabled: (row?.enquiry_form_enabled ?? 1) === 1,
      requirePhone: (row?.enquiry_require_phone ?? 1) === 1,
      autoAckMessage: row?.autoack_message ?? null,
    },
    notificationPrefs: {
      newEnquiry: (row?.notify_new_enquiry ?? 1) === 1,
      newReview: (row?.notify_new_review ?? 1) === 1,
      leadStale: (row?.notify_lead_stale ?? 1) === 1,
      weeklyDigest: (row?.weekly_digest ?? 1) === 1,
    },
    visibility: { hidePhone: (row?.hide_phone ?? 0) === 1 },
  };
}

type SettingsRow = {
  enquiry_form_enabled: number;
  enquiry_require_phone: number;
  autoack_message: string | null;
  hide_phone: number;
  notify_new_enquiry: number;
  notify_new_review: number;
  notify_lead_stale: number;
  weekly_digest: number;
};

export async function updateSettings(c: AppContext): Promise<Response> {
  const actor = await access(c, "profile:write");
  const input = await parseBody(settingsUpdateInput, c.request);
  const now = nowIso();
  await DB.run(
    c.env,
    `INSERT INTO business_settings (business_id, enquiry_form_enabled, enquiry_require_phone, autoack_message, hide_phone,
        notify_new_enquiry, notify_new_review, notify_lead_stale, weekly_digest, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (business_id) DO UPDATE SET
       enquiry_form_enabled = excluded.enquiry_form_enabled,
       enquiry_require_phone = excluded.enquiry_require_phone,
       autoack_message = excluded.autoack_message,
       hide_phone = excluded.hide_phone,
       notify_new_enquiry = excluded.notify_new_enquiry,
       notify_new_review = excluded.notify_new_review,
       notify_lead_stale = excluded.notify_lead_stale,
       weekly_digest = excluded.weekly_digest,
       updated_at = excluded.updated_at`,
    [
      actor.businessId,
      input.enquiryForm.enabled ? 1 : 0,
      input.enquiryForm.requirePhone ? 1 : 0,
      input.enquiryForm.autoAckMessage?.slice(0, 500) ?? null,
      input.visibility.hidePhone ? 1 : 0,
      input.notificationPrefs.newEnquiry ? 1 : 0,
      input.notificationPrefs.newReview ? 1 : 0,
      input.notificationPrefs.leadStale ? 1 : 0,
      input.notificationPrefs.weeklyDigest ? 1 : 0,
      now,
    ],
  );
  await recordAudit(c.env, {
    businessId: actor.businessId,
    actorUserId: c.session?.user.id ?? null,
    actorLabel: c.session?.user.displayName ?? "System",
    action: "business.update_settings",
    resourceType: "business",
    resourceId: actor.businessId,
    requestId: c.requestId,
  });
  return json({ ok: true, settings: await getSettingsRow(c, actor.businessId) });
}

export const settingsUpdateInput = z.object({
  enquiryForm: z.object({
    enabled: z.boolean(),
    requirePhone: z.boolean(),
    autoAckMessage: z.string().trim().max(500).nullable().optional(),
  }),
  notificationPrefs: z.object({
    newEnquiry: z.boolean(),
    newReview: z.boolean(),
    leadStale: z.boolean(),
    weeklyDigest: z.boolean(),
  }),
  visibility: z.object({ hidePhone: z.boolean() }),
});

// --------------------------------------------------------------- analytics ----

export async function getAnalytics(c: AppContext): Promise<Response> {
  const actor = await access(c, "analytics:read");
  const query = parseQuery(analyticsQuery, c.url);
  const days = query.days;
  const since = new Date(Date.now() - (days - 1) * 86_400_000).toISOString().slice(0, 10);

  const [daily, sources, totals] = await Promise.all([
    DB.all<{
      day: string;
      views: number;
      enquiries: number;
      leads: number;
      whatsapp_chats: number;
      won_value_minor: number;
    }>(
      c.env,
      `SELECT day, views, enquiries, leads, whatsapp_chats, won_value_minor FROM metrics_daily
        WHERE business_id = ? AND day >= ? ORDER BY day`,
      [actor.businessId, since],
    ),
    DB.all<{ source: string; count: number; leads: number }>(
      c.env,
      `SELECT source, COUNT(*) AS count, SUM(CASE WHEN stage IN ('won','quoted') THEN 1 ELSE 0 END) AS leads
         FROM leads WHERE business_id = ? GROUP BY source ORDER BY count DESC`,
      [actor.businessId],
    ),
    DB.first<{ views: number; enquiries: number; leads: number; won: number }>(
      c.env,
      `SELECT
        COALESCE(SUM(views), 0) AS views,
        COALESCE(SUM(enquiries), 0) AS enquiries,
        COALESCE(SUM(leads), 0) AS leads,
        COALESCE(SUM(won_value_minor), 0) AS won
       FROM metrics_daily WHERE business_id = ? AND day >= ?`,
      [actor.businessId, since],
    ),
  ]);

  const viewCount = Number(totals?.views ?? 0);
  const enquiryCount = Number(totals?.enquiries ?? 0);
  const sourceTotal = sources.reduce((sum, row) => sum + Number(row.count), 0);

  const stats: WorkspaceStats = {
    totalViews: viewCount,
    totalEnquiries: enquiryCount,
    totalLeads: Number(totals?.leads ?? 0),
    conversionRate: viewCount ? Math.round((enquiryCount / viewCount) * 1000) / 10 : 0,
    sources: sources.map((row) => ({
      source: row.source as WorkspaceStats["sources"][number]["source"],
      count: Number(row.count),
      leads: Number(row.leads ?? 0),
      share: sourceTotal ? Math.round((Number(row.count) / sourceTotal) * 100) : 0,
    })),
    days: daily.map((row) => ({
      date: row.day,
      views: Number(row.views),
      enquiries: Number(row.enquiries),
      leads: Number(row.leads),
      contacts: Number(row.whatsapp_chats),
    })),
  };
  return json({ stats, rangeDays: days, generatedAt: nowIso(), today: today() });
}

// -------------------------------------------------------------- audit + misc ----

export async function listAudit(c: AppContext): Promise<Response> {
  const actor = await access(c, "audit:read");
  const page = Math.min(200, Math.max(1, Number(c.url.searchParams.get("page")) || 1));
  const rows = await DB.all<{
    id: string;
    actor_label: string;
    actor_kind: string;
    action: string;
    resource_type: string;
    resource_id: string;
    metadata_json: string | null;
    created_at: string;
  }>(
    c.env,
    `SELECT id, actor_label, actor_kind, action, resource_type, resource_id, metadata_json, created_at
       FROM audit_logs WHERE business_id = ? ORDER BY created_at DESC LIMIT 50 OFFSET ?`,
    [actor.businessId, (page - 1) * 50],
  );
  return json({
    items: rows.map((row) => ({
      id: row.id,
      actor: row.actor_label,
      actorKind: row.actor_kind,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      metadata: parseJson<Record<string, unknown>>(row.metadata_json, {}),
      createdAt: row.created_at,
    })),
    page,
  });
}

export async function requestVerification(c: AppContext): Promise<Response> {
  const actor = await access(c, "profile:write");
  const input = await parseBody(verificationRequestInput, c.request);
  const business = await DB.first<{ verified_level: string }>(
    c.env,
    "SELECT verified_level FROM businesses WHERE id = ?",
    [actor.businessId],
  );
  if (!business) throw ApiError.notFound("Business not found.");
  const current =
    VERIFICATION_RANK[(business.verified_level ?? "unverified") as VerificationLevel] ?? 0;
  if (VERIFICATION_RANK[input.levelRequested] <= current) {
    throw ApiError.domain(`You already hold ${business.verified_level} verification.`);
  }
  const id = newId("ver");
  await DB.run(
    c.env,
    `INSERT INTO verification_requests (id, business_id, user_id, level_requested, document_media_id, note, status, submitted_at)
     VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      id,
      actor.businessId,
      c.session?.user.id ?? "",
      input.levelRequested,
      input.documentMediaId ?? null,
      input.note ?? null,
      nowIso(),
    ],
  );
  const config = await getConfig(c.env);
  await notifyBusinessOwners(c.env, actor.businessId, {
    kind: "verification_decision",
    title: "Verification request received",
    body: `We will review your ${input.levelRequested} documents within ${config.verification.slaHours}h.`,
    href: "/app/verification",
  });
  return json({ ok: true, id, slaHours: config.verification.slaHours }, { status: 201 });
}

export const verificationRequestInput = z.object({
  levelRequested: z.enum(["email", "phone", "documents", "premium"]),
  documentMediaId: z.string().min(3).max(40).optional(),
  note: z.string().trim().max(1000).optional(),
});

export async function verificationStatus(c: AppContext): Promise<Response> {
  const actor = await access(c, "profile:read");
  const rows = await DB.all<{
    id: string;
    level_requested: string;
    status: string;
    review_note: string | null;
    submitted_at: string;
    decided_at: string | null;
  }>(
    c.env,
    `SELECT id, level_requested, status, review_note, submitted_at, decided_at FROM verification_requests
      WHERE business_id = ? ORDER BY submitted_at DESC LIMIT 10`,
    [actor.businessId],
  );
  const claims = await DB.all<{
    id: string;
    status: string;
    submitted_at: string;
    review_note: string | null;
  }>(
    c.env,
    `SELECT id, status, submitted_at, review_note FROM claims WHERE business_id = ? ORDER BY submitted_at DESC LIMIT 5`,
    [actor.businessId],
  );
  return json({ requests: rows, claims });
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "object") return value as T;
  try {
    return JSON.parse(value as string) as T;
  } catch {
    return fallback;
  }
}
