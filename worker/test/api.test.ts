/* eslint-disable @typescript-eslint/no-explicit-any -- the assertions below read JSON
 * bodies whose exact key set is the thing under test; a typed DTO would duplicate
 * shared/api.ts and then go stale in the one place that should notice a shape change. */

/**
 * HTTP contract + authorisation tests against a real D1, KV and R2 in workerd.
 *
 * These exist because the things most likely to break in this product are invisible to a
 * typechecker and to unit tests: a missing membership check, a trigger that stops
 * maintaining a derived count, a cache that returns another user's private payload, a
 * partial update that blanks an untouched field. Each test below failed at least once while
 * the corresponding handler was being written — they are regressions, not decoration.
 *
 * Storage here is isolated per file and built from the real migrations (including their
 * triggers), so `rating_avg` assertions are the *database's* answer, not a fixture's.
 */
import { env } from "cloudflare:workers";
import { beforeAll, describe, expect, it } from "vitest";
import migrations0001 from "../migrations/0001_identity.sql?raw";
import migrations0002 from "../migrations/0002_directory.sql?raw";
import migrations0003 from "../migrations/0003_crm.sql?raw";
import migrations0004 from "../migrations/0004_safety.sql?raw";
import migrations0005 from "../migrations/0005_billing_ops.sql?raw";
import worker from "../src/index.ts";
import { hashPassword } from "../src/crypto.ts";

const PASSWORD = "Gainhub123!";
const ORIGIN = "http://localhost:8787";

const bindings = env as unknown as Cloudflare.Env;

type Body = any;

const execution = {
  waitUntil: (_promise: Promise<unknown>) => undefined,
  passThroughOnException: () => undefined,
} as unknown as ExecutionContext;

async function call(
  method: string,
  path: string,
  options: { body?: unknown; cookie?: string; csrf?: string; ip?: string } = {},
): Promise<{ status: number; headers: Headers; body: Body | null }> {
  const headers = new Headers({ accept: "application/json" });
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.cookie) headers.set("cookie", options.cookie);
  if (options.csrf) headers.set("x-csrf-token", options.csrf);
  // In APP_ENV=test the Worker trusts X-Forwarded-For, which is what lets a single test
  // file exhaust one rate-limit bucket without poisoning the others.
  if (options.ip) headers.set("x-forwarded-for", options.ip);

  const init: RequestInit = { method, headers };
  if (options.body !== undefined) init.body = JSON.stringify(options.body);
  const response = await worker.fetch(new Request(ORIGIN + path, init), bindings, execution);
  const text = await response.text();
  let parsed: Body | null = null;
  try {
    parsed = text ? (JSON.parse(text) as Body) : null;
  } catch {
    parsed = { raw: text };
  }
  return { status: response.status, headers: response.headers, body: parsed };
}

function cookieOf(response: Headers): string {
  const raw = response.getSetCookie?.() ?? [];
  return raw.map((entry) => entry.split(";")[0]).join("; ");
}

/** Signs in through the API so the test exercises the same cookie/CSRF pair a browser has. */
async function signIn(email: string) {
  const res = await call("POST", "/api/v1/auth/login", {
    body: { identifier: email, password: PASSWORD },
  });
  if (res.status !== 200)
    throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = cookieOf(res.headers);
  const csrf = String(res.body?.csrfToken ?? "");
  if (!cookie.includes("gh_session") || !csrf)
    throw new Error(`login response lacked a session or CSRF token`);
  return { cookie, csrf };
}

const now = new Date("2026-09-01T09:00:00Z").toISOString();

async function insertUser(id: string, email: string, role: "consumer" | "owner" | "admin") {
  await bindings.DB.prepare(
    `INSERT INTO users (id, email, email_normalized, password_hash, display_name, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
  )
    .bind(
      id,
      email,
      email.toLowerCase(),
      await hashPassword(PASSWORD),
      email.split("@")[0]!,
      role,
      now,
      now,
    )
    .run();
}

async function insertBusiness(values: {
  id: string;
  slug: string;
  name: string;
  owner: string;
  status: "draft" | "pending" | "published" | "suspended" | "hidden";
  city?: string;
  about?: string;
  verified?: string;
}) {
  await bindings.DB.prepare(
    `INSERT INTO businesses (id, slug, name, owner_user_id, category_id, location_id, city, state, tagline, about,
        status, verified_level, plan, phone, whatsapp, socials_json, amenities_json, service_areas_json,
        profile_complete, published_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'cat_test', 'loc_test', ?, 'Lagos', 'A test listing', ?, ?, ?, 'growth',
        '+2348030000000', '+2348030000000', '[]', '[]', '[]', 100, ?, ?, ?)`,
  )
    .bind(
      values.id,
      values.slug,
      values.name,
      values.owner,
      values.city ?? "Ikeja",
      values.about ??
        "Serves the Ikeja corridor with same-day pickup and a two year workmanship promise.",
      values.status,
      values.verified ?? "email",
      values.status === "published" ? now : null,
      now,
      now,
    )
    .run();
}

const fixture = {
  owner: "usr_test_owner",
  reader: "usr_test_reader",
  stranger: "usr_test_stranger",
  fresh: "usr_test_fresh",
  removed: "usr_test_removed_author",
  biz: "biz_test_pub",
  draft: "biz_test_draft",
  hidden: "biz_test_hidden",
};

async function resetAndMigrate() {
  const statements = [
    migrations0001,
    migrations0002,
    migrations0003,
    migrations0004,
    migrations0005,
  ]
    .flatMap((sql) => String(sql).split("--> statement-breakpoint"))
    .map((chunk) => chunk.replace(/^\s*--.*$/gm, "").trim())
    .filter((chunk) => chunk.length > 0);
  await bindings.DB.batch(statements.map((sql) => bindings.DB.prepare(sql)));

  await bindings.DB.batch([
    bindings.DB.prepare(
      `INSERT INTO categories (id, slug, name, icon, description, checklist_json, required_media_json, sort, is_active, created_at, updated_at)
       VALUES ('cat_test', 'pharmacy', 'Pharmacy', 'Pill', 'Dispensing chemists', '[]', '[]', 1, 1, ?, ?)`,
    ).bind(now, now),
    bindings.DB.prepare(
      `INSERT INTO locations (id, slug, name, state, areas_json, sort, created_at, updated_at)
       VALUES ('loc_test', 'ikeja', 'Ikeja', 'Lagos', '["Computer Village","Obalende"]', 1, ?, ?)`,
    ).bind(now, now),
  ]);

  await insertUser(fixture.owner, "owner.test@example.com", "owner");
  await insertUser(fixture.reader, "reader.test@example.com", "consumer");
  await insertUser(fixture.stranger, "stranger.test@example.com", "consumer");
  await insertUser(fixture.fresh, "fresh.test@example.com", "consumer");
  await insertUser(fixture.removed, "removed.test@example.com", "consumer");

  await insertBusiness({
    id: fixture.biz,
    slug: "kingsway-pharmacy",
    name: "Kingsway Pharmacy",
    owner: fixture.owner,
    status: "published",
  });
  await insertBusiness({
    id: fixture.draft,
    slug: "draft-kingsway-pharmacy",
    name: "Draft Kingsway Pharmacy",
    owner: fixture.reader,
    status: "draft",
  });
  await insertBusiness({
    id: fixture.hidden,
    slug: "hidden-kingsway-pharmacy",
    name: "Hidden Kingsway Pharmacy",
    owner: fixture.reader,
    status: "hidden",
  });

  await bindings.DB.batch([
    bindings.DB.prepare(
      `INSERT INTO memberships (user_id, business_id, role, status, invited_at, joined_at) VALUES (?, ?, 'owner', 'active', ?, ?)`,
    ).bind(fixture.owner, fixture.biz, now, now),
    // Published reviews are what the directory shows; a hidden one must not move the average.
    bindings.DB.prepare(
      `INSERT INTO reviews (id, business_id, author_user_id, rating, body, status, source, created_at, updated_at)
       VALUES ('rev_t1', ?, ?, 5, 'Fast service and the pharmacist actually explained the dosage.', 'published', 'verified_purchase', ?, ?)`,
    ).bind(fixture.biz, fixture.reader, now, now),
    bindings.DB.prepare(
      `INSERT INTO reviews (id, business_id, author_user_id, rating, body, status, source, created_at, updated_at)
       VALUES ('rev_t2', ?, ?, 4, 'Good prices, though the queue before 9am is long most days.', 'published', 'website', ?, ?)`,
    ).bind(fixture.biz, fixture.stranger, now, now),
    bindings.DB.prepare(
      `INSERT INTO reviews (id, business_id, author_user_id, rating, body, status, source, created_at, updated_at)
       VALUES ('rev_t3', ?, ?, 1, 'This one was removed by a moderator and must not be counted.', 'hidden', 'website', ?, ?)`,
    ).bind(fixture.biz, fixture.removed, now, now),
  ]);
}

beforeAll(async () => {
  // Triggers maintain business_search_index; make sure the fixture is actually searchable
  // before any test asserts on a search result.
  await resetAndMigrate();
  const indexed = await bindings.DB.prepare(
    "SELECT COUNT(*) AS n FROM business_search_index WHERE business_id IN (?, ?)",
  )
    .bind(fixture.biz, fixture.draft)
    .first<{ n: number }>();
  expect(indexed?.n).toBeGreaterThan(0);
});

describe("worker wiring", () => {
  it("answers health with a live database round-trip", async () => {
    const res = await call("GET", "/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body?.status).toBe("healthy");
    expect(res.body?.database).toBe("ok");
    // The suite would silently pass against a stale cache if APP_ENV were not "test".
    expect(res.body?.env).toBe("test");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("adds security headers on every response", async () => {
    const res = await call("GET", "/api/v1/health");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("x-frame-options")).toBe("DENY");
    expect(res.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin");
    expect(res.headers.get("permissions-policy")).toContain("camera=()");
  });

  it("404s an unknown route with the shared error envelope", async () => {
    const res = await call("GET", "/api/v1/nope");
    expect(res.status).toBe(404);
    expect(res.body?.error?.code).toBe("not_found");
    // Every error carries an opaque id the user can quote to support; it lives inside
    // `error` so one envelope shape serves both success and failure.
    expect(res.body?.error?.requestId).toBeTypeOf("string");
    expect(res.headers.get("x-request-id")).toBeTypeOf("string");
  });
});

describe("directory visibility", () => {
  it("returns only published listings for a search term that matches all three", async () => {
    const res = await call("GET", "/api/v1/search?q=kingsway");
    expect(res.status).toBe(200);
    const slugs: string[] = res.body?.items.map((row: Body) => row.slug);
    expect(slugs).toContain("kingsway-pharmacy");
    expect(slugs).not.toContain("draft-kingsway-pharmacy");
    expect(slugs).not.toContain("hidden-kingsway-pharmacy");
  });

  it("applies minRating to the trigger-maintained average, not to raw reviews", async () => {
    const passes = await call("GET", "/api/v1/search?q=kingsway&minRating=4");
    expect((passes.body?.items ?? []).length).toBe(1);
    const strict = await call("GET", "/api/v1/search?q=kingsway&minRating=5");
    expect((strict.body?.items ?? []).length).toBe(0);
  });

  it("hides draft and hidden listings on the detail route instead of soft-404ing", async () => {
    expect((await call("GET", "/api/v1/businesses/kingsway-pharmacy")).status).toBe(200);
    for (const slug of [
      "draft-kingsway-pharmacy",
      "hidden-kingsway-pharmacy",
      "does-not-exist-at-all",
    ]) {
      const res = await call("GET", `/api/v1/businesses/${slug}`);
      expect(res.status).toBe(404);
    }
  });

  it("publishes the derived rating the database computed", async () => {
    const res = await call("GET", "/api/v1/businesses/kingsway-pharmacy");
    const business = res.body?.business;
    expect(business.ratingAvg).toBe(4.5);
    expect(business.ratingCount).toBe(2);
  });

  it("keeps the search haystack in sync when a listing is edited in SQL", async () => {
    await bindings.DB.prepare(
      "UPDATE businesses SET name = 'Kingsway Chemist', updated_at = ? WHERE id = ?",
    )
      .bind(now, fixture.biz)
      .run();
    const found = await call("GET", "/api/v1/search?q=chemist");
    expect((found.body?.items as Body[]).map((row) => row.slug)).toContain("kingsway-pharmacy");
    await bindings.DB.prepare(
      "UPDATE businesses SET name = 'Kingsway Pharmacy', updated_at = ? WHERE id = ?",
    )
      .bind(now, fixture.biz)
      .run();
  });

  it("lists the published listing in the sitemap feed and omits the drafts", async () => {
    // Two surfaces, one source of truth: `/api/v1/sitemap` is the JSON payload the frontend
    // consumes for its own XML/static files, `/api/v1/sitemap.xml` is the crawler-facing one.
    const feed = await call("GET", "/api/v1/sitemap");
    expect(feed.status).toBe(200);
    const paths: string[] = (feed.body?.businesses ?? []).map((row: Body) => row.path);
    expect(paths).toContain("/business/kingsway-pharmacy");
    expect(paths).not.toContain("/business/draft-kingsway-pharmacy");
    expect(feed.body?.generatedAt).toBeTypeOf("string");

    const xml = await call("GET", "/api/v1/sitemap.xml");
    expect(xml.status).toBe(200);
    expect(xml.headers.get("content-type")).toContain("application/xml");
    const body = String(xml.body?.raw ?? "");
    expect(body).toContain("<loc>http://localhost:5173/business/kingsway-pharmacy</loc>");
    expect(body).toContain("<lastmod>");
    expect(body).not.toContain("draft-kingsway-pharmacy");
    expect(xml.headers.get("cache-control")).toContain("max-age=3600");
  });
});

describe("reviews", () => {
  it("lets a signed-in reader publish a review and recomputes the aggregate", async () => {
    const session = await signIn("fresh.test@example.com");
    const res = await call("POST", "/api/v1/businesses/kingsway-pharmacy/reviews", {
      body: {
        rating: 3,
        body: "Fine for a quick refill but they did not have the brand I usually take.",
      },
      cookie: session.cookie,
      csrf: session.csrf,
    });
    expect(res.status).toBe(201);
    const detail = await call("GET", "/api/v1/businesses/kingsway-pharmacy");
    const business = detail.body?.business;
    expect(business.ratingCount).toBe(3);
    expect(business.ratingAvg).toBeCloseTo(4, 5);
  });

  it("refuses a second review from the same author instead of overwriting", async () => {
    const session = await signIn("reader.test@example.com");
    const res = await call("POST", "/api/v1/businesses/kingsway-pharmacy/reviews", {
      body: { rating: 5, body: "Trying to post twice on purpose to see what the API does here." },
      cookie: session.cookie,
      csrf: session.csrf,
    });
    expect(res.status).toBe(409);
  });

  it("rejects a review body that is too short with a field-level error", async () => {
    const session = await signIn("stranger.test@example.com");
    const res = await call("POST", "/api/v1/businesses/kingsway-pharmacy/reviews", {
      body: { rating: 5, body: "great" },
      cookie: session.cookie,
      csrf: session.csrf,
    });
    expect(res.status).toBe(422);
    expect(res.body?.error?.fields).toHaveProperty("body");
  });

  it("will not let a non-member post an owner reply (review-fraud regression)", async () => {
    const intruder = await signIn("stranger.test@example.com");
    const res = await call("POST", "/api/v1/reviews/rev_t1/reply", {
      body: { body: "Thanks for the kind words! — the owner, definitely" },
      cookie: intruder.cookie,
      csrf: intruder.csrf,
    });
    expect(res.status).toBe(403);
    const unchanged = await call("GET", "/api/v1/businesses/kingsway-pharmacy/reviews");
    const rows: Body[] = unchanged.body?.items ?? [];
    expect(rows.find((row) => row.id === "rev_t1")?.ownerReply ?? null).toBeNull();
  });

  it("lets a workspace member answer a review", async () => {
    const owner = await signIn("owner.test@example.com");
    const res = await call("POST", "/api/v1/reviews/rev_t1/reply", {
      body: { body: "Thank you — we now stock that brand on request." },
      cookie: owner.cookie,
      csrf: owner.csrf,
    });
    expect(res.status).toBe(200);
    const list = await call("GET", "/api/v1/businesses/kingsway-pharmacy/reviews");
    const replied = (list.body?.items ?? []).find((row: Body) => row.id === "rev_t1");
    expect(replied?.ownerReply).toBe("Thank you — we now stock that brand on request.");
    expect(replied?.ownerReplyAt).toBeTypeOf("string");
  });
});

describe("session and CSRF", () => {
  it("401s a wrong password with the same message as an unknown account", async () => {
    const wrongPassword = await call("POST", "/api/v1/auth/login", {
      body: { identifier: "owner.test@example.com", password: "not-the-password" },
    });
    const unknown = await call("POST", "/api/v1/auth/login", {
      body: { identifier: "ghost@example.com", password: PASSWORD },
    });
    expect(wrongPassword.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPassword.body?.error?.message).toBe(unknown.body?.error?.message);
  });

  it("requires the CSRF token on a state-changing call from a cookie session", async () => {
    const session = await signIn("reader.test@example.com");
    const body = {
      displayName: "Renamed Reader",
      phone: "08030000000",
      marketingOptIn: false,
      showNameOnReviews: true,
      allowBusinessMessaging: false,
    };

    const without = await call("PATCH", "/api/v1/auth/profile", { body, cookie: session.cookie });
    expect(without.status).toBe(403);

    const forged = await call("PATCH", "/api/v1/auth/profile", {
      body,
      cookie: session.cookie,
      csrf: "0000000000000000",
    });
    expect(forged.status).toBe(403);

    const withToken = await call("PATCH", "/api/v1/auth/profile", {
      body,
      cookie: session.cookie,
      csrf: session.csrf,
    });
    expect(withToken.status).toBe(200);
    const user = withToken.body?.user;
    expect(user.displayName).toBe("Renamed Reader");
  });

  it("answers an anonymous session lookup with an empty session, not an error", async () => {
    const res = await call("GET", "/api/v1/auth/session");
    expect(res.status).toBe(200);
    expect(res.body?.user).toBeNull();
    expect(res.body?.csrfToken).toBe("");
    expect(res.headers.get("cache-control")).toContain("no-cache");
  });
});

describe("workspace authorisation", () => {
  it("refuses a non-member and allows the owner on the same profile route", async () => {
    const stranger = await signIn("stranger.test@example.com");
    const owner = await signIn("owner.test@example.com");
    const patch = { tagline: "Now with evening dispensing" };

    const denied = await call("PATCH", `/api/v1/workspaces/${fixture.biz}/profile`, {
      body: patch,
      cookie: stranger.cookie,
      csrf: stranger.csrf,
    });
    expect(denied.status).toBe(403);

    const granted = await call("PATCH", `/api/v1/workspaces/${fixture.biz}/profile`, {
      body: patch,
      cookie: owner.cookie,
      csrf: owner.csrf,
    });
    expect(granted.status).toBe(200);
    const publicView = await call("GET", "/api/v1/businesses/kingsway-pharmacy");
    expect(publicView.body?.business?.tagline).toBe("Now with evening dispensing");

    // And a viewer who is not a member must not be able to read the draft fields of the
    // workspace document (it carries unpublished operational data).
    const privateRead = await call("GET", `/api/v1/workspaces/${fixture.biz}/profile`, {
      cookie: stranger.cookie,
    });
    expect(privateRead.status).toBe(403);
  });

  it("keeps a partial save from blanking fields it did not send", async () => {
    const owner = await signIn("owner.test@example.com");
    const before = await call("GET", `/api/v1/businesses/kingsway-pharmacy`);
    const snapshot = before.body?.business;

    const res = await call("PATCH", `/api/v1/workspaces/${fixture.biz}/profile`, {
      body: {
        about:
          "Rewritten once: the shop now opens at 7am and closes at 10pm for shift workers around Computer Village.",
      },
      cookie: owner.cookie,
      csrf: owner.csrf,
    });
    expect(res.status).toBe(200);

    const after = await call("GET", `/api/v1/businesses/kingsway-pharmacy`);
    const updated = after.body?.business;
    expect(updated.about).toContain("7am");
    expect(updated.name).toBe(snapshot.name);
    expect(updated.phone).toBe(snapshot.phone);
    expect(updated.categorySlug ?? updated.category).toBeTruthy();
  });

  it("401s workspace routes without a session rather than returning empty data", async () => {
    const res = await call("GET", `/api/v1/workspaces/${fixture.biz}/summary`);
    expect(res.status).toBe(401);
  });
});

describe("enquiries become leads", () => {
  it("creates a lead and deduplicates a replayed submission", async () => {
    const payload = {
      businessId: fixture.biz,
      name: "Tolu Adebayo",
      phone: "08031234567",
      email: "tolu@example.com",
      need: "I need a bulk supply of paracetamol syrup for a clinic in Ogba.",
      idempotencyKey: "test-key-0001",
      source: "directory_profile" as const,
    };
    const first = await call("POST", "/api/v1/businesses/kingsway-pharmacy/enquiries", {
      body: payload,
      ip: "203.0.113.91",
    });
    expect(first.status).toBe(201);
    expect(first.body?.enquiryId).toBeTypeOf("string");
    // The CTA in the success card is "message this business", so the link carries the
    // listing's own number with the enquiry pre-filled, not the customer's number.
    expect(String(first.body?.whatsappUrl)).toContain(
      "wa.me/2348030000000?text=Enquiry%20from%20Tolu",
    );

    const replay = await call("POST", "/api/v1/businesses/kingsway-pharmacy/enquiries", {
      body: payload,
      ip: "203.0.113.91",
    });
    expect(replay.status).toBe(200);
    expect(replay.body?.enquiryId).toBe(first.body?.enquiryId);
    expect(replay.body?.deduplicated).toBe(true);
  });

  it("accepts an anonymous report and returns a reference", async () => {
    const res = await call("POST", "/api/v1/businesses/kingsway-pharmacy/report", {
      body: {
        targetType: "business",
        targetId: fixture.biz,
        reason: "other",
        detail: "The opening hours on the page look wrong.",
      },
      ip: "203.0.113.92",
    });
    expect(res.status).toBe(201);
    expect(String(res.body?.reference)).toMatch(/^GH-/);
  });
});

describe("abuse controls", () => {
  it("throttles sign-ups per IP and tells the client how long to wait", async () => {
    const ip = "203.0.113.77";
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const res = await call("POST", "/api/v1/auth/register", {
        ip,
        body: {
          displayName: `Throttle ${i}`,
          email: `throttle${i}@example.com`,
          phone: `0803111${1000 + i}`,
          password: PASSWORD,
          role: "consumer",
          acceptedTerms: true,
        },
      });
      statuses.push(res.status);
      if (res.status === 429) {
        expect(Number(res.headers.get("retry-after"))).toBeGreaterThan(0);
        break;
      }
    }
    expect(statuses[statuses.length - 1]).toBe(429);
    // A different visitor is unaffected: the bucket is per identity, not global.
    const other = await call("POST", "/api/v1/auth/register", {
      ip: "203.0.113.78",
      body: {
        displayName: "Elsewhere",
        email: "elsewhere@example.com",
        phone: "08031119999",
        password: PASSWORD,
        role: "consumer",
        acceptedTerms: true,
      },
    });
    expect(other.status).toBe(201);
  });

  it("refuses a registration whose phone number is not a Nigerian mobile line", async () => {
    const res = await call("POST", "/api/v1/auth/register", {
      ip: "203.0.113.79",
      body: {
        displayName: "Bad Number",
        email: "badphone@example.com",
        phone: "0123 4567",
        password: PASSWORD,
        role: "consumer",
        acceptedTerms: true,
      },
    });
    expect(res.status).toBe(422);
    expect(res.body?.error?.fields).toHaveProperty("phone");
  });

  it("does not serve media objects that were never uploaded", async () => {
    // `/media/:id` is mounted at the API root because `mediaUrl()` emits an absolute
    // `${API_URL}/media/…`; only `/api/v1/*` is proxied by the frontend.
    await bindings.DB.prepare(
      `INSERT INTO media (id, business_id, kind, r2_key, content_type, size_bytes, width, height, moderation_status, created_at)
       VALUES ('med_missing', ?, 'cover', 'biz_test_pub/med_missing.png', 'image/png', 1200, 1200, 630, 'approved', ?)`,
    )
      .bind(fixture.biz, now)
      .run();
    const res = await call("GET", "/media/med_missing");
    // The row exists but the R2 object does not: the API must not promise bytes it cannot give.
    expect(res.status).toBe(404);
  });

  it("keeps an unmoderated image off the public URL until a member asks for it", async () => {
    await bindings.DB.prepare(
      `INSERT INTO media (id, business_id, kind, r2_key, content_type, size_bytes, moderation_status, created_at)
       VALUES ('med_pending', ?, 'shop', 'biz_test_pub/med_pending.png', 'image/png', 900, 'pending', ?)`,
    )
      .bind(fixture.biz, now)
      .run();
    const anonymous = await call("GET", "/media/med_pending");
    // 401, not 403: the API's convention is "we do not know who you are" (same as the
    // workspace routes), which is what makes the frontend redirect to sign-in.
    expect(anonymous.status).toBe(401);

    const owner = await signIn("owner.test@example.com");
    const member = await call("GET", "/media/med_pending", { cookie: owner.cookie });
    // The gate is open (same id, different caller) and only the missing object stops it now.
    expect(member.status).toBe(404);
  });
});
