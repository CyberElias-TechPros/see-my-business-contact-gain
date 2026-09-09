import {
  directoryQuery,
  type BusinessDetail,
  type BusinessSummary,
  type DirectoryQuery,
  type DirectoryResponse,
} from "../../../shared/api.ts";
import { waLink } from "../../../shared/domain.ts";
import { accessFor, findBusinessBySlugOrId } from "../auth.ts";
import { cachedJson } from "../cache.ts";
import { DB } from "../db-access.ts";
import { all, json as parseJsonArray, likeEscape, nowIso, where } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseQuery } from "../http.ts";
import {
  mapHours,
  mediaUrl,
  toSummary,
  type BusinessRow,
  type HoursRow,
  type MediaRow,
} from "../mappers.ts";
import type { AppContext } from "../types.ts";

export const BUSINESS_SELECT = `
  b.id, b.slug, b.owner_user_id, b.name, b.tagline, b.about,
  b.category_id, c.slug AS category_slug, c.name AS category_name,
  b.location_id, b.city, b.area, b.state, b.address, b.phone, b.whatsapp, b.website,
  b.socials_json, b.amenities_json, b.service_areas_json, b.verified_level, b.plan, b.status,
  b.response_minutes, b.rating_avg, b.rating_count, b.contacts_gained, b.view_count,
  b.saved_count, b.enquiry_count, b.profile_complete, b.is_featured, b.published_at, b.created_at`;

const SORT_SQL: Record<string, string> = {
  // Relevance: quality × proof of demand, then verification, then paid placement.
  relevance: `(b.is_featured * 1000) +
     (CASE b.verified_level WHEN 'premium' THEN 40 WHEN 'documents' THEN 30 WHEN 'phone' THEN 20 WHEN 'email' THEN 10 ELSE 0 END) +
     (b.rating_avg * (b.rating_count * 1.0 / (b.rating_count + 20.0)) * 12) +
     MIN(20.0, b.contacts_gained * 1.0 / 250) DESC`,
  rating: "b.rating_avg DESC, b.rating_count DESC",
  reviews: "b.rating_count DESC, b.rating_avg DESC",
  newest: "COALESCE(b.published_at, b.created_at) DESC",
  response: "b.response_minutes IS NULL, b.response_minutes ASC",
};

type CountedRow = { slug: string; name: string; n: number };

export async function listCategories(c: AppContext): Promise<Response> {
  return json(
    await cachedJson(
      c.env,
      "categories:v1",
      async () => {
        const rows = await DB.all<{
          id: string;
          slug: string;
          name: string;
          icon: string;
          description: string;
          checklist_json: string | null;
          required_media_json: string | null;
          published: number;
        }>(
          c.env,
          `SELECT cat.id, cat.slug, cat.name, cat.icon, cat.description, cat.checklist_json, cat.required_media_json,
                (SELECT COUNT(*) FROM businesses b WHERE b.category_id = cat.id AND b.status = 'published') AS published
           FROM categories cat WHERE cat.is_active = 1 ORDER BY cat.sort, cat.name`,
        );
        return {
          items: rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            name: row.name,
            icon: row.icon,
            description: row.description,
            count: Number(row.published ?? 0),
            checklist: parseJsonArray<string[]>(row.checklist_json, []),
            requiredMedia: parseJsonArray<string[]>(row.required_media_json, []),
          })),
        };
      },
      { ttlSeconds: 300 },
    ),
  );
}

export async function listLocations(c: AppContext): Promise<Response> {
  return json(
    await cachedJson(
      c.env,
      "locations:v1",
      async () => {
        const rows = await DB.all<{
          id: string;
          slug: string;
          name: string;
          state: string;
          areas_json: string | null;
          published: number;
        }>(
          c.env,
          `SELECT l.id, l.slug, l.name, l.state, l.areas_json,
                (SELECT COUNT(*) FROM businesses b WHERE b.location_id = l.id AND b.status = 'published') AS published
           FROM locations l ORDER BY l.sort, l.name`,
        );
        return {
          items: rows.map((row) => ({
            id: row.id,
            slug: row.slug,
            name: row.name,
            state: row.state,
            areas: parseJsonArray<string[]>(row.areas_json, []),
            count: Number(row.published ?? 0),
          })),
        };
      },
      { ttlSeconds: 300 },
    ),
  );
}

export async function searchBusinesses(c: AppContext): Promise<Response> {
  const query = parseQuery(directoryQuery, c.url);
  const response = await runSearch(c, query);
  return json(response, {
    headers: { "cache-control": "public, max-age=25, stale-while-revalidate=120" },
  });
}

/** Shared by /search, category and location landing pages so filtering can never diverge. */
export async function runSearch(c: AppContext, query: DirectoryQuery): Promise<DirectoryResponse> {
  const term = (query.q ?? "").trim();
  const wantsSearchJoin = term.length >= 2;

  const from = `FROM businesses b
      JOIN categories c ON c.id = b.category_id
      LEFT JOIN locations l ON l.id = b.location_id
      ${wantsSearchJoin ? "JOIN business_search_index si ON si.business_id = b.id" : ""}`;

  const clause = where([
    `b.status = 'published'`,
    wantsSearchJoin
      ? { sql: `si.search_text LIKE ? ESCAPE '\\'`, params: [`%${likeEscape(term)}%`] }
      : null,
    query.category ? { sql: "c.slug = ?", params: [query.category.toLowerCase()] } : null,
    query.location
      ? {
          sql: "(lower(l.slug) = ? OR lower(b.state) = ? OR lower(b.city) = ?)",
          params: [
            query.location.toLowerCase(),
            query.location.toLowerCase(),
            query.location.toLowerCase(),
          ],
        }
      : null,
    query.area ? { sql: "lower(b.area) = ?", params: [query.area.toLowerCase()] } : null,
    query.verified ? "b.verified_level <> 'unverified'" : null,
    query.minRating && query.minRating > 0
      ? { sql: "b.rating_avg >= ?", params: [query.minRating] }
      : null,
    query.amenity
      ? { sql: "lower(b.amenities_json) LIKE ?", params: [`%${likeEscape(query.amenity)}%`] }
      : null,
  ]);
  const whereSql = clause.sql.replace(/^WHERE /, "");

  const total = await DB.count(
    c.env,
    `SELECT COUNT(*) AS n ${from} WHERE ${whereSql}`,
    clause.params,
  );

  const orderBy = SORT_SQL[query.sort] ?? SORT_SQL["relevance"]!;
  const rows = await DB.all<BusinessRow>(
    c.env,
    `SELECT ${BUSINESS_SELECT} ${from} WHERE ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...clause.params, query.perPage, (query.page - 1) * query.perPage],
  );

  // Hours and media are fetched for the current page only: two queries, never N+1.
  const ids = rows.map((row) => row.id);
  const hoursById = new Map<string, HoursRow[]>();
  const mediaById = new Map<string, MediaRow[]>();
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const [hours, media] = await Promise.all([
      all<HoursRow>(
        c.env.DB,
        `SELECT business_id, day_of_week, opens, closes, closed FROM business_hours WHERE business_id IN (${placeholders})`,
        ids,
      ),
      all<MediaRow & { business_id: string }>(
        c.env.DB,
        `SELECT id, business_id, kind, label, alt, content_type, moderation_status, is_primary, width, height, position
           FROM media WHERE business_id IN (${placeholders}) AND deleted_at IS NULL AND moderation_status = 'approved'
          ORDER BY position`,
        ids,
      ),
    ]);
    for (const row of hours) {
      const list = hoursById.get(row.business_id) ?? [];
      list.push(row);
      hoursById.set(row.business_id, list);
    }
    for (const row of media) {
      const list = mediaById.get(row.business_id) ?? [];
      const { business_id: _drop, ...rest } = row;
      list.push(rest as MediaRow);
      mediaById.set(row.business_id, list);
    }
  }

  let items: BusinessSummary[] = rows.map((row) =>
    toSummary(
      row,
      hoursById.get(row.id),
      c.env.API_URL ?? c.url.origin,
      mediaById.get(row.id) ?? [],
    ),
  );
  // "Open now" is time-derived, so it is filtered after SQL rather than in a
  // hand-rolled SQLite time expression that would ignore Nigeria's single TZ.
  if (query.openNow) items = items.filter((item) => item.openNow);

  const facets = await buildFacets(c, from, whereSql, clause.params);

  return {
    items,
    meta: {
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    },
    facets: { ...facets, applied: stripDefaultQuery(query) },
    ambiguousQuery: term.length > 0 && term.length < 2,
  };
}

function stripDefaultQuery(query: DirectoryQuery): Partial<DirectoryQuery> {
  const applied: Record<string, unknown> = {};
  if (query.q) applied["q"] = query.q;
  if (query.category) applied["category"] = query.category;
  if (query.location) applied["location"] = query.location;
  if (query.area) applied["area"] = query.area;
  if (query.verified) applied["verified"] = true;
  if (query.openNow) applied["openNow"] = true;
  if (query.minRating) applied["minRating"] = query.minRating;
  if (query.sort !== "relevance") applied["sort"] = query.sort;
  return applied;
}

async function buildFacets(
  c: AppContext,
  from: string,
  whereSql: string,
  params: unknown[],
): Promise<DirectoryResponse["facets"]> {
  const [categories, locations] = await Promise.all([
    DB.all<CountedRow>(
      c.env,
      `SELECT c.slug, c.name, COUNT(*) AS n ${from} WHERE ${whereSql} GROUP BY c.slug, c.name ORDER BY n DESC LIMIT 12`,
      params,
    ),
    DB.all<CountedRow>(
      c.env,
      `SELECT l.slug, l.name, COUNT(*) AS n ${from} WHERE ${whereSql} AND l.slug IS NOT NULL GROUP BY l.slug, l.name ORDER BY n DESC LIMIT 8`,
      params,
    ),
  ]);
  return {
    categories: categories.map((row) => ({ slug: row.slug, name: row.name, count: Number(row.n) })),
    locations: locations.map((row) => ({ slug: row.slug, name: row.name, count: Number(row.n) })),
    applied: {},
  };
}

export async function getBusiness(c: AppContext): Promise<Response> {
  const ref = c.params["idOrSlug"] ?? "";
  const viewer = await resolveViewerAccess(c);
  const row = await DB.first<BusinessRow>(
    c.env,
    `SELECT ${BUSINESS_SELECT} FROM businesses b
       JOIN categories c ON c.id = b.category_id
       LEFT JOIN locations l ON l.id = b.location_id
      WHERE (b.id = ? OR b.slug = ?)`,
    [ref, ref],
  );
  if (!row || (row.status !== "published" && !viewer))
    throw ApiError.notFound("That business profile does not exist.");

  const isStaff = viewer !== null;
  const [hours, media, services, products, ratings, team] = await Promise.all([
    all<HoursRow>(
      c.env.DB,
      "SELECT business_id, day_of_week, opens, closes, closed FROM business_hours WHERE business_id = ? ORDER BY day_of_week",
      [row.id],
    ),
    all<MediaRow & { moderation_visible: number }>(
      c.env.DB,
      `SELECT id, kind, label, alt, content_type, moderation_status, is_primary, width, height, position,
              CASE WHEN ? = 1 OR moderation_status = 'approved' THEN 1 ELSE 0 END AS moderation_visible
         FROM media WHERE business_id = ? AND deleted_at IS NULL AND kind <> 'document'
        ORDER BY position, created_at`,
      [isStaff ? 1 : 0, row.id],
    ),
    all<{ id: string; name: string; price_minor: number | null; note: string | null }>(
      c.env.DB,
      "SELECT id, name, price_minor, note FROM services WHERE business_id = ? AND active = 1 ORDER BY position, name",
      [row.id],
    ),
    all<{ id: string; name: string; price_minor: number | null; tag: string | null }>(
      c.env.DB,
      "SELECT id, name, price_minor, tag FROM products WHERE business_id = ? AND active = 1 ORDER BY position, name",
      [row.id],
    ),
    all<{ rating: number }>(
      c.env.DB,
      "SELECT rating FROM reviews WHERE business_id = ? AND status = 'published'",
      [row.id],
    ),
    all<{ id: string; name: string; role: string }>(
      c.env.DB,
      `SELECT u.id, COALESCE(u.display_name, 'Team member') AS name, m.role
         FROM memberships m JOIN users u ON u.id = m.user_id
        WHERE m.business_id = ? AND m.status = 'active' AND m.role IN ('owner','manager')
        ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END LIMIT 4`,
      [row.id],
    ),
  ]);

  const visibleMedia = media.filter((m) => m.moderation_visible === 1);
  const apiBase = c.env.API_URL ?? c.url.origin;
  const saved = c.session
    ? Boolean(
        await DB.first<{ business_id: string }>(
          c.env,
          "SELECT business_id FROM saves WHERE user_id = ? AND business_id = ?",
          [c.session.user.id, row.id],
        ),
      )
    : false;

  const byStar: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  for (const rating of ratings)
    byStar[String(rating.rating)] = (byStar[String(rating.rating)] ?? 0) + 1;

  const detail: BusinessDetail = {
    ...toSummary(row, hours, apiBase, visibleMedia),
    ownerId: row.owner_user_id,
    about: row.about,
    phone: row.phone,
    website: row.website,
    socials: parseJsonArray<{ label: string; handle: string; url: string | null }[]>(
      row.socials_json,
      [],
    ),
    address: row.address,
    serviceAreas: parseJsonArray<string[]>(row.service_areas_json, []),
    hours: mapHours(hours),
    services: services.map((s) => ({
      id: s.id,
      name: s.name,
      priceMinor: s.price_minor,
      note: s.note,
    })),
    products: products.map((p) => ({
      id: p.id,
      name: p.name,
      priceMinor: p.price_minor,
      tag: p.tag,
    })),
    media: visibleMedia.map((m) => ({
      id: m.id,
      kind: m.kind,
      label: m.label,
      alt: m.alt || `${row.name} — ${m.kind}`,
      url: mediaUrl(m.id, apiBase),
      moderation: m.moderation_status,
    })),
    team: team.map((t) => ({ id: t.id, name: t.name, role: t.role })),
    claims: { total: ratings.length, avg: Number(row.rating_avg ?? 0), byStar },
    publishedAt: row.published_at,
    savedByViewer: saved,
  };

  // View counting stays off the response path: KV counter, flushed to D1 by cron.
  c.execution.waitUntil(bumpViews(c, row.id));

  return json(
    { business: detail, viewer: { canManage: isStaff, role: viewer?.role ?? null } },
    { headers: { "cache-control": "public, max-age=30, stale-while-revalidate=300" } },
  );
}

async function bumpViews(c: AppContext, businessId: string): Promise<void> {
  try {
    const key = `views:${businessId}`;
    const current = Number((await c.env.KV.get(key)) ?? 0) || 0;
    await c.env.KV.put(key, String(current + 1), { expirationTtl: 86_400 });
  } catch {
    // A lost view count must never surface as a user-visible error.
  }
}

async function resolveViewerAccess(c: AppContext) {
  if (!c.session) return null;
  const business = await findBusinessBySlugOrId(c.env, c.params["idOrSlug"] ?? "");
  if (!business) return null;
  return accessFor(c, business);
}

export async function similarBusinesses(c: AppContext): Promise<Response> {
  const ref = c.params["idOrSlug"] ?? "";
  const anchor = await DB.first<{ id: string; category_id: string; city: string }>(
    c.env,
    "SELECT id, category_id, city FROM businesses WHERE id = ? OR slug = ?",
    [ref, ref],
  );
  if (!anchor) throw ApiError.notFound("Business not found.");
  const rows = await DB.all<BusinessRow>(
    c.env,
    `SELECT ${BUSINESS_SELECT} FROM businesses b JOIN categories c ON c.id = b.category_id
      WHERE b.status = 'published' AND b.id <> ? AND b.category_id = ?
      ORDER BY (b.city = ?) DESC, b.rating_avg DESC, b.rating_count DESC LIMIT 4`,
    [anchor.id, anchor.category_id, anchor.city],
  );
  const items = rows.map((row) => toSummary(row, undefined, c.env.API_URL ?? c.url.origin, []));
  return json({ items });
}

export async function listReviews(c: AppContext): Promise<Response> {
  const ref = c.params["idOrSlug"] ?? "";
  const business = await DB.first<{ id: string }>(
    c.env,
    "SELECT id FROM businesses WHERE id = ? OR slug = ?",
    [ref, ref],
  );
  if (!business) throw ApiError.notFound("Business not found.");
  const page = Math.min(500, Math.max(1, Number(c.url.searchParams.get("page")) || 1));
  const perPage = Math.min(50, Math.max(5, Number(c.url.searchParams.get("perPage")) || 10));
  const [rows, total] = await Promise.all([
    DB.all<{
      id: string;
      rating: number;
      body: string;
      created_at: string;
      display_name: string;
      show_name: number;
      owner_reply: string | null;
      owner_reply_at: string | null;
    }>(
      c.env,
      `SELECT r.id, r.rating, r.body, r.created_at, r.owner_reply, r.owner_reply_at,
              u.display_name, u.show_name_on_reviews AS show_name
         FROM reviews r JOIN users u ON u.id = r.author_user_id
        WHERE r.business_id = ? AND r.status = 'published'
        ORDER BY r.created_at DESC LIMIT ? OFFSET ?`,
      [business.id, perPage, (page - 1) * perPage],
    ),
    DB.count(
      c.env,
      "SELECT COUNT(*) AS n FROM reviews WHERE business_id = ? AND status = 'published'",
      [business.id],
    ),
  ]);
  return json({
    items: rows.map((row) => ({
      id: row.id,
      rating: row.rating,
      body: row.body,
      author: row.show_name === 1 ? displayName(row.display_name) : "A GainHub user",
      createdAt: row.created_at,
      ownerReply: row.owner_reply,
      ownerReplyAt: row.owner_reply_at,
    })),
    meta: { page, perPage, total, totalPages: Math.max(1, Math.ceil(total / perPage)) },
  });
}

/** Review authors see a first name + initial, never a full account name. */
export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "GainHub user";
  if (parts.length === 1) return parts[0]!;
  return `${parts[0]} ${parts[parts.length - 1]!.slice(0, 1).toUpperCase()}.`;
}

/** Homepage proof strip: real, aggregate, PII-free activity signals. */
export async function platformActivity(c: AppContext): Promise<Response> {
  return json(
    await cachedJson(
      c.env,
      "activity:v1",
      async () => {
        const totals = await DB.first<{
          businesses: number;
          chats: number;
          reviews: number;
          states: number;
        }>(
          c.env,
          `SELECT
            (SELECT COUNT(*) FROM businesses WHERE status = 'published') AS businesses,
            (SELECT COALESCE(SUM(contacts_gained), 0) FROM businesses) AS chats,
            (SELECT COUNT(*) FROM reviews WHERE status = 'published') AS reviews,
            (SELECT COUNT(DISTINCT state) FROM businesses WHERE status = 'published') AS states`,
        );
        const recent = await DB.all<{ business: string; at: string; rating: number }>(
          c.env,
          `SELECT b.name AS business, r.created_at AS at, r.rating
           FROM reviews r JOIN businesses b ON b.id = r.business_id
          WHERE r.status = 'published' ORDER BY r.created_at DESC LIMIT 6`,
        );
        return {
          totals: {
            businesses: Number(totals?.businesses ?? 0),
            chatsStarted: Number(totals?.chats ?? 0),
            reviews: Number(totals?.reviews ?? 0),
            states: Number(totals?.states ?? 0),
          },
          recent: recent.map((row) => ({
            id: `${row.business}-${row.at}`,
            label: row.business,
            action: `${row.rating}★ review`,
            at: row.at,
          })),
        };
      },
      { ttlSeconds: 120 },
    ),
  );
}

export type SitemapPayload = {
  businesses: { path: string; lastmod: string }[];
  categories: { path: string }[];
  locations: { path: string }[];
  rooms: { path: string }[];
  generatedAt: string;
};

/** Feed for the frontend's /sitemap.xml — only canonical, indexable URLs. */
export async function sitemapData(c: AppContext): Promise<SitemapPayload> {
  return cachedJson<SitemapPayload>(
    c.env,
    "sitemap:v1",
    async () => {
      const [businesses, categories, locations, rooms] = await Promise.all([
        DB.all<{ slug: string; updated_at: string }>(
          c.env,
          `SELECT slug, updated_at FROM businesses WHERE status = 'published'
            ORDER BY updated_at DESC LIMIT 5000`,
        ),
        DB.all<{ slug: string }>(c.env, "SELECT slug FROM categories WHERE is_active = 1"),
        DB.all<{ slug: string }>(c.env, "SELECT slug FROM locations"),
        DB.all<{ slug: string }>(c.env, "SELECT slug FROM rooms WHERE status = 'active'"),
      ]);
      return {
        businesses: businesses.map((b) => ({
          path: `/business/${b.slug}`,
          lastmod: b.updated_at.slice(0, 10),
        })),
        categories: categories.map((x) => ({ path: `/category/${x.slug}` })),
        locations: locations.map((x) => ({ path: `/locations/${x.slug}` })),
        rooms: rooms.map((x) => ({ path: `/contact-gain/${x.slug}` })),
        generatedAt: nowIso(),
      };
    },
    { ttlSeconds: 600 },
  );
}

export function whatsappLinkFor(phone: string | null): string | null {
  return phone ? waLink(phone) : null;
}

/** JSON view of the same payload, for the sitemap inspector in the admin console. */
export async function sitemapJson(c: AppContext): Promise<Response> {
  return json(await sitemapData(c), { headers: { "cache-control": "public, max-age=600" } });
}
