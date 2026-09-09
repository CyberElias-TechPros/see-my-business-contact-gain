import { DB } from "../db-access.ts";
import { newId, nowIso, today } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json } from "../http.ts";
import { sitemapData } from "./directory.ts";
import type { AppContext } from "../types.ts";

/**
 * QR / short-link hop. The click must be counted (that is the product), but the
 * redirect itself has to be fast and must never fail the visitor: every tracking
 * write is fire-and-forget, and an inactive link still lands on the profile
 * instead of a 404 for someone who scanned a printed flyer last month.
 */
export async function trackRedirect(c: AppContext): Promise<Response> {
  const code = (c.params["code"] ?? "").trim();
  if (!/^[A-Za-z0-9_-]{3,20}$/.test(code)) throw ApiError.notFound("That link no longer exists.");

  const link = await DB.first<{
    id: string;
    business_id: string;
    target_url: string | null;
    whatsapp_message: string | null;
    active: number;
    kind: string;
    business_slug: string;
    business_whatsapp: string | null;
  }>(
    c.env,
    `SELECT l.id, l.business_id, l.target_url, l.whatsapp_message, l.active, l.kind, b.slug AS business_slug, b.whatsapp AS business_whatsapp
       FROM links l JOIN businesses b ON b.id = l.business_id WHERE l.code = ?`,
    [code],
  );

  const fallback = `${(c.env.PUBLIC_URL ?? c.url.origin).replace(/\/$/, "")}/business/${link?.business_slug ?? ""}`;
  const destination = link?.target_url ?? fallback;

  if (!link) {
    // Unknown code: no row to attribute, so bounce to the directory rather than 404
    // a printed flyer. No write happens.
    return Response.redirect(fallback.replace(/\/business\/$/, "/search"), 302);
  }

  const kind = link.kind === "qr" ? "scan" : link.kind === "whatsapp" ? "chat" : "click";
  const now = nowIso();
  const day = today();
  c.execution.waitUntil(
    (async () => {
      await DB.write(c.env, [
        {
          sql: "INSERT INTO link_events (id, link_id, business_id, kind, day, created_at) VALUES (?, ?, ?, ?, ?, ?)",
          params: [newId("lev"), link.id, link.business_id, kind, day, now],
        },
        {
          sql: `UPDATE links SET clicks = clicks + ?, chats_started = chats_started + ?, scans = scans + ?, updated_at = ? WHERE id = ?`,
          params: [
            kind === "click" ? 1 : 0,
            kind === "chat" ? 1 : 0,
            kind === "scan" ? 1 : 0,
            now,
            link.id,
          ],
        },
        {
          sql: `INSERT INTO metrics_daily (business_id, day, views, enquiries, whatsapp_chats, leads, won_value_minor, updated_at)
                VALUES (?, ?, 0, 0, ?, 0, 0, ?)
                ON CONFLICT (business_id, day) DO UPDATE SET whatsapp_chats = whatsapp_chats + excluded.whatsapp_chats, updated_at = excluded.updated_at`,
          params: [link.business_id, day, kind === "chat" ? 1 : 0, now],
        },
      ]);
    })().catch((error: unknown) =>
      c.log("warn", "link_event_write_failed", { code, error: String(error) }),
    ),
  );

  // A deactivated link still redirects (flyers exist in the physical world) but the
  // owner sees it flagged as inactive in the console.
  const headers = new Headers({ location: destination });
  headers.set("cache-control", "no-store");
  headers.set("x-link-active", link.active === 1 ? "1" : "0");
  if (kind === "chat" && link.whatsapp_message && link.business_whatsapp) {
    // WhatsApp ignores unknown query params, so appending ?text= is safe and saves
    // the sender typing the pitch on the other side.
    const separator = destination.includes("?") ? "&" : "?";
    const url = new URL(destination);
    if (url.protocol === "https:" && !url.searchParams.has("text")) {
      headers.set(
        "location",
        `${destination}${separator}text=${encodeURIComponent(link.whatsapp_message)}`,
      );
    }
  }
  return new Response(null, { status: 302, headers });
}

export async function health(c: AppContext): Promise<Response> {
  const started = Date.now();
  let database = "ok";
  try {
    await DB.first<{ one: number }>(c.env, "SELECT 1 AS one");
  } catch {
    database = "error";
  }
  return json(
    {
      status: database === "ok" ? "healthy" : "degraded",
      database,
      latencyMs: Date.now() - started,
      env: c.env.APP_ENV ?? "unknown",
      time: nowIso(),
    },
    { status: database === "ok" ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}

export async function version(c: AppContext): Promise<Response> {
  return json(
    {
      name: "gainhub-api",
      // Injected at deploy time (`--var GIT_SHA:… --var APP_VERSION:…`) so an incident
      // report can name the exact build; "dev" whenever the vars are absent.
      build: c.env.GIT_SHA ?? "dev",
      version: c.env.APP_VERSION ?? "0.0.0-dev",
      contracts: { api: "/api/v1", schema: "shared/api.ts", rules: "shared/domain.ts" },
    },
    { headers: { "cache-control": "public, max-age=300" } },
  );
}

/**
 * XML sitemaps are served by the API so the frontend can stay static-cacheable.
 * Only published listings appear; `/api/v1/sitemap.xml` is referenced from robots.txt.
 */
export async function sitemapXml(c: AppContext): Promise<Response> {
  const data = await sitemapData(c);
  const origin = (c.env.PUBLIC_URL ?? c.url.origin).replace(/\/$/, "");
  // `sitemapData` already returns site-relative paths, so this only prefixes the
  // canonical origin: one source of truth for what is indexable.
  const urls: string[] = [
    entry(`${origin}/`, "daily", "1.0"),
    entry(`${origin}/search`, "daily", "0.9"),
    ...data.categories.map((category) => entry(`${origin}${category.path}`, "weekly", "0.7")),
    ...data.locations.map((location) => entry(`${origin}${location.path}`, "weekly", "0.7")),
    ...data.businesses.map((business) =>
      entry(`${origin}${business.path}`, "daily", "0.8", business.lastmod),
    ),
    ...data.rooms.map((room) => entry(`${origin}${room.path}`, "weekly", "0.6")),
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, {
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}

function entry(loc: string, changefreq: string, priority: string, lastmod?: string): string {
  const escaped = loc.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // `<lastmod>` is what makes Google's re-crawl schedule cheap instead of guesswork, so the
  // value `sitemapData` computes is passed through rather than dropped. Only a bare
  // W3C-date is emitted: a malformed lastmod makes a crawler reject the whole file.
  const mod = lastmod && /^\d{4}-\d{2}-\d{2}$/.test(lastmod) ? `<lastmod>${lastmod}</lastmod>` : "";
  return `  <url><loc>${escaped}</loc>${mod}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}
