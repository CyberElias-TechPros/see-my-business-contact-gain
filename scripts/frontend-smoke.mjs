import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const workerPort = Number(process.env.SMOKE_WORKER_PORT ?? 8810);
const webPort = Number(process.env.SMOKE_WEB_PORT ?? 4180);
const workerBase = `http://127.0.0.1:${workerPort}`;
const webBase = `http://127.0.0.1:${webPort}`;
const canonicalOrigin = process.env.VITE_SITE_URL ?? "https://smoke.gainhub.test";
const proxySecret = "smoke-proxy-key-2026-09-12-abcdef0123456789";
const wranglerCli = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
const vercelHarness = fileURLToPath(new URL("./serve-vercel-output.mjs", import.meta.url));
const children = [];
let checks = 0;
let logs = "";

function start(label, executable, args, env = {}) {
  const child = spawn(executable, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  for (const stream of [child.stdout, child.stderr]) {
    stream.setEncoding("utf8");
    stream.on("data", (chunk) => {
      logs = `${logs}\n[${label}] ${chunk}`.slice(-16_000);
    });
  }
  return child;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitFor(url, child, label) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null)
      throw new Error(`${label} exited early (${child.exitCode}).${logs}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Service is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}.${logs}`);
}

async function page(path, expected = 200) {
  const response = await fetch(`${webBase}${path}`, { redirect: "manual" });
  const text = await response.text();
  assert(
    response.status === expected,
    `${path}: expected ${expected}, got ${response.status}\n${text.slice(0, 500)}`,
  );
  checks += 1;
  return { response, text };
}

const worker = start(
  "worker",
  process.execPath,
  [
    wranglerCli,
    "dev",
    "--config",
    "wrangler.jsonc",
    "--env=",
    "--port",
    String(workerPort),
    "--ip",
    "127.0.0.1",
    "--var",
    "APP_ENV:development",
    "--var",
    "ALLOWED_ORIGINS:http://127.0.0.1:4180",
    "--var",
    `PROXY_SHARED_SECRET:${proxySecret}`,
  ],
  { WRANGLER_SEND_METRICS: "false" },
);

try {
  await waitFor(`${workerBase}/health`, worker, "Worker");
  const forgedProxy = await fetch(`${workerBase}/health`, {
    headers: { "x-gainhub-proxy-secret": "not-the-shared-secret" },
  });
  const forgedPayload = await forgedProxy.json();
  assert(
    forgedProxy.status === 403 && forgedPayload.error.code === "INVALID_PROXY_AUTH",
    "Worker accepted an invalid proxy credential",
  );
  checks += 1;

  const web = start("web", process.execPath, [vercelHarness], {
    HOST: "127.0.0.1",
    PORT: String(webPort),
    CLOUDFLARE_API_URL: workerBase,
    CLOUDFLARE_PROXY_SECRET: proxySecret,
    VITE_SITE_URL: canonicalOrigin,
    VITE_LEGAL_OPERATOR_NAME: process.env.VITE_LEGAL_OPERATOR_NAME ?? "Smoke Test Operator Ltd",
    VITE_PRIVACY_EMAIL: process.env.VITE_PRIVACY_EMAIL ?? "privacy@smoke.gainhub.test",
    VITE_SUPPORT_EMAIL: process.env.VITE_SUPPORT_EMAIL ?? "support@smoke.gainhub.test",
    VITE_GOVERNING_LAW:
      process.env.VITE_GOVERNING_LAW ?? "the laws used for this automated smoke test",
    VITE_DISPUTE_FORUM: process.env.VITE_DISPUTE_FORUM ?? "the automated smoke-test forum",
    NODE_ENV: "production",
  });
  await waitFor(webBase, web, "Vercel-target preview");

  let result = await page("/");
  assert(result.text.includes("Find better."), "Home page hero was not server-rendered");
  assert(
    result.text.includes(`rel=\"canonical\" href=\"${canonicalOrigin}/\"`),
    "Canonical home URL is missing",
  );
  assert(result.text.includes("/og-card.png"), "Open Graph image metadata is missing");
  assert(result.text.includes("Skip to main content"), "Keyboard skip link is missing");
  const entryAsset = result.text.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
  assert(entryAsset, "No client entry asset was linked from the rendered document");
  const assetResponse = await fetch(`${webBase}${entryAsset}`);
  assert(assetResponse.ok, "Linked client entry asset could not be loaded");
  assert(
    assetResponse.headers.get("cache-control")?.includes("immutable"),
    "Hashed client asset is missing immutable caching",
  );
  checks += 1;

  for (const route of [
    "/about",
    "/advertise",
    "/auth",
    "/categories",
    "/claim",
    "/compare",
    "/contact-gain",
    "/contact-gain/create",
    "/help",
    "/join",
    "/legal/cookies",
    "/legal/data-request",
    "/legal/terms",
    "/locations",
    "/pricing",
    "/report",
    "/suggest-business",
    "/trust-safety",
    "/account",
    "/app",
    "/admin",
  ]) {
    const rendered = await page(route);
    assert(rendered.text.includes("<!DOCTYPE html>"), `${route}: no HTML document was rendered`);
    assert(
      !rendered.text.includes("INTERNAL_ERROR"),
      `${route}: internal error leaked into the page`,
    );
    if (["/account", "/app", "/admin"].includes(route)) {
      assert(
        rendered.text.includes('content="noindex, nofollow"'),
        `${route}: private route is indexable`,
      );
    }
  }

  result = await page("/search?q=demo");
  assert(
    result.text.includes("SwiftFix Lab — demo"),
    "Live directory results were not server-rendered",
  );
  assert(
    !result.text.includes("The live directory is temporarily unavailable"),
    "Directory unexpectedly entered unavailable state",
  );

  result = await page("/business/demo-swiftfix");
  assert(result.text.includes("Screen replacement"), "Live business services were not rendered");
  assert(
    result.text.includes('"@type":"LocalBusiness"'),
    "LocalBusiness structured data is missing",
  );

  result = await page("/category/phone-gadgets");
  assert(
    result.text.includes("SwiftFix Lab — demo"),
    "Category landing page did not use live directory data",
  );

  result = await page("/locations/lagos");
  assert(
    result.text.includes("Mama Ope Kitchen — demo"),
    "Location landing page did not use live directory data",
  );

  result = await page("/legal/terms");
  assert(
    result.text.includes("the laws used for this automated smoke test") &&
      result.text.includes("the automated smoke-test forum"),
    "Configured governing-law or dispute-forum wording is not shown",
  );

  result = await page("/legal/privacy");
  assert(result.text.includes("Smoke Test Operator Ltd"), "Configured legal operator is not shown");
  assert(
    result.text.includes("privacy@smoke.gainhub.test"),
    "Configured privacy contact is not shown",
  );

  result = await page("/robots.txt");
  assert(
    result.response.headers.get("content-type")?.startsWith("text/plain"),
    "robots.txt has the wrong content type",
  );
  assert(
    result.text.includes(`Sitemap: ${canonicalOrigin}/sitemap.xml`),
    "robots.txt has no configured sitemap URL",
  );

  result = await page("/sitemap.xml");
  assert(
    result.response.headers.get("content-type")?.startsWith("application/xml"),
    "Sitemap has the wrong content type",
  );
  assert(
    result.text.includes(`${canonicalOrigin}/category/phone-gadgets`),
    "Taxonomy URLs are missing from sitemap",
  );
  assert(
    result.text.includes(`${canonicalOrigin}/business/demo-swiftfix`) &&
      result.text.includes("<lastmod>"),
    "Published business URLs are missing from sitemap",
  );
  assert(!result.text.includes("/account"), "Private URLs leaked into sitemap");

  result = await page("/definitely-not-a-route", 404);
  assert(result.text.includes("Not on the map."), "Custom not-found experience was not rendered");
  assert(result.text.includes('content="noindex, nofollow"'), "Not-found response is indexable");

  let response = await fetch(`${webBase}/api/health`);
  let payload = await response.json();
  assert(
    response.status === 200 && payload.data.status === "ok",
    "Same-origin API health proxy failed",
  );
  assert(
    response.headers.get("x-gainhub-proxy") === "vercel-edge",
    "Proxy provenance header is missing",
  );
  checks += 1;

  const email = `proxy-${Date.now()}@example.com`;
  const phone = `081${String(Date.now()).slice(-8)}`;
  response = await fetch(`${webBase}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      Origin: webBase,
      "Content-Type": "application/json",
      "X-GainHub-Intent": "web",
    },
    body: JSON.stringify({
      fullName: "Proxy Smoke User",
      email,
      phone,
      password: "A-long-proxy-passphrase-2026",
      acceptedTerms: true,
    }),
  });
  payload = await response.json();
  assert(
    response.status === 201 && payload.data.user.email === email,
    "Registration through proxy failed",
  );
  const setCookie = response.headers.get("set-cookie") ?? "";
  assert(
    setCookie.includes("__Host-gh_session=") && setCookie.includes("HttpOnly"),
    "Proxy dropped the secure session cookie",
  );
  const cookie = setCookie.split(";", 1)[0];
  checks += 1;

  response = await fetch(`${webBase}/api/v1/auth/session`, { headers: { Cookie: cookie } });
  payload = await response.json();
  assert(
    response.status === 200 && payload.data.user.email === email,
    "Session cookie did not round-trip through proxy",
  );
  checks += 1;

  response = await fetch(`${webBase}/api/v1/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie, Origin: webBase, "X-GainHub-Intent": "web" },
  });
  payload = await response.json();
  assert(response.ok && payload.data.signedOut === true, "Logout through proxy failed");
  checks += 1;

  worker.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => worker.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  response = await fetch(`${webBase}/api/health`);
  payload = await response.json();
  assert(
    response.status === 503 && payload.error.code === "API_UNAVAILABLE",
    "Proxy did not return structured API outage state",
  );
  assert(response.headers.get("retry-after") === "5", "Outage response has no retry guidance");
  checks += 1;

  console.log(`Frontend and same-origin proxy smoke test passed (${checks} HTTP checks).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("\nProcess log tail:\n", logs);
  process.exitCode = 1;
} finally {
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGTERM");
  }
  await Promise.race([
    Promise.all(
      children.map((child) =>
        child.exitCode === null
          ? new Promise((resolve) => child.once("exit", resolve))
          : Promise.resolve(),
      ),
    ),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  for (const child of children) {
    if (child.exitCode === null) child.kill("SIGKILL");
  }
}
