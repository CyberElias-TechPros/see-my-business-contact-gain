import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";
import process from "node:process";

const port = Number(process.env.PORT ?? 4180);
const host = process.env.HOST ?? "127.0.0.1";
const staticRoot = resolve(".vercel/output/static");
const handler = (await import("../.vercel/output/functions/__server.func/index.mjs")).default;
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".woff2": "font/woff2",
};

function staticPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const candidate = resolve(staticRoot, normalize(decoded).replace(/^[/\\]+/, ""));
  if (candidate !== staticRoot && !candidate.startsWith(`${staticRoot}/`)) return null;
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return null;
  return candidate;
}

const server = createServer(async (incoming, outgoing) => {
  try {
    const origin = `http://${incoming.headers.host ?? `${host}:${port}`}`;
    const url = new URL(incoming.url ?? "/", origin);
    const asset = staticPath(url.pathname);
    if (asset) {
      outgoing.statusCode = 200;
      outgoing.setHeader("content-type", mimeTypes[extname(asset)] ?? "application/octet-stream");
      outgoing.setHeader(
        "cache-control",
        url.pathname.startsWith("/assets/")
          ? "public, max-age=31536000, immutable"
          : "public, max-age=300",
      );
      createReadStream(asset).pipe(outgoing);
      return;
    }

    const method = incoming.method ?? "GET";
    const chunks = [];
    for await (const chunk of incoming) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;
    const request = new Request(url, {
      method,
      headers: incoming.headers,
      body: method === "GET" || method === "HEAD" ? undefined : body,
      ...(body ? { duplex: "half" } : {}),
    });
    const response = await handler.fetch(request, { waitUntil: () => undefined });
    outgoing.statusCode = response.status;
    outgoing.statusMessage = response.statusText;
    for (const [name, value] of response.headers) outgoing.setHeader(name, value);
    if (typeof response.headers.getSetCookie === "function") {
      const cookies = response.headers.getSetCookie();
      if (cookies.length) outgoing.setHeader("set-cookie", cookies);
    }
    if (!response.body || method === "HEAD") {
      outgoing.end();
      return;
    }
    Readable.fromWeb(response.body).pipe(outgoing);
  } catch (error) {
    console.error(error);
    if (!outgoing.headersSent) {
      outgoing.statusCode = 500;
      outgoing.setHeader("content-type", "text/plain; charset=utf-8");
    }
    outgoing.end("Preview harness error");
  }
});

server.listen(port, host, () => {
  console.log(`Vercel output test harness listening on http://${host}:${port}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
