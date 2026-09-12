import { createFileRoute } from "@tanstack/react-router";

function configuredOrigin(request: Request): string | null {
  const configured = process.env["VITE_SITE_URL"]?.trim();
  try {
    return new URL(configured || request.url).origin;
  } catch {
    return null;
  }
}

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const origin = configuredOrigin(request);
        const lines = [
          "User-agent: *",
          "Allow: /",
          "Disallow: /api/",
          "Disallow: /account",
          "Disallow: /app",
          "Disallow: /admin",
          ...(origin ? [`Sitemap: ${origin}/sitemap.xml`] : []),
          "",
        ];
        return new Response(lines.join("\n"), {
          headers: {
            "content-type": "text/plain; charset=utf-8",
            "cache-control": "public, max-age=300, s-maxage=3600",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
