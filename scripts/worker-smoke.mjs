import { execFileSync, spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const port = Number(process.env.SMOKE_PORT ?? 8799);
const base = `http://127.0.0.1:${port}`;
const allowedOrigin = "http://localhost:5173";
const runId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
const clientIp = `198.51.100.${10 + Math.floor(Math.random() * 200)}`;
const fixtureBusinessId = "11111111-1111-4111-8111-111111111111";
let cookie = "";
let checks = 0;
let logs = "";

const wranglerCli = fileURLToPath(
  new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url),
);
const worker = spawn(
  process.execPath,
  [
    wranglerCli,
    "dev",
    "--config",
    "wrangler.jsonc",
    "--env=",
    "--port",
    String(port),
    "--ip",
    "127.0.0.1",
  ],
  {
    cwd: process.cwd(),
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    stdio: ["ignore", "pipe", "pipe"],
  },
);

for (const stream of [worker.stdout, worker.stderr]) {
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    logs = `${logs}${chunk}`.slice(-12_000);
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (worker.exitCode !== null)
      throw new Error(`Wrangler exited early (${worker.exitCode}).\n${logs}`);
    try {
      const response = await fetch(`${base}/health`);
      if (response.ok) return;
    } catch {
      // Wrangler is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for the Worker.\n${logs}`);
}

async function request(
  path,
  {
    method = "GET",
    body,
    rawBody,
    expected = 200,
    authenticated = false,
    intent = false,
    headers = {},
  } = {},
) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set("CF-Connecting-IP", clientIp);
  if (body !== undefined) requestHeaders.set("Content-Type", "application/json");
  if (authenticated && cookie) requestHeaders.set("Cookie", cookie);
  if (intent) {
    requestHeaders.set("Origin", allowedOrigin);
    requestHeaders.set("X-GainHub-Intent", "web");
  }
  const response = await fetch(`${base}${path}`, {
    method,
    headers: requestHeaders,
    body: rawBody ?? (body === undefined ? undefined : JSON.stringify(body)),
  });
  const payload = await response.json();
  assert(
    response.status === expected,
    `${method} ${path}: expected ${expected}, got ${response.status}\n${JSON.stringify(payload)}`,
  );
  assert(response.headers.get("x-request-id"), `${method} ${path}: missing request ID`);
  assert(
    response.headers.get("x-content-type-options") === "nosniff",
    `${method} ${path}: missing nosniff header`,
  );
  checks += 1;
  return { response, payload };
}

function promoteLocalUser(email) {
  const safeEmail = email.replaceAll("'", "''");
  execFileSync(
    process.execPath,
    [
      wranglerCli,
      "d1",
      "execute",
      "gainhub-development",
      "--local",
      "--config",
      "wrangler.jsonc",
      "--command",
      `UPDATE users SET role = 'platform_admin' WHERE email = '${safeEmail}'`,
    ],
    { cwd: process.cwd(), env: { ...process.env, WRANGLER_SEND_METRICS: "false" }, stdio: "pipe" },
  );
}

try {
  await waitUntilReady();

  let result = await request("/health");
  assert(result.payload.data.status === "ok", "Health check is not OK");
  assert(result.payload.data.environment === "development", "Unexpected Worker environment");

  const preflight = await fetch(`${base}/v1/enquiries`, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type,x-gainhub-intent,idempotency-key",
      "CF-Connecting-IP": clientIp,
    },
  });
  assert(preflight.status === 204, `CORS preflight returned ${preflight.status}`);
  assert(
    preflight.headers.get("access-control-allow-origin") === allowedOrigin,
    "CORS origin was not reflected",
  );
  assert(
    preflight.headers.get("access-control-allow-credentials") === "true",
    "Credentialed CORS was not enabled",
  );
  checks += 1;

  result = await request("/v1/categories");
  assert(result.payload.data.length === 12, "Expected the 12 seeded categories");

  result = await request("/v1/businesses?q=demo&page=1&pageSize=2");
  assert(result.payload.data.items.length === 2, "Directory pagination did not return two items");
  assert(result.payload.data.pagination.total === 3, "Expected three local fixture businesses");

  result = await request("/v1/businesses?q=screen%20replacement");
  assert(
    result.payload.data.items.some((business) => business.slug === "demo-swiftfix"),
    "Directory search did not match an active service name",
  );

  result = await request("/v1/sitemap");
  assert(
    result.payload.data.businesses.some((business) => business.slug === "demo-swiftfix"),
    "Published businesses were missing from sitemap data",
  );
  assert(Array.isArray(result.payload.data.rooms), "Sitemap room data was malformed");

  result = await request(`/v1/businesses/${fixtureBusinessId}/reviews`);
  assert(result.payload.data.items.length === 3, "Published fixture reviews were not readable");
  assert(result.payload.data.summary.total === 3, "Review summary did not count published reviews");
  assert(
    Math.abs(result.payload.data.summary.average - 4.67) < 0.01,
    `Review average was not derived from the reviews: ${result.payload.data.summary.average}`,
  );
  assert(
    result.payload.data.items.every((review) => review.authorName.length > 0),
    "Published reviews were missing their author",
  );

  result = await request(`/v1/businesses/${fixtureBusinessId}/related`);
  assert(result.payload.data.length > 0, "Related businesses were not returned");
  assert(
    !result.payload.data.some((business) => business.id === fixtureBusinessId),
    "Related businesses included the business itself",
  );

  result = await request("/v1/suggest?q=repair");
  assert(result.payload.data.items.length > 0, "Search suggestions were empty");
  assert(
    result.payload.data.items.some((item) => item.type === "category"),
    "Search suggestions did not include taxonomy matches",
  );

  result = await request("/v1/suggest?q=%20");
  assert(result.payload.data.items.length === 0, "Short suggestion queries must not fan out");

  result = await request(`/v1/businesses/${fixtureBusinessId}`);
  assert(result.payload.data.name === "SwiftFix Lab — demo", "Business lookup by ID failed");
  assert(result.payload.data.services.length === 3, "Business services were not included");
  assert(result.payload.data.hours.length === 7, "Business opening hours were not included");
  assert(
    result.payload.data.hours.every((entry) => entry.label.length > 0),
    "Opening hours were missing their day labels",
  );
  assert(
    Array.isArray(result.payload.data.amenities) && result.payload.data.amenities.length > 0,
    "Published profile amenities were not returned",
  );

  result = await request("/v1/auth/register", { method: "POST", body: {}, expected: 403 });
  assert(
    result.payload.error.code === "REQUEST_INTENT_REQUIRED",
    "Mutation intent guard did not run",
  );

  result = await request("/v1/auth/register", {
    method: "POST",
    body: {},
    expected: 403,
    headers: { Origin: "https://untrusted.example", "X-GainHub-Intent": "web" },
  });
  assert(result.payload.error.code === "ORIGIN_NOT_ALLOWED", "Origin guard did not run");

  result = await request("/v1/auth/register", {
    method: "POST",
    body: { fullName: "A", email: "not-an-email", password: "weak", acceptedTerms: true },
    expected: 422,
    intent: true,
  });
  assert(result.payload.error.code === "VALIDATION_ERROR", "Invalid registration was not rejected");
  assert(typeof result.payload.error.fields === "object", "Validation fields were not returned");

  const email = `smoke-${runId}@example.com`;
  const phone = `080${String(Date.now()).slice(-8)}`;
  result = await request("/v1/auth/register", {
    method: "POST",
    body: {
      fullName: "Smoke Test User",
      email,
      phone,
      password: "A-long-safe-passphrase-2026",
      acceptedTerms: true,
    },
    expected: 201,
    intent: true,
  });
  assert(
    result.payload.data.user.email === email,
    "Registration identity was not normalized as expected",
  );
  const setCookie = result.response.headers.get("set-cookie") ?? "";
  assert(setCookie.includes("__Host-gh_session="), "Session cookie was not set");
  assert(
    setCookie.includes("HttpOnly") &&
      setCookie.includes("Secure") &&
      setCookie.includes("SameSite=Lax"),
    "Session cookie flags are incomplete",
  );
  cookie = setCookie.split(";", 1)[0];

  result = await request("/v1/auth/session", { authenticated: true });
  assert(result.payload.data.user.email === email, "Authenticated session was not restored");

  result = await request("/v1/me/saved-businesses", {
    method: "PUT",
    body: { businessId: fixtureBusinessId, saved: true },
    authenticated: true,
    intent: true,
  });
  assert(result.payload.data.saved === true, "Save operation did not return the new state");

  result = await request("/v1/me/saved-businesses", { authenticated: true });
  assert(
    result.payload.data.items.some((business) => business.id === fixtureBusinessId),
    "Saved listing was not returned",
  );

  result = await request("/v1/me/saved-businesses", {
    method: "PUT",
    body: { businessId: "99999999-9999-4999-8999-999999999999", saved: true },
    authenticated: true,
    intent: true,
    expected: 404,
  });
  assert(
    result.payload.error.code === "NOT_FOUND",
    "Saving a missing listing did not produce a structured 404",
  );

  result = await request("/v1/reviews", {
    method: "POST",
    body: {
      businessId: fixtureBusinessId,
      rating: 5,
      body: `Integration review ${runId} contains enough detail to pass validation.`,
    },
    authenticated: true,
    intent: true,
    expected: 201,
  });
  assert(result.payload.data.status === "pending", "Review bypassed moderation");
  const reviewId = result.payload.data.id;

  result = await request("/v1/data-requests", {
    method: "POST",
    body: { kind: "access", details: "Local integration test request." },
    authenticated: true,
    intent: true,
    expected: 201,
  });
  assert(result.payload.data.status === "open", "Data request was not queued");
  const dataRequestId = result.payload.data.id;

  result = await request("/v1/listing-applications", {
    method: "POST",
    body: {
      ownerName: "Smoke Test User",
      email,
      businessName: `Smoke Test Repairs ${runId}`,
      tagline: "Local device repair with written quotes",
      categorySlug: "phone-gadgets",
      locationSlug: "lagos",
      address: "12 Local Test Road, Ikeja",
      whatsapp: phone,
      phone,
      website: "https://example.com",
      about:
        "A local-only integration fixture with enough accurate description to validate the complete listing moderation workflow.",
      acceptedTerms: true,
      company: "",
    },
    authenticated: true,
    intent: true,
    expected: 201,
  });
  const listingApplicationId = result.payload.data.id;

  result = await request("/v1/suggestions", {
    method: "POST",
    body: {
      type: "correction",
      categorySlug: "phone-gadgets",
      businessName: "SwiftFix Lab — demo",
      phone: "",
      address: "",
      details: "The local integration test is exercising the complete suggestion review workflow.",
      contactEmail: email,
      company: "",
    },
    authenticated: true,
    intent: true,
    expected: 201,
  });
  const suggestionId = result.payload.data.id;

  result = await request("/v1/reports", {
    method: "POST",
    body: {
      targetType: "business",
      targetId: fixtureBusinessId,
      reason: "incorrect",
      details:
        "This local integration report tests structured moderation without alleging real misconduct.",
      contactEmail: email,
      company: "",
    },
    authenticated: true,
    intent: true,
    expected: 201,
  });
  const reportId = result.payload.data.id;

  result = await request("/v1/rooms", {
    method: "POST",
    body: {
      name: `Local Repair Circle ${runId}`,
      purpose: "network",
      state: "Lagos",
      slotLimit: 20,
      rules:
        "Members opt in, use contacts only for this professional purpose, avoid spam and respect every withdrawal request.",
      verifiedOnly: false,
    },
    authenticated: true,
    intent: true,
    expected: 201,
  });
  const roomId = result.payload.data.id;

  const disguisedFile = new FormData();
  disguisedFile.set("businessId", fixtureBusinessId);
  disguisedFile.set("claimantRole", "Authorised test owner");
  disguisedFile.set(
    "details",
    "A deliberately invalid file signature used by the local integration test.",
  );
  disguisedFile.set("evidence", new Blob(["not really a png"], { type: "image/png" }), "fake.png");
  result = await request("/v1/claims", {
    method: "POST",
    rawBody: disguisedFile,
    authenticated: true,
    intent: true,
    expected: 422,
  });
  assert(result.payload.error.code === "INVALID_FILE", "Disguised claim evidence was accepted");

  const validFile = new FormData();
  validFile.set("businessId", fixtureBusinessId);
  validFile.set("claimantRole", "Authorised test owner");
  validFile.set(
    "details",
    "Local-only evidence used to validate private R2-compatible claim storage.",
  );
  validFile.set(
    "evidence",
    new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], {
      type: "image/png",
    }),
    "evidence.png",
  );
  result = await request("/v1/claims", {
    method: "POST",
    rawBody: validFile,
    authenticated: true,
    intent: true,
    expected: 201,
  });
  const claimId = result.payload.data.id;

  const duplicateClaim = new FormData();
  duplicateClaim.set("businessId", fixtureBusinessId);
  duplicateClaim.set("claimantRole", "Authorised test owner");
  duplicateClaim.set(
    "details",
    "A duplicate active claim that must be rejected before file storage.",
  );
  duplicateClaim.set(
    "evidence",
    new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])], {
      type: "image/png",
    }),
    "duplicate.png",
  );
  result = await request("/v1/claims", {
    method: "POST",
    rawBody: duplicateClaim,
    authenticated: true,
    intent: true,
    expected: 409,
  });
  assert(result.payload.error.code === "CLAIM_EXISTS", "A duplicate active claim was accepted");

  const idempotencyKey = `smoke-enquiry-${runId}`;
  const enquiry = {
    businessId: fixtureBusinessId,
    name: "Smoke Test User",
    phone: "08019998877",
    message: "I would like a written quote for a screen repair this week.",
    consent: true,
  };
  result = await request("/v1/enquiries", {
    method: "POST",
    body: enquiry,
    authenticated: true,
    intent: true,
    expected: 201,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  const enquiryId = result.payload.data.id;
  result = await request("/v1/enquiries", {
    method: "POST",
    body: enquiry,
    authenticated: true,
    intent: true,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  assert(
    result.payload.data.id === enquiryId && result.payload.data.duplicate === true,
    "Enquiry retry was not idempotent",
  );

  result = await request("/v1/events/contact", {
    method: "POST",
    body: { businessId: fixtureBusinessId, channel: "whatsapp", source: "integration-test" },
    intent: true,
    expected: 202,
  });
  assert(result.payload.data.recorded === true, "Contact event was not accepted");

  result = await request("/v1/events/contact", {
    method: "POST",
    body: { businessId: "99999999-9999-4999-8999-999999999999", channel: "phone" },
    intent: true,
    expected: 404,
  });
  assert(
    result.payload.error.code === "NOT_FOUND",
    "Missing contact target did not return a structured 404",
  );

  result = await request("/v1/workspace/summary", { expected: 401 });
  assert(result.payload.error.code === "AUTH_REQUIRED", "Private workspace was not protected");

  result = await request("/v1/admin/queue", { authenticated: true, expected: 403 });
  assert(result.payload.error.code === "FORBIDDEN", "Consumer account could access admin records");

  promoteLocalUser(email);
  result = await request("/v1/auth/session", { authenticated: true });
  assert(
    result.payload.data.user.role === "platform_admin",
    "Local admin promotion was not visible",
  );

  result = await request("/v1/admin/queue", { authenticated: true });
  for (const [queueName, id] of Object.entries({
    listing_applications: listingApplicationId,
    claims: claimId,
    reports: reportId,
    reviews: reviewId,
    rooms: roomId,
    suggestions: suggestionId,
    data_requests: dataRequestId,
  })) {
    assert(
      result.payload.data.items[queueName].some((item) => item.id === id),
      `${queueName} did not reach the admin queue`,
    );
  }

  const evidenceResponse = await fetch(`${base}/v1/admin/claims/${claimId}/evidence`, {
    headers: { Cookie: cookie, "CF-Connecting-IP": clientIp },
  });
  assert(
    evidenceResponse.status === 200,
    `Private claim evidence returned ${evidenceResponse.status}`,
  );
  assert(
    evidenceResponse.headers.get("content-disposition")?.startsWith("attachment;"),
    "Claim evidence was not forced to download",
  );
  const evidenceBytes = new Uint8Array(await evidenceResponse.arrayBuffer());
  assert(
    evidenceBytes[0] === 0x89 && evidenceBytes[1] === 0x50,
    "Claim evidence changed in storage",
  );
  checks += 1;

  const moderate = (queueName, id, action, note = "") =>
    request(`/v1/admin/moderation/${queueName}/${id}`, {
      method: "PATCH",
      body: { action, note },
      authenticated: true,
      intent: true,
    });

  result = await moderate("listing_applications", listingApplicationId, "approve");
  const publishedBusinessId = result.payload.data.businessId;
  assert(publishedBusinessId, "Listing approval did not create a business");

  await moderate("reviews", reviewId, "approve");
  await moderate("claims", claimId, "start_review");
  await moderate("claims", claimId, "approve");
  await moderate("reports", reportId, "start_review");
  await moderate(
    "reports",
    reportId,
    "resolve",
    "Reviewed as a harmless local integration fixture.",
  );
  await moderate("suggestions", suggestionId, "approve");
  await moderate("data_requests", dataRequestId, "mark_verifying");
  await moderate("data_requests", dataRequestId, "mark_processing");
  await moderate(
    "data_requests",
    dataRequestId,
    "complete",
    "Completed only as part of the isolated local integration test.",
  );
  await moderate("rooms", roomId, "approve");

  result = await request(`/v1/businesses/${publishedBusinessId}`);
  assert(
    result.payload.data.name.startsWith("Smoke Test Repairs"),
    "Approved listing was not published",
  );

  result = await request("/v1/room-applications", {
    method: "POST",
    body: { roomId, businessId: publishedBusinessId, acceptedRules: true },
    authenticated: true,
    intent: true,
    expected: 201,
  });
  const roomApplicationId = result.payload.data.id;
  await moderate("room_applications", roomApplicationId, "approve");

  result = await request(`/v1/rooms/${roomId}`);
  assert(result.payload.data.memberCount === 1, "Approved circle membership was not counted");

  result = await request("/v1/workspace/summary", { authenticated: true });
  assert(
    result.payload.data.businesses.some((business) => business.id === publishedBusinessId),
    "Approved listing was not linked to its signed-in applicant",
  );
  assert(
    result.payload.data.enquiries.some(
      (workspaceEnquiry) =>
        workspaceEnquiry.id === enquiryId && workspaceEnquiry.phone === "+2348019998877",
    ),
    "Approved ownership did not expose the consented enquiry to the owner workspace",
  );

  result = await request(`/v1/workspace/enquiries/${enquiryId}`, {
    method: "PATCH",
    body: { status: "contacted" },
    authenticated: true,
    intent: true,
  });
  assert(result.payload.data.status === "contacted", "Owner could not update an enquiry status");

  result = await request(`/v1/workspace/businesses/${fixtureBusinessId}`, {
    authenticated: true,
  });
  assert(result.payload.data.slug === "demo-swiftfix", "Owner could not read a managed listing");

  result = await request(`/v1/workspace/businesses/${fixtureBusinessId}`, {
    method: "PATCH",
    body: {
      businessId: fixtureBusinessId,
      tagline: "Same-day phone and laptop repairs in Ikeja",
      about:
        "An owner-managed description used by the local integration test to prove the workspace edit path persists end to end.",
      whatsapp: "+2348000000001",
      phone: "+2348000000001",
      website: "https://example.com",
      address: "14 Obafemi Awolowo Way, Ikeja, Lagos",
      priceRange: "\u20a6\u20a6",
      amenities: ["Walk-in welcome", "Card payment"],
      serviceAreas: ["Ikeja", "Ogba"],
      socials: [{ label: "Instagram", handle: "@swiftfix.demo" }],
      hours: [
        { dayOfWeek: 1, isClosed: false, opensAt: "09:00", closesAt: "19:00" },
        { dayOfWeek: 3, isClosed: false, opensAt: "09:00", closesAt: "19:00" },
      ],
      services: [{ name: "Diagnostic check", price: "Free", note: "Quote first" }],
    },
    authenticated: true,
    intent: true,
  });
  assert(result.payload.data.id === fixtureBusinessId, "Owner edit did not persist");

  result = await request(`/v1/businesses/${fixtureBusinessId}`);
  assert(
    result.payload.data.services.length === 1 &&
      result.payload.data.services[0].name === "Diagnostic check",
    "Owner service edits were not reflected publicly",
  );
  assert(result.payload.data.hours.length === 2, "Owner opening-hours edits did not persist");

  result = await request(`/v1/workspace/businesses/${fixtureBusinessId}`, {
    method: "PATCH",
    body: {
      businessId: fixtureBusinessId,
      tagline: "Same-day phone and laptop repairs in Ikeja",
      about:
        "An owner-managed description used by the local integration test to prove the workspace edit path persists end to end.",
      whatsapp: "+2348000000001",
      address: "14 Obafemi Awolowo Way, Ikeja, Lagos",
      hours: [
        { dayOfWeek: 1, isClosed: false, opensAt: "09:00", closesAt: "19:00" },
        { dayOfWeek: 1, isClosed: false, opensAt: "11:00", closesAt: "15:00" },
      ],
    },
    authenticated: true,
    intent: true,
    expected: 422,
  });
  assert(
    result.payload.error.fields?.hours === "Each day may only appear once",
    "Duplicate opening-hours days were accepted",
  );

  result = await request("/v1/workspace/insights?days=30", { authenticated: true });
  assert(result.payload.data.totals.contacts >= 1, "Contact analytics did not count the event");
  assert(
    result.payload.data.byBusiness.some((business) => business.id === fixtureBusinessId),
    "Contact analytics omitted the managed business",
  );

  result = await request("/v1/workspace/rooms", { authenticated: true });
  assert(
    result.payload.data.owned.some((room) => room.id === roomId),
    "Owned contact circles were not returned",
  );

  result = await request("/v1/notifications", { authenticated: true });
  assert(result.payload.data.unreadCount > 0, "Workflow notifications were not created");
  assert(
    result.payload.data.items.some((item) => item.kind === "listing.approved"),
    "Listing approval did not notify the applicant",
  );

  result = await request("/v1/notifications/read", {
    method: "POST",
    body: { all: true },
    authenticated: true,
    intent: true,
  });
  result = await request("/v1/notifications", { authenticated: true });
  assert(result.payload.data.unreadCount === 0, "Marking notifications read did not persist");

  result = await request("/v1/me", {
    method: "PATCH",
    body: { fullName: "Smoke Test Renamed", email, phone },
    authenticated: true,
    intent: true,
  });
  assert(result.payload.data.user.fullName === "Smoke Test Renamed", "Profile update failed");

  result = await request("/v1/auth/change-password", {
    method: "POST",
    body: {
      currentPassword: "A-long-safe-passphrase-2026",
      newPassword: "A-renewed-safe-passphrase-2026",
    },
    authenticated: true,
    intent: true,
  });
  assert(result.payload.data.changed === true, "Password change failed");

  result = await request("/v1/auth/change-password", {
    method: "POST",
    body: {
      currentPassword: "A-long-safe-passphrase-2026",
      newPassword: "Another-safe-passphrase-2026",
    },
    authenticated: true,
    intent: true,
    expected: 400,
  });
  assert(
    result.payload.error.code === "INVALID_CREDENTIALS",
    "Password change accepted a stale current password",
  );

  result = await request("/v1/admin/queue", { authenticated: true });
  assert(
    !result.payload.data.items.reviews.some((item) => item.id === reviewId) &&
      !result.payload.data.items.listing_applications.some(
        (item) => item.id === listingApplicationId,
      ),
    "Completed moderation records remained in active queues",
  );

  const scheduled = await fetch(`${base}/cdn-cgi/local/scheduled`, {
    headers: { "CF-Connecting-IP": clientIp },
  });
  assert(scheduled.ok, `Scheduled retention handler returned ${scheduled.status}`);
  checks += 1;

  result = await request("/v1/auth/logout", { method: "POST", authenticated: true, intent: true });
  assert(result.payload.data.signedOut === true, "Logout did not complete");

  result = await request("/v1/auth/session", { authenticated: true });
  assert(result.payload.data.user === null, "Revoked session remained active");

  result = await request("/v1/auth/forgot-password", {
    method: "POST",
    body: { identity: email },
    intent: true,
  });
  assert(result.payload.data.accepted === true, "Password reset request was rejected");
  assert(
    typeof result.payload.data.devResetLink === "string" &&
      result.payload.data.devResetLink.includes("reset="),
    "Development reset link was not returned when no mail provider exists",
  );
  const resetToken = result.payload.data.devResetLink.split("reset=")[1];

  const unknownIdentity = await request("/v1/auth/forgot-password", {
    method: "POST",
    body: { identity: `nobody-${runId}@example.com` },
    intent: true,
  });
  assert(
    unknownIdentity.payload.data.accepted === true &&
      unknownIdentity.payload.data.devResetLink === undefined,
    "Password reset leaked account existence",
  );

  result = await request(`/v1/auth/reset-password/${resetToken}`);
  assert(result.payload.data.valid === true, "Issued reset token did not validate");
  assert(
    result.payload.data.identity.includes("***"),
    "Reset validation returned an unmasked identity",
  );

  result = await request("/v1/auth/reset-password", {
    method: "POST",
    body: { token: "a".repeat(43), password: "Another-safe-passphrase-2026" },
    intent: true,
    expected: 400,
  });
  assert(
    result.payload.error.code === "INVALID_RESET_TOKEN",
    "An unknown reset token was accepted",
  );

  result = await request("/v1/auth/reset-password", {
    method: "POST",
    body: { token: resetToken, password: "A-third-safe-passphrase-2026" },
    intent: true,
  });
  assert(result.payload.data.reset === true, "Password reset did not complete");

  result = await request("/v1/auth/reset-password", {
    method: "POST",
    body: { token: resetToken, password: "A-fourth-safe-passphrase-2026" },
    intent: true,
    expected: 400,
  });
  assert(result.payload.error.code === "INVALID_RESET_TOKEN", "A consumed reset token was reused");

  result = await request("/v1/auth/login", {
    method: "POST",
    body: { identity: email, password: "A-renewed-safe-passphrase-2026" },
    intent: true,
    expected: 401,
  });
  assert(
    result.payload.error.code === "INVALID_CREDENTIALS",
    "Reset did not invalidate the previous password",
  );

  result = await request("/v1/auth/login", {
    method: "POST",
    body: { identity: email, password: "A-third-safe-passphrase-2026" },
    intent: true,
  });
  assert(result.payload.data.user.email === email, "Sign-in with the new password failed");

  console.log(`Worker integration smoke test passed (${checks} HTTP checks).`);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  console.error("\nWrangler log tail:\n", logs);
  process.exitCode = 1;
} finally {
  worker.kill("SIGTERM");
  await Promise.race([
    new Promise((resolve) => worker.once("exit", resolve)),
    new Promise((resolve) => setTimeout(resolve, 3_000)),
  ]);
  if (worker.exitCode === null) worker.kill("SIGKILL");
}
