import { createFileRoute } from "@tanstack/react-router";
import { DirectoryUnavailableError, querySitemapFeed, queryTaxonomy } from "@/lib/directory.server";

const staticPaths = [
  "/",
  "/search",
  "/categories",
  "/locations",
  "/contact-gain",
  "/join",
  "/pricing",
  "/about",
  "/help",
  "/trust-safety",
  "/advertise",
  "/legal/privacy",
  "/legal/terms",
  "/legal/cookies",
];

type SitemapEntry = { path: string; lastModified?: string };

function configuredOrigin(request: Request): string | null {
  const configured = process.env["VITE_SITE_URL"]?.trim();
  try {
    const url = new URL(configured || request.url);
    if (process.env["NODE_ENV"] === "production" && url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (character) => {
    const entities: Record<string, string> = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      "'": "&apos;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

function sitemapEntry(path: string, updatedAt: string): SitemapEntry {
  const date = new Date(updatedAt);
  return Number.isNaN(date.valueOf()) ? { path } : { path, lastModified: date.toISOString() };
}

/**
 * Published listings and circles come from the Worker. A transient API failure
 * degrades the sitemap to its static and taxonomy URLs rather than failing the
 * route, so crawlers never see a 500.
 */
async function dynamicEntries(): Promise<SitemapEntry[]> {
  try {
    const [feed, taxonomy] = await Promise.all([querySitemapFeed(), queryTaxonomy()]);
    return [
      ...taxonomy.categories.map((category) => ({ path: `/category/${category.slug}` })),
      ...taxonomy.locations.map((location) => ({ path: `/locations/${location.slug}` })),
      ...feed.businesses.map((business) =>
        sitemapEntry(`/business/${encodeURIComponent(business.slug)}`, business.updated_at),
      ),
      ...feed.rooms.map((room) =>
        sitemapEntry(`/contact-gain/${encodeURIComponent(room.id)}`, room.updated_at),
      ),
    ];
  } catch (error) {
    if (!(error instanceof DirectoryUnavailableError)) console.error("[sitemap]", error);
    return [];
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = configuredOrigin(request);
        if (!origin) return new Response("Sitemap is not configured.", { status: 503 });
        const entries: SitemapEntry[] = [
          ...staticPaths.map((path) => ({ path })),
          ...(await dynamicEntries()),
        ];
        const body = [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...entries.map(
            ({ path, lastModified }) =>
              `  <url><loc>${escapeXml(`${origin}${path}`)}</loc>${lastModified ? `<lastmod>${lastModified}</lastmod>` : ""}</url>`,
          ),
          "</urlset>",
        ].join("\n");
        return new Response(body, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=300, s-maxage=3600",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
