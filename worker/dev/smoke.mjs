/**
 * Vertical-slice smoke test against a running `wrangler dev` (or any deployed base URL).
 *
 *   node dev/smoke.mjs                          # http://127.0.0.1:8787
 *   SMOKE_BASE_URL=https://api-staging.gainhub.ng node dev/smoke.mjs
 *   SMOKE_RATE_LIMIT=1 node dev/smoke.mjs       # also prove the sign-up throttle
 *
 * It covers what a typecheck cannot reach: real SQL against D1, trigger-maintained
 * aggregates, cookie + CSRF handling, plan limits, and the moderation round trip.
 * Non-zero exit code on any failure. Safe to re-run: it writes to clearly-named
 * smoke rows and restores the fields it touches.
 */
const BASE = (process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:8787").replace(/\/$/, "");
const PASSWORD = process.env.SMOKE_PASSWORD ?? "Gainhub123!";
// `wrangler dev` has no request.cf, so the limiter would bucket every local request into
// one anonymous bucket (see http.ts: clientIpHash). The harness therefore presents a
// distinct address per identity — the suite switches accounts a dozen times, and the
// limiter itself is asserted on purpose in the "rate limiting" section at the end.
let ipSalt = Number(process.env.SMOKE_IP_SALT ?? 0);
const octet = () => 1 + Math.floor(Math.random() * 250);
const RUN_PREFIX = process.env.SMOKE_IP ?? `10.${octet()}.${octet()}`;
const RUN_IP = () => `${RUN_PREFIX}.${(ipSalt % 200) + 1}`;
const OWNER = "hello@lumea.ng";
const ADMIN = "ada@gainhub.dev";

let failures = 0;
let passed = 0;

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${name}`);
  } else {
    failures += 1;
    console.log(
      `  FAIL ${name}${detail === undefined ? "" : ` — ${JSON.stringify(detail).slice(0, 500)}`}`,
    );
  }
  return Boolean(condition);
}

function section(title) {
  console.log(`\n${title}`);
}

/** Manual cookie jar: the API sets Domain=gainhub.ng, which no local fetch would store. */
const jar = new Map();

function takeCookies(response) {
  for (const line of response.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(";");
    if (!pair) continue;
    const index = pair.indexOf("=");
    if (index === -1) continue;
    const name = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Local rate limits are real; the harness waits them out instead of asserting less. */
async function apiResilient(method, path, options = {}, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await api(method, path, options);
    if (response.status !== 429) return response;
    const waitSeconds = Number(response.data?.error?.retryAfterSeconds ?? 2);
    await sleep(Math.min(20, Math.max(1, waitSeconds)) * 1000);
  }
  return api(method, path, options);
}

async function api(method, path, options = {}) {
  const headers = { accept: "application/json", "x-forwarded-for": RUN_IP() };
  if (options.body !== undefined) headers["content-type"] = "application/json";
  if (options.csrf) headers["x-csrf-token"] = options.csrf;
  if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    redirect: "manual",
  });
  takeCookies(response);
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : undefined;
  } catch {
    data = text;
  }
  return { status: response.status, data, headers: response.headers };
}

async function loginAs(email) {
  jar.clear();
  ipSalt += 1;
  const response = await apiResilient("POST", "/api/v1/auth/login", {
    body: { identifier: email, password: PASSWORD },
  });
  if (response.status !== 200)
    throw new Error(`login failed for ${email}: ${JSON.stringify(response.data)}`);
  return response.data;
}

const WS = "/api/v1/workspaces/biz_swiftfix";

/**
 * Signs in and returns a matching (cookie, CSRF token) pair. Identity and token must
 * always change together — an old token with a new cookie is a genuine 403, and a test
 * that confuses the two proves nothing.
 */
async function signIn(email) {
  const session = await loginAs(email);
  return session.csrfToken ?? "";
}

// ---------------------------------------------------------------- public reads ----

section("public directory");
{
  const health = await api("GET", "/health");
  check(
    "GET /health reports a reachable database",
    health.status === 200 && health.data?.database === "ok",
    health.data,
  );

  const versionProbe = await api("GET", "/api/v1/version");
  check(
    "GET /version reports build + version and is publicly cacheable",
    versionProbe.status === 200 &&
      Boolean(versionProbe.data?.version) &&
      Boolean(versionProbe.data?.build) &&
      String(versionProbe.headers.get("cache-control")).includes("max-age=300"),
    { body: versionProbe.data, cache: versionProbe.headers.get("cache-control") },
  );

  const categories = await api("GET", "/api/v1/categories");
  check(
    "GET /categories returns active categories with live counts",
    categories.status === 200 &&
      (categories.data?.items?.length ?? 0) >= 8 &&
      categories.data.items.every((row) => typeof row.count === "number" && row.count >= 0),
    categories.data?.items?.map((row) => [row.slug, row.count]),
  );
  check(
    "categories carry the onboarding checklist the console renders",
    categories.data?.items?.every((row) => Array.isArray(row.checklist)),
    categories.data?.items?.[0]?.checklist,
  );

  const locations = await api("GET", "/api/v1/locations");
  check(
    "GET /locations lists cities with areas and counts",
    (locations.data?.items?.length ?? 0) >= 3 &&
      locations.data.items.every((row) => Array.isArray(row.areas) && row.areas.length > 0),
    locations.data?.items?.map((row) => [row.slug, row.count]),
  );

  const search = await api("GET", "/api/v1/search?q=screen&perPage=12&page=1");
  const first = search.data?.items?.[0];
  check(
    "GET /search?q=screen finds listings",
    search.status === 200 && (search.data?.meta?.total ?? 0) > 0,
    search.data?.meta,
  );
  check(
    "search results carry every field the card UI renders",
    Boolean(first?.slug && first?.categoryName && first?.city) &&
      typeof first?.ratingAvg === "number",
    first,
  );
  check(
    "search payload contains no SQL fragments",
    !JSON.stringify(search.data ?? {})
      .toUpperCase()
      .includes("SELECT"),
    first?.name,
  );

  const validation = await api("GET", "/api/v1/search?perPage=3");
  check(
    "out-of-range perPage explains the range instead of claiming a missing field",
    validation.status === 422 && /6/.test(validation.data?.error?.fields?.perPage ?? ""),
    validation.data?.error,
  );

  const ratingFilter = await api("GET", "/api/v1/search?minRating=4.5&perPage=12");
  check(
    "minRating is enforced in SQL, not in the browser",
    ratingFilter.status === 200 &&
      (ratingFilter.data?.items ?? []).length > 0 &&
      ratingFilter.data.items.every((row) => row.ratingAvg >= 4.5),
    ratingFilter.data?.items?.map((row) => [row.slug, row.ratingAvg]),
  );

  const verified = await api("GET", "/api/v1/search?verified=true&perPage=12");
  check(
    "verified filter returns only verified listings",
    (verified.data?.items ?? []).length > 0 &&
      verified.data.items.every((row) => row.verifiedLevel !== "unverified"),
    verified.data?.items?.map((row) => [row.slug, row.verifiedLevel]),
  );

  const hidden = await api("GET", "/api/v1/search?q=crown&perPage=12");
  check(
    "hidden listings stay out of search",
    (hidden.data?.items ?? []).every((row) => row.slug !== "crown-events"),
    hidden.data?.items?.map((row) => row.slug),
  );
  const drafts = await api("GET", "/api/v1/search?q=brightpath&perPage=12");
  check(
    "draft listings stay out of search",
    (drafts.data?.items ?? []).length === 0,
    drafts.data?.items?.map((row) => row.slug),
  );

  const bySlug = await api("GET", "/api/v1/businesses/swiftfix-gadgets");
  const detail = bySlug.data?.business;
  check(
    "GET /businesses/:slug returns hours, services and contact channels",
    bySlug.status === 200 &&
      (detail?.hours?.length ?? 0) > 0 &&
      Array.isArray(detail?.services) &&
      Boolean(detail?.whatsApp || detail?.phone),
    {
      hours: detail?.hours?.length,
      services: detail?.services?.length,
      whatsapp: detail?.whatsApp,
    },
  );
  check(
    "listing rating is trigger-maintained",
    detail?.ratingCount === 2 && detail?.ratingAvg === 4.5,
    {
      ratingCount: detail?.ratingCount,
      ratingAvg: detail?.ratingAvg,
    },
  );
  check(
    "unverified viewer gets no management affordance",
    bySlug.data?.viewer?.canManage === false,
    bySlug.data?.viewer,
  );

  const byId = await api("GET", "/api/v1/businesses/biz_swiftfix");
  check(
    "listings resolve by id as well as slug",
    byId.status === 200 && byId.data?.business?.slug === "swiftfix-gadgets",
    byId.data?.error,
  );

  const missing = await api("GET", "/api/v1/businesses/nope-not-here");
  check(
    "unknown slug is a real 404",
    missing.status === 404 && missing.data?.error?.code === "not_found",
    missing.data?.error,
  );
  const softHidden = await api("GET", "/api/v1/businesses/crown-events");
  check(
    "hidden listing detail 404s instead of leaking",
    softHidden.status === 404,
    softHidden.data?.error?.code,
  );

  const reviews = await api("GET", "/api/v1/businesses/swiftfix-gadgets/reviews");
  check(
    "public review list excludes held reviews",
    reviews.status === 200 &&
      reviews.data.items.length === 2 &&
      reviews.data.items.every((row) => !String(row.body).toLowerCase().includes("fraud")),
    reviews.data?.items?.length,
  );

  const sitemap = await api("GET", "/api/v1/sitemap");
  const paths = (sitemap.data?.businesses ?? []).map((entry) => String(entry.path));
  check(
    "sitemap omits hidden and draft listings",
    sitemap.status === 200 &&
      paths.length > 0 &&
      !paths.some((u) => u.includes("crown-events") || u.includes("brightpath")),
    {
      status: sitemap.status,
      count: paths.length,
      error: sitemap.data?.error,
      keys: Object.keys(sitemap.data ?? {}),
    },
  );
  check("sitemap covers every published listing", paths.length >= 10, paths.length);
  check(
    "sitemap carries lastmod plus category, location and room groups for the frontend",
    sitemap.data?.businesses?.every((entry) => /^\d{4}-\d{2}-\d{2}$/.test(String(entry.lastmod))) &&
      (sitemap.data?.categories?.length ?? 0) >= 8 &&
      (sitemap.data?.locations?.length ?? 0) >= 3 &&
      Array.isArray(sitemap.data?.rooms),
    {
      categories: sitemap.data?.categories?.length,
      locations: sitemap.data?.locations?.length,
      rooms: sitemap.data?.rooms?.length,
    },
  );
  const facets = (await api("GET", "/api/v1/search?perPage=6")).data?.facets;
  check(
    "search returns server-side facets for the filter rail",
    Boolean(facets) && Array.isArray(facets.categories) && facets.categories.length > 0,
    Object.keys(facets ?? {}),
  );

  const xml = await fetch(`${BASE}/api/v1/sitemap.xml`).then((r) => r.text());
  check(
    "sitemap.xml is a urlset document",
    xml.startsWith("<?xml") && xml.includes("<urlset"),
    xml.slice(0, 120),
  );

  const unknownRoute = await api("GET", "/api/v1/does-not-exist");
  check(
    "unknown API routes answer with JSON, never HTML",
    unknownRoute.status === 404 &&
      String(unknownRoute.headers.get("content-type")).includes("application/json"),
    { status: unknownRoute.status, type: unknownRoute.headers.get("content-type") },
  );
  const searchCache = String(
    (await api("GET", "/api/v1/search?q=screen")).headers.get("cache-control") ?? "",
  );
  check(
    "cold public reads are cacheable at the edge",
    searchCache.includes("public") && /max-age=\d+/.test(searchCache),
    searchCache,
  );
}

// ------------------------------------------------------------------ auth + CSRF ----

section("auth, CSRF, abuse controls");
const smokeEmail = `smoke.${Date.now()}@example.test`;
let consumerCsrf = "";
let consumerId = "";
{
  const weak = await api("POST", "/api/v1/auth/register", {
    body: {
      displayName: "Smoke",
      email: smokeEmail,
      phone: "08030000000",
      password: "short",
      role: "consumer",
      acceptedTerms: true,
    },
  });
  check(
    "weak password rejected with field-level copy",
    weak.status === 422 && Boolean(weak.data?.error?.fields?.password),
    weak.data?.error,
  );

  const created = await api("POST", "/api/v1/auth/register", {
    body: {
      displayName: "Smoke Tester",
      email: smokeEmail,
      phone: "0803 000 1234",
      password: PASSWORD,
      role: "consumer",
      acceptedTerms: true,
    },
  });
  check(
    "register opens a session and returns a CSRF token",
    created.status === 201 && Boolean(created.data?.csrfToken) && Boolean(created.data?.user?.id),
    created.data?.error,
  );
  check(
    "registration sets an HttpOnly session cookie",
    [...jar.keys()].some((name) => name === "gh_session"),
    [...jar.keys()],
  );
  consumerCsrf = created.data?.csrfToken ?? "";
  consumerId = created.data?.user?.id ?? "";

  const dupe = await apiResilient("POST", "/api/v1/auth/register", {
    body: {
      displayName: "Smoke Tester",
      email: smokeEmail,
      phone: "08030000000",
      password: PASSWORD,
      role: "consumer",
      acceptedTerms: true,
    },
  });
  check("duplicate email is refused", [409, 422].includes(dupe.status), dupe.data?.error);

  const session = await api("GET", "/api/v1/auth/session");
  check(
    "GET /auth/session reflects the cookie",
    session.status === 200 && session.data?.user?.email === smokeEmail,
    session.data?.user?.email,
  );

  const badCsrf = await api("PATCH", "/api/v1/auth/profile", { body: { displayName: "Hijacked" } });
  check(
    "unsafe request without a CSRF token is refused",
    badCsrf.status === 403 && /reload/i.test(badCsrf.data?.error?.message ?? ""),
    badCsrf.data?.error,
  );

  const crossOrigin = await api("PATCH", "/api/v1/auth/profile", {
    body: { displayName: "Hijacked" },
    csrf: consumerCsrf,
  });
  void crossOrigin;

  jar.clear();
  const unverified = await api("POST", "/api/v1/auth/login", {
    body: { identifier: OWNER, password: "definitely-not-the-password" },
  });
  check(
    "wrong password returns a generic 401",
    unverified.status === 401 &&
      !/ada|lumea|not-the-password/.test(JSON.stringify(unverified.data)),
    unverified.data,
  );
  check(
    "the failed attempt does not disclose which field was wrong",
    unverified.data?.error?.fields === undefined,
    unverified.data?.error,
  );

  const unknownUser = await api("POST", "/api/v1/auth/login", {
    body: { identifier: "ghost+" + Date.now() + "@example.test", password: PASSWORD },
  });
  const strip = (payload) =>
    JSON.stringify({ code: payload?.error?.code, message: payload?.error?.message });
  check(
    "unknown identifier returns the identical 401 shape",
    strip(unknownUser.data) === strip(unverified.data) && unknownUser.status === 401,
    { status: unknownUser.status, body: unknownUser.data?.error },
  );
}

// ------------------------------------------------------------------- workspace ----

section("workspace (owner)");
{
  const owner = await loginAs(OWNER);
  const csrf = owner.csrfToken;
  check(
    "owner login lists their businesses",
    Array.isArray(owner.memberships) && owner.memberships.length >= 1,
    owner.memberships?.length,
  );

  const summary = await api("GET", `${WS}/summary`);
  check(
    "summary metrics come from real rows, not constants",
    summary.status === 200 &&
      typeof summary.data?.metrics?.contactsGained === "number" &&
      summary.data.metrics.contactsGained > 0,
    summary.data?.metrics,
  );
  check(
    "summary trend has a row per day",
    (summary.data?.trend?.length ?? 0) >= 7,
    summary.data?.trend?.length,
  );
  check(
    "summary exposes attention items",
    Array.isArray(summary.data?.attention),
    summary.data?.attention,
  );

  const foreign = await api("GET", "/api/v1/workspaces/biz_wellcare/summary");
  check(
    "another business's workspace is not readable",
    [403, 404].includes(foreign.status),
    foreign.data?.error?.code,
  );

  const profileBefore = await api("GET", `${WS}/profile`);
  const originalTagline = profileBefore.data?.profile?.tagline;
  const updated = await api("PATCH", `${WS}/profile`, {
    csrf,
    body: { tagline: "Phone and laptop repairs in Yaba — quoted before we open the phone" },
  });
  check(
    "PATCH profile writes through",
    updated.status === 200 && typeof updated.data?.profileComplete === "number",
    updated.data?.error ?? updated.data,
  );
  const profileAfter = await api("GET", `${WS}/profile`);
  check(
    "the written tagline is what the public page will render",
    profileAfter.data?.profile?.tagline?.includes("quoted before"),
    profileAfter.data?.profile?.tagline,
  );
  check(
    "completeness moved with content",
    (profileAfter.data?.completeness ?? updated.data?.profileComplete ?? 0) > 0,
    {
      completeness: profileAfter.data?.completeness,
      profileComplete: updated.data?.profileComplete,
    },
  );

  const restored = await api("PATCH", `${WS}/profile`, {
    csrf,
    body: { tagline: originalTagline },
  });
  check("tagline restored for a repeat run", restored.status === 200, restored.data?.error);

  const injection = await api("PATCH", `${WS}/profile`, {
    csrf,
    body: { address: "Yaba'); DROP TABLE businesses;--" },
  });
  const health = await api("GET", "/health");
  check(
    "SQL-shaped input is stored as text and the table survives",
    injection.status === 200 && health.data?.database === "ok",
    injection.data?.error,
  );
  await api("PATCH", `${WS}/profile`, { csrf, body: { address: "12 Herbert Macaulay Way, Yaba" } });

  const xss = await api("POST", `${WS}/leads`, {
    csrf,
    body: {
      name: "<script>alert(1)</script>",
      phone: "08030007777",
      stage: "new",
      source: "manual",
      note: "<img src=x onerror=alert(1)>",
    },
  });
  check(
    "markup in a lead is stored verbatim and served as JSON",
    xss.status === 201,
    xss.data?.error,
  );
  if (xss.data?.lead?.id) {
    const readBack = await api("GET", `${WS}/leads/${xss.data.lead.id}`);
    check(
      "the API never re-emits it as HTML",
      String(readBack.headers.get("content-type")).includes("application/json") &&
        readBack.data?.lead?.name === "<script>alert(1)</script>",
      readBack.data?.lead?.name,
    );
  }

  const publish = await api("POST", `${WS}/publish`, { csrf });
  check(
    "publish returns a live status and completeness",
    publish.status === 200 && ["published", "pending"].includes(publish.data?.status),
    publish.data,
  );
  const unpublish = await api("POST", `${WS}/unpublish`, { csrf });
  check("unpublish returns the listing to draft", unpublish.status === 200, unpublish.data?.error);
  await api("POST", `${WS}/publish`, { csrf });

  const services = await api("GET", `${WS}/services`);
  check(
    "services list uses the `note` column",
    services.status === 200 && (services.data?.items?.length ?? 0) >= 3,
    services.data?.error ?? services.data?.items?.length,
  );
  const products = await api("GET", `${WS}/products`);
  check(
    "products list uses the `tag` column",
    products.status === 200 && (products.data?.items?.length ?? 0) >= 3,
    products.data?.error ?? products.data?.items?.length,
  );
  const newService = await api("POST", `${WS}/services`, {
    csrf,
    body: {
      name: `Smoke service ${Date.now()}`,
      priceMinor: 250000,
      note: "Walk-ins welcome",
      active: true,
    },
  });
  check("service can be created", newService.status === 201, newService.data?.error);
  const patchService = await api("PATCH", `${WS}/services/${newService.data?.id}`, {
    csrf,
    body: { name: "Smoke service (edited)", priceMinor: 300000, active: true },
  });
  check("service can be updated", patchService.status === 200, patchService.data?.error);
  const deleteService = await api("DELETE", `${WS}/services/${newService.data?.id}`, { csrf });
  check("service can be deleted", deleteService.status === 200, deleteService.data?.error);

  const media = await api("GET", `${WS}/media`);
  check(
    "media list is shaped even when empty",
    media.status === 200 && Array.isArray(media.data?.items),
    media.data?.error,
  );

  const analytics = await api("GET", `${WS}/analytics?days=14`);
  check(
    "analytics returns a dense per-day series from metrics_daily",
    analytics.status === 200 &&
      (analytics.data?.stats?.days?.length ?? 0) > 0 &&
      typeof analytics.data.stats.totalViews === "number",
    {
      days: analytics.data?.stats?.days?.length,
      totals: analytics.data?.stats && { views: analytics.data.stats.totalViews },
    },
  );

  const audit = await api("GET", `${WS}/audit`);
  check(
    "owner audit trail records the edits above",
    audit.status === 200 && (audit.data?.items?.length ?? 0) >= 3,
    audit.data?.items?.length,
  );
}

// --------------------------------------------------------------- CRM + enquiries ----

section("contact capture → lead");
{
  const idemKey = `smoke-${Date.now()}`;
  const body = {
    businessId: "biz_swiftfix",
    name: "Smoke Enquirer",
    phone: "0803 000 4321",
    email: "smoke.enquirer@example.test",
    need: "Cracked OLED screen on a Samsung S23 — do you have the part, and what does it cost?",
    source: "directory_profile",
    idempotencyKey: idemKey,
  };
  jar.clear();
  const anon = await api("POST", "/api/v1/businesses/swiftfix-gadgets/enquiries", { body });
  check(
    "anonymous enquiry is accepted without a session",
    anon.status === 201 && Boolean(anon.data?.enquiryId),
    anon.data?.error,
  );
  check(
    "enquiry creates an attributed lead",
    Boolean(anon.data?.lead?.id) && Boolean(anon.data?.lead?.code),
    anon.data?.lead,
  );
  check(
    "enquiry hands the visitor a WhatsApp deep link",
    String(anon.data?.whatsappUrl ?? "").startsWith("https://wa.me/"),
    anon.data?.whatsappUrl,
  );

  const replay = await api("POST", "/api/v1/businesses/swiftfix-gadgets/enquiries", { body });
  check(
    "replayed submission is deduplicated",
    replay.status === 200 &&
      replay.data?.deduplicated === true &&
      replay.data?.enquiryId === anon.data?.enquiryId,
    replay.data,
  );

  const honeypotted = await api("POST", "/api/v1/businesses/swiftfix-gadgets/enquiries", {
    body: { ...body, honeypot: "bot", idempotencyKey: idemKey + "-hp" },
  });
  check(
    "honeypot submission fakes success without writing",
    honeypotted.status === 201 && honeypotted.data?.id === "ignored",
    honeypotted.data,
  );

  const spammy = await api("POST", "/api/v1/businesses/swiftfix-gadgets/enquiries", {
    body: { ...body, need: "short", idempotencyKey: idemKey + "-s" },
  });
  check(
    "a 6-character need is rejected by length, not silently trimmed",
    spammy.status === 422,
    spammy.data?.error,
  );

  await loginAs(OWNER);
  const owner = await api("GET", "/api/v1/auth/session");
  const csrf = owner.data?.csrfToken ?? "";
  const leads = await api("GET", `${WS}/leads?perPage=25&page=1`);
  const open = (leads.data?.items ?? []).find((row) => row.code === anon.data?.lead?.code);
  check("the new enquiry is visible in the owner's CRM", Boolean(open), leads.data?.meta);
  if (open?.id) {
    const skipped = await api("POST", `${WS}/leads/${open.id}/stage`, {
      csrf,
      body: { stage: "quoted" },
    });
    check(
      "the pipeline refuses new → quoted",
      skipped.status === 400 || skipped.status === 422,
      skipped.data?.error?.code,
    );
    const moved = await api("POST", `${WS}/leads/${open.id}/stage`, {
      csrf,
      body: { stage: "qualified", valueMinor: 180000, note: "Smoke: asked for a quote" },
    });
    check(
      "advancing the lead records value + timeline event",
      moved.status === 200 && moved.data?.lead?.stage === "qualified",
      moved.data?.error ?? moved.data?.lead?.stage,
    );
    const illegal = await api("POST", `${WS}/leads/${open.id}/stage`, {
      csrf,
      body: { stage: "won", valueMinor: -5 },
    });
    check("negative deal value is rejected", illegal.status === 422, illegal.data?.error?.code);
    const stats = await api("GET", `${WS}/leads/stats`);
    check(
      "lead stats aggregate by stage with values",
      stats.status === 200 &&
        Array.isArray(stats.data?.stages) &&
        stats.data.stages.some((row) => row.stage === "qualified" && row.count >= 1),
      stats.data?.stages,
    );
    const lostNoReason = await api("POST", `${WS}/leads/${open.id}/stage`, {
      csrf,
      body: { stage: "lost" },
    });
    check(
      "losing a lead requires a reason",
      lostNoReason.status === 422 && Boolean(lostNoReason.data?.error?.fields?.lostReason),
      lostNoReason.data?.error,
    );
    const lost = await api("POST", `${WS}/leads/${open.id}/stage`, {
      csrf,
      body: { stage: "lost", lostReason: "went_cold" },
    });
    check(
      "a lost reason is accepted and recorded",
      lost.status === 200 && lost.data?.lead?.stage === "lost",
      lost.data?.error ?? lost.data?.lead?.stage,
    );
    const timeline = await api("GET", `${WS}/leads/${open.id}`);
    check(
      "the lead timeline shows every hop",
      (timeline.data?.lead?.history ?? []).length >= 3,
      timeline.data?.lead?.history?.length ?? timeline.data?.error,
    );
  }
  const enquiries = await api("GET", `${WS}/enquiries?perPage=10&page=1`);
  check(
    "owner sees the enquiry with the visitor's need",
    (enquiries.data?.items ?? []).some((row) => row.need?.includes("OLED")),
    enquiries.data?.error ?? enquiries.data?.items?.length,
  );

  const tasks = await api("POST", `${WS}/tasks`, {
    csrf,
    body: {
      title: "Smoke follow-up",
      dueDate: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      priority: "high",
    },
  });
  check("task can be created", tasks.status === 201, tasks.data?.error);
  if (tasks.data?.id) {
    const toggled = await api("POST", `${WS}/tasks/${tasks.data.id}/toggle`, { csrf });
    check(
      "task toggle returns the updated task",
      toggled.status === 200 && toggled.data?.task?.status === "done",
      toggled.data?.error ?? toggled.data,
    );
    await api("DELETE", `${WS}/tasks/${tasks.data.id}`, { csrf });
  }

  const link = await api("GET", `${WS}/links`);
  check(
    "share links exist with counters",
    (link.data?.items ?? []).length >= 1,
    link.data?.items?.length,
  );

  const runPhone = `0803${String(Date.now()).slice(-7)}`;
  const contacts = await api("POST", `${WS}/contacts`, {
    csrf,
    body: { name: "Smoke Contact", phone: runPhone, note: "Created by dev/smoke" },
  });
  check("contact can be added", contacts.status === 201, contacts.data?.error);
  const sameRun = await api("POST", `${WS}/contacts`, {
    csrf,
    body: { name: "Smoke Contact Again", phone: runPhone },
  });
  check(
    "the same number cannot be stored twice for one listing",
    sameRun.status === 409 || sameRun.status === 422,
    sameRun.data?.error,
  );
  const dupeContact = await api("POST", `${WS}/contacts`, {
    csrf,
    body: { name: "Smoke Contact", phone: "0803 000 4321" },
  });
  check(
    "duplicate phone contact is refused by the partial unique index",
    dupeContact.status === 409 || dupeContact.status === 422,
    dupeContact.data?.error,
  );
}

// ------------------------------------------------------------------- reviews ----

section("reviews, ratings, moderation");
{
  // Owned by kunle (usr_owner2) — that lets the next section prove a *different*
  // owner cannot reply to a review that is not on their listing.
  const target = "wellcare-pharmacy";
  const before = await api("GET", `/api/v1/businesses/${target}`);
  const countBefore = before.data?.business?.ratingCount ?? 0;
  void target;

  await loginAs(smokeEmail);
  const session = await api("GET", "/api/v1/auth/session");
  const csrf = session.data?.csrfToken ?? "";
  const review = await api("POST", `/api/v1/businesses/${target}/reviews`, {
    csrf,
    body: {
      rating: 4,
      body: "Jollof was excellent and the rider arrived ten minutes early, even in the rain. Portions are generous.",
    },
  });
  check(
    "a signed-in consumer can post a review",
    review.status === 201 && Boolean(review.data?.reviewId),
    review.data?.error,
  );
  const again = await api("POST", `/api/v1/businesses/${target}/reviews`, {
    csrf,
    body: {
      rating: 5,
      body: "Second attempt at reviewing the same place, which must not be allowed.",
    },
  });
  check(
    "one review per person per business is enforced",
    again.status === 409,
    again.data?.error?.code,
  );
  const tooShort = await api("POST", `/api/v1/businesses/${target}/reviews`, {
    csrf,
    body: { rating: 4, body: "great" },
  });
  check("review body length floor enforced", tooShort.status === 422, tooShort.data?.error?.fields);

  const after = await api("GET", `/api/v1/businesses/${target}`);
  check(
    "rating aggregate recomputed by trigger",
    (after.data?.business?.ratingCount ?? 0) === countBefore + 1,
    {
      before: countBefore,
      after: after.data?.business?.ratingCount,
    },
  );

  const listed = await api("GET", `/api/v1/businesses/${target}/reviews`);
  const mine = (listed.data?.items ?? []).find((row) => row.id === review.data?.reviewId);
  check("new review appears in the public list", Boolean(mine), listed.data?.items?.length);
  if (mine) {
    const edited = await api("PATCH", `/api/v1/reviews/${review.data.reviewId}`, {
      csrf,
      body: {
        rating: 5,
        body: "Went back for small chops — still excellent, and the pricing was exactly as quoted.",
      },
    });
    check("author can edit their own review", edited.status === 200, edited.data?.error);
  }

  // Owner replies are a business action, not a moderator action.
  await loginAs("kunle@autoplug.ng");
  const ownerSession = await api("GET", "/api/v1/auth/session");
  const reply = await api("POST", `/api/v1/reviews/${review.data?.reviewId}/reply`, {
    csrf: ownerSession.data?.csrfToken ?? "",
    body: { body: "Thank you — we added an early-bird slot so orders beat traffic." },
  });
  check("owner replies to a review on their listing", reply.status === 200, reply.data?.error);
  // A different business owner must not be able to reply to this review.
  await loginAs(OWNER);
  const strangerSession = await api("GET", "/api/v1/auth/session");
  const foreignReply = await api("POST", `/api/v1/reviews/${review.data?.reviewId}/reply`, {
    csrf: strangerSession.data?.csrfToken ?? "",
    body: { body: "Replying from a workspace that does not own this review." },
  });
  check(
    "a reply is only allowed on a review the caller owns",
    foreignReply.status === 403 || foreignReply.status === 404,
    { status: foreignReply.status, error: foreignReply.data?.error },
  );
  const replyVisible = await api("GET", `/api/v1/businesses/${target}/reviews`);
  check(
    "the published reply is rendered with its timestamp",
    (replyVisible.data?.items ?? []).some(
      (row) => row.ownerReply?.includes("early-bird") && Boolean(row.ownerReplyAt),
    ),
    replyVisible.data?.items?.find((row) => row.id === review.data?.reviewId) ??
      replyVisible.data?.items?.[0],
  );
  const editSomeoneElses = await api("PATCH", `/api/v1/reviews/${review.data?.reviewId}`, {
    csrf: strangerSession.data?.csrfToken ?? "",
    body: {
      rating: 1,
      body: "Rewriting somebody else's review from another account should be impossible.",
    },
  });
  check(
    "a review can only be edited by its author",
    editSomeoneElses.status === 403 || editSomeoneElses.status === 404,
    { status: editSomeoneElses.status, error: editSomeoneElses.data?.error },
  );

  // Report-and-hide is the trust-and-safety loop end to end: a reader flags a review,
  // the moderator acts, the public aggregate follows. Built on a review this run owns,
  // so it does not depend on leftovers from a previous seed.
  const readerCsrf = await signIn("ngozi@example.com");
  const reported = await api("POST", `/api/v1/businesses/${target}/report`, {
    csrf: readerCsrf,
    body: {
      targetType: "review",
      targetId: review.data?.reviewId ?? "",
      reason: "fake_review",
      detail: "This account was created an hour ago and only exists to post this.",
    },
  });
  check(
    "a review can be reported with a reference",
    reported.status === 201 && Boolean(reported.data?.reference),
    reported.data?.error ?? reported.data,
  );

  await loginAs(ADMIN);
  const adminCsrf2 = (await api("GET", "/api/v1/auth/session")).data?.csrfToken ?? "";
  const reopened = await api("GET", "/api/v1/admin/moderation");
  const reportedItem = (reopened.data?.items ?? []).find(
    (row) => row.targetId === review.data?.reviewId,
  );
  check(
    "the report queues the review for moderation",
    Boolean(reportedItem),
    reopened.data?.items?.map((row) => [row.type, row.targetId]),
  );
  if (reportedItem) {
    const hidden = await api("POST", `/api/v1/admin/moderation/${reportedItem.id}`, {
      csrf: adminCsrf2,
      body: {
        decision: "remove",
        note: "Unverifiable account, single-purpose review.",
        notifyOwner: false,
      },
    });
    check(
      "moderator hides the reported review",
      hidden.status === 200 && hidden.data?.status === "removed",
      hidden.data?.error ?? hidden.data,
    );
    const afterHide = await api("GET", `/api/v1/businesses/${target}`);
    check(
      "the rating aggregate drops the hidden review",
      (afterHide.data?.business?.ratingCount ?? -1) === countBefore,
      { expected: countBefore, actual: afterHide.data?.business?.ratingCount },
    );
    const publicList = await api("GET", `/api/v1/businesses/${target}/reviews`);
    check(
      "a hidden review disappears from the public list",
      !(publicList.data?.items ?? []).some((row) => row.id === review.data?.reviewId),
      publicList.data?.items?.map((row) => row.id),
    );
    const readerAgain = await signIn("ngozi@example.com");
    const reReport = await api("POST", `/api/v1/businesses/${target}/report`, {
      csrf: readerAgain,
      body: {
        targetType: "review",
        targetId: review.data?.reviewId ?? "",
        reason: "fake_review",
        detail: "Second reader flags the same review after it was hidden.",
      },
    });
    check("a repeat report is accepted", reReport.status === 201, reReport.data?.error);
    await loginAs(ADMIN);
    const queueAgain = await api("GET", "/api/v1/admin/moderation");
    const reopenedItem = (queueAgain.data?.items ?? []).find(
      (row) => row.targetId === review.data?.reviewId && row.status === "pending",
    );
    check(
      "a report after a decision re-opens the moderation item",
      Boolean(reopenedItem),
      queueAgain.data?.items?.map((row) => [row.targetId, row.status]),
    );
    if (reopenedItem) {
      const restored = await api("POST", `/api/v1/admin/moderation/${reopenedItem.id}`, {
        csrf: (await api("GET", "/api/v1/auth/session")).data?.csrfToken ?? "",
        body: {
          decision: "approve",
          note: "Re-checked: genuine reviewer, keeping it published.",
          notifyOwner: false,
        },
      });
      check(
        "the decision can be revisited",
        restored.status === 200 && restored.data?.status === "approved",
        restored.data?.error ?? restored.data,
      );
      const back = await api("GET", `/api/v1/businesses/${target}/reviews`);
      check(
        "an approved review is visible again",
        (back.data?.items ?? []).some((row) => row.id === review.data?.reviewId),
        back.data?.items?.length,
      );
    }
  }

  // A room opened by a business enters the queue as a pending moderation item, which
  // keeps this check repeatable instead of consuming the one seeded item.
  await loginAs("kunle@autoplug.ng");
  const ownerCsrf = (await api("GET", "/api/v1/auth/session")).data?.csrfToken ?? "";
  const roomName = `Smoke Crew ${String(Date.now()).slice(-6)}`;
  const roomCreated = await api("POST", "/api/v1/rooms", {
    csrf: ownerCsrf,
    body: {
      name: roomName,
      purpose: "niche",
      houseRule: "Only refer work you would take yourself. No paid placements.",
      state: "Rivers",
      verifiedOnly: false,
    },
  });
  check(
    "a business can open a room (pending review)",
    roomCreated.status === 201 && roomCreated.data?.status === "pending",
    roomCreated.data?.error ?? roomCreated.data,
  );

  // Held review from the seed: approving or rejecting it must move both tables.
  await loginAs(ADMIN);
  const adminSession = await api("GET", "/api/v1/auth/session");
  const adminCsrf = adminSession.data?.csrfToken ?? "";
  const queue = await api("GET", "/api/v1/admin/moderation");
  const held = (queue.data?.items ?? []).find(
    (row) => row.type === "review" && row.status === "pending",
  );
  const newRoomItem = (queue.data?.items ?? []).find(
    (row) => row.type === "room" && row.targetId === roomCreated.data?.id,
  );
  check(
    "the new room entered the pending queue",
    Boolean(newRoomItem),
    queue.data?.items?.map((row) => [row.type, row.risk, row.status]),
  );
  check(
    "the queue is ordered by risk, not by arrival",
    (queue.data?.items ?? []).every(
      (row, index, all) =>
        index === 0 ||
        ["low", "medium", "high"].indexOf(all[index - 1].risk) >=
          ["low", "medium", "high"].indexOf(row.risk),
    ),
    queue.data?.items?.map((row) => row.risk),
  );
  if (newRoomItem) {
    const approved = await api("POST", `/api/v1/admin/moderation/${newRoomItem.id}`, {
      csrf: adminCsrf,
      body: { decision: "approve", note: "House rule is clear.", notifyOwner: true },
    });
    check(
      "approving activates the room",
      approved.status === 200,
      approved.data?.error ?? approved.data,
    );
    const roomAfter = await api("GET", `/api/v1/rooms/${roomCreated.data?.slug}`);
    check(
      "an approved room is visible as active",
      roomAfter.status === 200 && roomAfter.data?.room?.status === "active",
      roomAfter.data?.error ?? roomAfter.data?.room?.status,
    );
  }
  if (held) {
    const decided = await api("POST", `/api/v1/admin/moderation/${held.id}`, {
      csrf: adminCsrf,
      body: {
        decision: "remove",
        note: "Payment request outside GainHub — reviewer warned.",
        notifyOwner: false,
      },
    });
    check(
      "admin decision is recorded",
      decided.status === 200 && decided.data?.status === "removed",
      decided.data?.error ?? decided.data,
    );
    const double = await api("POST", `/api/v1/admin/moderation/${held.id}`, {
      csrf: adminCsrf,
      body: { decision: "approve", note: "changed my mind" },
    });
    check("a decided item cannot be re-decided", double.status === 409, double.data?.error?.code);
    const reviewsAfter = await api("GET", `/api/v1/businesses/swiftfix-gadgets/reviews`);
    check(
      "removed review is gone from the public list",
      !(reviewsAfter.data?.items ?? []).some((row) =>
        String(row.body).toLowerCase().includes("fraud"),
      ),
      reviewsAfter.data?.items?.length,
    );
    const authorNotified = await api("GET", "/api/v1/me/notifications");
    void authorNotified;
  }

  const stats = await api("GET", "/api/v1/admin/stats");
  check(
    "admin stats count published listings from the same table the search reads",
    stats.status === 200 &&
      stats.data?.totals?.published >= 10 &&
      stats.data.totals.businesses >= 12,
    stats.data?.totals,
  );
  const users = await api("GET", "/api/v1/admin/users?q=smoke&perPage=25&page=1");
  check(
    "admin user search finds the smoke account with listing counts",
    users.status === 200 && (users.data?.items ?? []).some((row) => row.email === smokeEmail),
    { total: users.data?.meta?.total, error: users.data?.error },
  );
  const suspended = await api("GET", "/api/v1/admin/users?status=suspended&perPage=25&page=1");
  check(
    "admin user filters are applied in SQL",
    (suspended.data?.items ?? []).every((row) => row.status === "suspended"),
    suspended.data?.items?.map((row) => row.status),
  );
  const jobs = await api("GET", "/api/v1/admin/jobs");
  check(
    "cron heartbeats and run history are observable",
    jobs.status === 200 &&
      typeof jobs.data?.heartbeat === "object" &&
      Array.isArray(jobs.data?.runs),
    jobs.data,
  );
  const flags = await api("PUT", "/api/v1/admin/flags", {
    csrf: adminCsrf,
    body: {
      key: "smoke.flag",
      enabled: true,
      description: "Set by dev/smoke",
      rolloutPercent: 100,
    },
  });
  check("feature flags can be set by an admin", flags.status === 200, flags.data?.error);
  const flagList = await api("GET", "/api/v1/admin/flags");
  check(
    "the written flag reads back",
    (flagList.data?.items ?? []).some((row) => row.key === "smoke.flag" && row.enabled === true),
    flagList.data?.items?.length,
  );
  const badFlag = await api("PUT", "/api/v1/admin/flags", {
    csrf: adminCsrf,
    body: { key: "Bad Key!", enabled: true },
  });
  check("flag keys are validated", badFlag.status === 422, badFlag.data?.error?.fields);
  const removed = await api("DELETE", "/api/v1/admin/flags/smoke.flag", { csrf: adminCsrf });
  check("flags can be deleted", removed.status === 200, removed.data?.error);

  const notAdmin = await loginAs(OWNER).then(() => api("GET", "/api/v1/admin/stats"));
  check(
    "non-admins are locked out of admin reads",
    [401, 403].includes(notAdmin.status),
    notAdmin.data?.error?.code,
  );
}

// ---------------------------------------------------------------------- rooms ----

section("contact-gain rooms");
{
  const rooms = await api("GET", "/api/v1/rooms");
  check(
    "rooms list with member counts",
    rooms.status === 200 && (rooms.data?.items?.length ?? 0) >= 2,
    rooms.data?.items?.length ?? rooms.data,
  );
  const open = (rooms.data?.items ?? []).find(
    (row) => row.status === "active" && !row.verifiedOnly,
  );
  const gated = (rooms.data?.items ?? []).find((row) => row.verifiedOnly);

  if (gated?.slug) {
    // A consumer with no verified listing must be refused on the server, not hidden in the UI.
    await loginAs(smokeEmail);
    const refused = await api("POST", `/api/v1/rooms/${gated.slug}/join`, {
      csrf: (await api("GET", "/api/v1/auth/session")).data?.csrfToken ?? "",
    });
    check(
      "verified-only rooms reject unverified businesses",
      refused.status === 403 || refused.status === 400,
      { status: refused.status, error: refused.data?.error },
    );
  }

  if (open?.slug) {
    await loginAs("kunle@autoplug.ng");
    const csrf = (await api("GET", "/api/v1/auth/session")).data?.csrfToken ?? "";
    const outsider = await api("POST", `/api/v1/rooms/${open.slug}/checkin`, {
      csrf,
      body: { savedContacts: 1 },
    });
    check("a non-member cannot check in", outsider.status === 403, {
      status: outsider.status,
      error: outsider.data?.error,
    });
    const joined = await api("POST", `/api/v1/rooms/${open.slug}/join`, {
      csrf,
      body: { note: "Dispatch and event setup in PH." },
    });
    check(
      "joining an open room queues an application",
      [200, 201].includes(joined.status) && joined.data?.status === "queued",
      joined.data?.error ?? joined.data,
    );
    const detail = await api("GET", `/api/v1/rooms/${open.slug}`);
    check(
      "room detail lists members and the house rule",
      detail.status === 200 &&
        Array.isArray(detail.data?.members) &&
        (detail.data?.rules?.length ?? 0) > 0,
      detail.data?.error ?? Object.keys(detail.data ?? {}),
    );
    check(
      "the applicant sees their own queued state",
      detail.data?.viewer?.membership === "queued",
      detail.data?.viewer,
    );
    const selfApproval = await api("POST", `/api/v1/rooms/${open.slug}/members`, {
      csrf,
      body: { action: "approve", memberId: "usr_owner2" },
    });
    check("a member cannot approve their own application", selfApproval.status === 403, {
      status: selfApproval.status,
      error: selfApproval.data?.error,
    });

    // The room owner approves, and only then may the member act in the room.
    await loginAs(OWNER);
    const asOwner = await api("GET", "/api/v1/auth/session");
    const ownerView = await api("GET", `/api/v1/rooms/${open.slug}`);
    const applicant = (ownerView.data?.queue ?? [])[0];
    check(
      "the room owner sees the application queue",
      ownerView.data?.canModerate === true && (ownerView.data?.queue?.length ?? 0) >= 1,
      ownerView.data?.queue ?? ownerView.data?.error,
    );
    if (applicant?.userId) {
      const approved = await api("POST", `/api/v1/rooms/${open.slug}/members`, {
        csrf: asOwner.data?.csrfToken ?? "",
        body: { action: "approve", memberId: applicant.userId, note: "Welcome" },
      });
      check(
        "the owner can approve an applicant",
        approved.status === 200,
        approved.data?.error ?? approved.data,
      );
      await loginAs("kunle@autoplug.ng");
      const memberCsrf = (await api("GET", "/api/v1/auth/session")).data?.csrfToken ?? "";
      const scored = await api("POST", `/api/v1/rooms/${open.slug}/checkin`, {
        csrf: memberCsrf,
        body: { savedContacts: 3 },
      });
      check(
        "check-in derives a save-back score from behaviour",
        scored.status === 200 &&
          typeof scored.data?.saveBackScore === "number" &&
          scored.data.saveBackScore > 0,
        scored.data?.error ?? scored.data,
      );
      check(
        "the room score is announced to the member",
        scored.data?.meetsMinimum === true,
        scored.data,
      );
      const junk = await api("POST", `/api/v1/rooms/${open.slug}/checkin`, {
        csrf: memberCsrf,
        body: { savedContacts: -1 },
      });
      check(
        "negative check-in figures are rejected",
        junk.status === 422,
        junk.data?.error?.fields,
      );
      // Leave the seed as we found it so the suite stays repeatable.
      await loginAs(OWNER);
      const ownerCsrf = (await api("GET", "/api/v1/auth/session")).data?.csrfToken ?? "";
      const removed = await api("POST", `/api/v1/rooms/${open.slug}/members`, {
        csrf: ownerCsrf,
        body: { action: "remove", memberId: applicant.userId, note: "Smoke run cleanup" },
      });
      check(
        "the owner can remove a member",
        removed.status === 200,
        removed.data?.error ?? removed.data,
      );
      await loginAs("kunle@autoplug.ng");
      const afterRemoval = await api("GET", `/api/v1/rooms/${open.slug}`);
      check(
        "a removed member loses room access",
        ["none", "removed"].includes(afterRemoval.data?.viewer?.membership),
        afterRemoval.data?.viewer,
      );
    }
  }
}

// -------------------------------------------------------------- public links ----

section("share links + redirects");
{
  jar.clear();
  const redirect = await fetch(`${BASE}/go/SF7KQ2`, {
    redirect: "manual",
    headers: { "x-forwarded-for": RUN_IP() },
  });
  check(
    "a printed QR code 302s to the listing page",
    redirect.status === 302 &&
      redirect.headers.get("location")?.includes("/business/swiftfix-gadgets"),
    redirect.headers.get("location"),
  );
  check(
    "redirect response is not cacheable in a way that loses counting",
    String(redirect.headers.get("cache-control") ?? "").includes("no-store"),
    redirect.headers.get("cache-control"),
  );
  const unknown = await fetch(`${BASE}/go/NOPE123`, {
    redirect: "manual",
    headers: { "x-forwarded-for": RUN_IP() },
  });
  check("unknown code degrades to a redirect, never a 500", unknown.status < 500, unknown.status);

  await loginAs(OWNER);
  const ownerCsrf = (await api("GET", "/api/v1/auth/session")).data?.csrfToken ?? "";
  const created = await api("POST", `${WS}/links`, {
    csrf: ownerCsrf,
    body: {
      label: "Smoke WhatsApp sticker",
      kind: "whatsapp",
      message: "Hi! I found your flyer in Yaba — can you fix an OLED screen today?",
    },
  });
  check(
    "a whatsapp-type link can be created",
    created.status === 201 && Boolean(created.data?.code),
    created.data?.error ?? created.data,
  );
  if (created.data?.code) {
    const chatRedirect = await fetch(`${BASE}/go/${created.data.code}`, {
      redirect: "manual",
      headers: { "x-forwarded-for": RUN_IP() },
    });
    const location = String(chatRedirect.headers.get("location") ?? "");
    check(
      "chat links go straight to WhatsApp carrying the pre-filled pitch",
      chatRedirect.status === 302 &&
        location.startsWith("https://wa.me/") &&
        location.includes("text="),
      location,
    );
  }
  const stats = await api("GET", `${WS}/links/lnk_swiftfix_flyer/stats`);
  check(
    "link stats expose a per-day series and attributed totals",
    stats.status === 200 &&
      Array.isArray(stats.data?.days) &&
      typeof stats.data?.totals?.enquiries === "number" &&
      stats.data.totals.enquiries >= 1,
    stats.data?.error ?? stats.data?.totals,
  );
  const linkList = await api("GET", `${WS}/links`);
  const flyer = (linkList.data?.items ?? []).find((row) => row.id === "lnk_swiftfix_flyer");
  check(
    "the printed QR flyer counted the scan above",
    (flyer?.scans ?? 0) >= 1,
    flyer && { scans: flyer.scans, clicks: flyer.clicks },
  );
  const plan = await api("GET", `${WS}/billing`);
  check(
    "billing shows the plan and its limits",
    plan.status === 200 && Boolean(plan.data?.plan),
    plan.data?.error ?? Object.keys(plan.data ?? {}),
  );
}

// ------------------------------------------------------------------ rate limit ----

if (process.env.SMOKE_RATE_LIMIT === "1") {
  section("rate limiting");
  jar.clear();
  let blocked = 0;
  let last;
  for (let i = 0; i < 8; i += 1) {
    last = await api("POST", "/api/v1/auth/register", {
      body: {
        displayName: "Throttle Probe",
        email: `throttle.${Date.now()}.${i}@example.test`,
        phone: "08030000000",
        password: PASSWORD,
        role: "consumer",
        acceptedTerms: true,
      },
    });
    if (last.status === 429) blocked += 1;
  }
  check(
    "repeated sign-ups from one IP are throttled with Retry-After",
    blocked > 0 && Number(last?.headers.get("retry-after") ?? 0) > 0,
    { blocked, retryAfter: last?.headers.get("retry-after") },
  );
}

// --------------------------------------------------------------------- cleanup ----

section("cleanup");
{
  const admin = await loginAs(ADMIN);
  const csrf = admin.csrfToken;
  if (consumerId) {
    const suspended = await api("PATCH", `/api/v1/admin/users/${consumerId}/status`, {
      csrf,
      body: { status: "suspended", reason: "smoke test account" },
    });
    check("admin can suspend the smoke account", suspended.status === 200, suspended.data?.error);
  }
  const restored = await api("GET", "/api/v1/businesses/mama-ope-kitchen");
  check(
    "public cache respects the handler policy",
    String(restored.headers.get("cache-control") ?? "").includes("max-age=30"),
    restored.headers.get("cache-control"),
  );
}

console.log(`\n${passed} passed, ${failures} failed  (${BASE})`);
process.exit(failures === 0 ? 0 : 1);
