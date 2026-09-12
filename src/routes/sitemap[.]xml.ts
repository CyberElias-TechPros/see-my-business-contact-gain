import { createFileRoute } from "@tanstack/react-router";
import { categories, locations } from "@/data/mock";
import type { ApiSuccess } from "@/lib/contracts";

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

type DynamicSitemap = {
  businesses: Array<{ slug: string; updated_at: string }>;
  rooms: Array<{ id: string; updated_at: string }>;
};

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

function apiOrigin(): URL | null {
  const configured = process.env["CLOUDFLARE_API_URL"]?.trim();
  try {
    return configured
      ? new URL(configured)
      : process.env["NODE_ENV"] === "production"
        ? null
        : new URL("http://127.0.0.1:8787");
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

async function dynamicEntries(): Promise<SitemapEntry[]> {
  const origin = apiOrigin();
  if (!origin) return [];
  try {
    const response = await fetch(new URL("/v1/sitemap", origin), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return [];
    const payload = (await response.json()) as ApiSuccess<DynamicSitemap>;
    return [
      ...payload.data.businesses.map((business) =>
        sitemapEntry(`/business/${encodeURIComponent(business.slug)}`, business.updated_at),
      ),
      ...payload.data.rooms.map((room) =>
        sitemapEntry(`/contact-gain/${encodeURIComponent(room.id)}`, room.updated_at),
      ),
    ];
  } catch {
    // Keep the static sitemap available during a transient API incident.
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
          ...categories.map((category) => ({ path: `/category/${category.slug}` })),
          ...locations.map((location) => ({ path: `/locations/${location.slug}` })),
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
