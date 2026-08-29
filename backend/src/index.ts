import { Hono } from "hono";
import { cors } from "hono/cors";
import type { Env, Variables } from "./types";
import { sessionMiddleware } from "./auth";
import { authRoutes } from "./routes/auth";
import { publicRoutes } from "./routes/public";
import { workspaceRoutes } from "./routes/workspace";
import { adminRoutes } from "./routes/admin";
import { nowMs } from "./util";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// ------------------------------------------------------------------- CORS
app.use("/api/*", async (c, next) => {
  const origin = c.req.header("origin") ?? "";
  const allowed = (c.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  const isAllowed = allowed.includes(origin);
  if (c.req.method === "OPTIONS") {
    return new Response(null, {
      status: isAllowed ? 204 : 403,
      headers: isAllowed
        ? {
            "access-control-allow-origin": origin,
            "access-control-allow-credentials": "true",
            "access-control-allow-methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400",
            vary: "Origin",
          }
        : { vary: "Origin" },
    });
  }
  await next();
  if (isAllowed) {
    c.header("access-control-allow-origin", origin);
    c.header("access-control-allow-credentials", "true");
    c.header("vary", "Origin");
  }
});

app.use("/api/*", sessionMiddleware);

// ------------------------------------------------------------------ health
app.get("/api/health", (c) =>
  c.json({
    ok: true,
    service: "gainhub-api",
    time: new Date().toISOString(),
  }),
);

app.route("/api", authRoutes);
app.route("/api", publicRoutes);
app.route("/api/workspace", workspaceRoutes);
app.route("/api/admin", adminRoutes);

// ------------------------------------------------- tracked link redirects
// GET /l/:code → increments the scan counter and redirects to WhatsApp with
// attribution so businesses know exactly which link or QR started the chat.
app.get("/l/:code", async (c) => {
  const db = c.env.DB;
  const code = c.req.param("code");
  const row = await db
    .prepare(
      `SELECT l.id, l.label, l.scans, b.name AS business_name, b.whatsapp, b.id AS business_id
       FROM links l JOIN businesses b ON b.id = l.business_id WHERE l.code = ?1`,
    )
    .bind(code)
    .first<{
      id: string;
      label: string;
      scans: number;
      business_name: string;
      whatsapp: string;
      business_id: string;
    }>();
  if (!row) {
    return c.html(
      `<html><head><meta charset="utf-8"><title>Link not found — GainHub NG</title></head>
       <body style="font-family:sans-serif;display:grid;place-items:center;min-height:100vh;text-align:center">
       <div><h1>Link not found</h1><p>This GainHub contact link doesn't exist (yet).</p>
       <p><a href="/">Visit GainHub NG →</a></p></div></body></html>`,
      404,
    );
  }
  const digits = row.whatsapp.replace(/\D/g, "");
  const text = encodeURIComponent(
    `Hi ${row.business_name}! I found you via "${row.label}" on GainHub NG.`,
  );
  const target = `https://wa.me/${digits}?text=${text}`;
  await db.batch([
    db.prepare(`UPDATE links SET scans = scans + 1 WHERE id = ?1`).bind(row.id),
    db
      .prepare(
        `INSERT INTO events (business_id, type, source, created_at) VALUES (?1, 'contact', ?2, ?3)`,
      )
      .bind(row.business_id, `Link — ${row.label}`, nowMs()),
  ]);
  return c.redirect(target, 302);
});

// 404 for unknown API routes, JSON error envelope otherwise.
app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  const status =
    (err as { status?: number }).status && Number.isFinite((err as { status?: number }).status)
      ? Number((err as { status?: number }).status)
      : 500;
  if (status >= 500) console.error("[api]", err);
  return c.json({ error: err.message || "Something went wrong" }, { status: status as 500 });
});

export default app;
