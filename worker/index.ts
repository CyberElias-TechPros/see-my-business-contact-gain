import { z, type ZodType } from "zod";
import {
  businessHoursSchema,
  changePasswordSchema,
  dataRequestSchema,
  directoryQuerySchema,
  enquirySchema,
  enquiryStatusSchema,
  forgotPasswordSchema,
  listingApplicationSchema,
  loginSchema,
  moderationActionSchema,
  notificationsReadSchema,
  registerSchema,
  reportSchema,
  resetPasswordSchema,
  reviewSchema,
  reviewUpdateSchema,
  roomApplicationDecisionSchema,
  roomApplicationSchema,
  roomProposalSchema,
  saveBusinessSchema,
  suggestionSchema,
  TERMS_VERSION,
  updateBusinessSchema,
  updateProfileSchema,
  type BusinessHoursEntry,
  type PublicBusiness,
  type PublicBusinessHours,
  type SessionUser,
} from "../src/lib/contracts";

interface Env {
  DB: D1Database;
  EVIDENCE: R2Bucket;
  APP_ENV: "development" | "preview" | "production";
  ALLOWED_ORIGINS: string;
  IP_HASH_SALT?: string;
  PROXY_SHARED_SECRET?: string;
}

interface AppContext {
  env: Env;
  request: Request;
  url: URL;
  requestId: string;
  ip: string;
}

interface AuthContext extends AppContext {
  user: SessionUser;
}

type JsonRecord = Record<string, unknown>;
type DbUser = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: SessionUser["role"];
  password_hash: string;
  password_salt: string;
};

type BusinessRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  about: string;
  category_slug: string;
  category_name: string;
  location_slug: string;
  city: string;
  state: string;
  address: string;
  rating_average: number;
  review_count: number;
  verification_level: PublicBusiness["verificationLevel"];
  is_open_now: number;
  whatsapp: string;
  phone: string;
  website: string;
  price_range?: string;
  amenities_json?: string;
  service_areas_json?: string;
  socials_json?: string;
};

/** Africa/Lagos is UTC+1 all year (no DST), so a fixed offset is exact. */
const LAGOS_OFFSET_MINUTES = 60;
const DAY_LABELS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

function lagosNow(now = new Date()): { dayOfWeek: number; minutes: number } {
  const shifted = new Date(now.getTime() + LAGOS_OFFSET_MINUTES * 60_000);
  return {
    dayOfWeek: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

function timeToMinutes(value: string): number {
  const [hours = "0", minutes = "0"] = value.split(":");
  return Number(hours) * 60 + Number(minutes);
}

function isOpenAt(hours: BusinessHoursEntry[], dayOfWeek: number, minutes: number): boolean {
  return hours.some((entry) => {
    if (entry.dayOfWeek !== dayOfWeek || entry.isClosed) return false;
    const opens = timeToMinutes(entry.opensAt);
    const closes = timeToMinutes(entry.closesAt);
    // Overnight shift: open from opens through midnight and on to closes.
    if (closes <= opens) return minutes >= opens || minutes < closes;
    return minutes >= opens && minutes < closes;
  });
}

function parseJsonArray<T>(value: string | undefined, fallback: T[]): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : fallback;
  } catch {
    return fallback;
  }
}

function publicHours(rows: BusinessHoursEntry[]): PublicBusinessHours[] {
  return [...rows]
    .sort((left, right) => left.dayOfWeek - right.dayOfWeek)
    .map((entry) => ({ ...entry, label: DAY_LABELS[entry.dayOfWeek] ?? "" }));
}

function hoursFromRows(
  rows: Array<{ day_of_week: number; is_closed: number; opens_at: string; closes_at: string }>,
): BusinessHoursEntry[] {
  return rows.map((row) => ({
    dayOfWeek: row.day_of_week,
    isClosed: Boolean(row.is_closed),
    opensAt: row.opens_at,
    closesAt: row.closes_at,
  }));
}

async function businessNotificationsEnabled(): Promise<boolean> {
  return true;
}

class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields?: Record<string, string>;

  constructor(status: number, code: string, message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
  }
}

const MAX_JSON_BYTES = 24_000;
const SESSION_DAYS = 30;
    // Kept at/below 100k: higher counts exceed Workers CPU limits on auth
    // paths and surface as 500s. NOTE: hashes made with the old 310k count
    // will no longer verify; those accounts need a password reset (none
    // known — no login has ever succeeded against this worker).
    const PASSWORD_ITERATIONS = 100_000;
const ALLOWED_EVIDENCE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
};

function securityHeaders(): Record<string, string> {
  return {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "camera=(), microphone=(), geolocation=()",
    "cross-origin-resource-policy": "same-site",
  };
}

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string, env: Env): boolean {
  if (allowedOrigins(env).includes(origin)) return true;
  if (env.APP_ENV !== "production") {
    try {
      const hostname = new URL(origin).hostname;
      return hostname === "localhost" || hostname === "127.0.0.1" || hostname.endsWith(".e2b.app");
    } catch {
      return false;
    }
  }
  return false;
}

function withCors(response: Response, request: Request, env: Env): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders())) headers.set(name, value);
  headers.set("x-request-id", headers.get("x-request-id") ?? crypto.randomUUID());

  const origin = request.headers.get("origin");
  if (origin && isAllowedOrigin(origin, env)) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("vary", "Origin");
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function success<T>(data: T, requestId: string, init?: ResponseInit): Response {
  return new Response(JSON.stringify({ data, requestId }), {
    ...init,
    headers: { ...jsonHeaders, "x-request-id": requestId, ...(init?.headers ?? {}) },
  });
}

function failure(error: unknown, requestId: string): Response {
  if (error instanceof HttpError) {
    return new Response(
      JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          ...(error.fields ? { fields: error.fields } : {}),
        },
        requestId,
      }),
      { status: error.status, headers: { ...jsonHeaders, "x-request-id": requestId } },
    );
  }

  console.error(
    JSON.stringify({
      level: "error",
      requestId,
      message: "Unhandled API error",
      error:
        error instanceof Error
          ? { name: error.name, message: error.message, stack: error.stack }
          : String(error),
    }),
  );
  return new Response(
    JSON.stringify({
      error: { code: "INTERNAL_ERROR", message: "The request could not be completed." },
      requestId,
    }),
    { status: 500, headers: { ...jsonHeaders, "x-request-id": requestId } },
  );
}

function validationFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    fields[path] ??= issue.message;
  }
  return fields;
}

async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new HttpError(415, "UNSUPPORTED_MEDIA_TYPE", "Send the request as JSON.");
  }
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > MAX_JSON_BYTES) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
  }

  let body: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_JSON_BYTES) {
      throw new HttpError(413, "PAYLOAD_TOO_LARGE", "The request body is too large.");
    }
    body = JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, "INVALID_JSON", "The request body is not valid JSON.");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Check the highlighted fields.",
      validationFields(parsed.error),
    );
  }
  return parsed.data;
}

function normalizeEmail(email: string | undefined): string | null {
  const normalized = (email ?? "").trim().toLowerCase();
  return normalized || null;
}

function normalizePhone(phone: string | undefined): string | null {
  const raw = (phone ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 11) digits = `234${digits.slice(1)}`;
  if (digits.startsWith("234") && digits.length === 13) return `+${digits}`;
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;
  throw new HttpError(422, "VALIDATION_ERROR", "Check the highlighted fields.", {
    phone: "Enter a valid phone number",
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64(new Uint8Array(digest));
}

async function hashPassword(
  password: string,
  salt?: Uint8Array<ArrayBuffer>,
): Promise<{ hash: string; salt: string }> {
  const actualSalt = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: actualSalt, iterations: PASSWORD_ITERATIONS },
    key,
    256,
  );
  return { hash: bytesToBase64(new Uint8Array(bits)), salt: bytesToBase64(actualSalt) };
}

function constantTimeEqual(left: string, right: string): boolean {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) mismatch |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return mismatch === 0;
}

function cookieValue(request: Request, name: string): string | null {
  const cookie = request.headers.get("cookie") ?? "";
  for (const part of cookie.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function sessionCookie(token: string, maxAgeSeconds: number): string {
  return `__Host-gh_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function toSessionUser(
  user: Pick<DbUser, "id" | "full_name" | "email" | "phone" | "role">,
): SessionUser {
  return {
    id: user.id,
    fullName: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
  };
}

async function sessionUser(context: AppContext): Promise<SessionUser | null> {
  const token = cookieValue(context.request, "__Host-gh_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const user = await context.env.DB.prepare(
    `SELECT u.id, u.full_name, u.email, u.phone, u.role
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'`,
  )
    .bind(tokenHash, now)
    .first<DbUser>();
  return user ? toSessionUser(user) : null;
}

async function requireUser(context: AppContext): Promise<AuthContext> {
  const user = await sessionUser(context);
  if (!user) throw new HttpError(401, "AUTH_REQUIRED", "Sign in to continue.");
  return { ...context, user };
}

async function requireAdmin(context: AppContext): Promise<AuthContext> {
  const auth = await requireUser(context);
  if (auth.user.role !== "platform_admin") {
    throw new HttpError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
  return auth;
}

function validProxySecret(request: Request, env: Env): boolean {
  const supplied = request.headers.get("x-gainhub-proxy-secret");
  return Boolean(
    supplied && env.PROXY_SHARED_SECRET && constantTimeEqual(supplied, env.PROXY_SHARED_SECRET),
  );
}

function clientIp(request: Request, env: Env): string {
  if (validProxySecret(request, env)) {
    const forwarded = request.headers.get("x-gainhub-client-ip")?.trim();
    if (forwarded && /^[0-9a-f:.]{3,64}$/i.test(forwarded)) return forwarded;
  }
  return request.headers.get("cf-connecting-ip") ?? "unknown";
}

async function privacyHash(value: string, env: Env): Promise<string> {
  const salt = env.IP_HASH_SALT ?? (env.APP_ENV === "development" ? "gainhub-local-only" : "");
  if (!salt)
    throw new HttpError(503, "CONFIGURATION_ERROR", "The service is temporarily unavailable.");
  return sha256(`${salt}:${value}`);
}

/**
 * `actor` lets a caller key the bucket on something better than the source IP.
 * Rate limits here were IP-only, which is wrong for an audience that is mostly
 * on mobile carrier NAT: one person writing reviews would drain the shared
 * budget for every other subscriber behind the same address, and there is
 * nothing they can do about it. Signed-in writes therefore bucket on the user
 * id (impossible to evade by rotating IPs, impossible to collide with a
 * stranger), while anonymous endpoints keep the IP bucket because that is the
 * only handle we have on the caller.
 */
async function enforceRateLimit(
  context: AppContext,
  scope: string,
  limit: number,
  windowSeconds: number,
  actor?: string,
): Promise<void> {
  const identity = actor ?? (await privacyHash(context.ip, context.env));
  const bucket = Math.floor(Date.now() / (windowSeconds * 1_000));
  const expiresAt = Math.floor(Date.now() / 1_000) + windowSeconds + 60;
  const row = await context.env.DB.prepare(
    `INSERT INTO rate_limits (key, bucket, count, expires_at) VALUES (?, ?, 1, ?)
     ON CONFLICT (key, bucket) DO UPDATE SET count = count + 1
     RETURNING count`,
  )
    .bind(`${scope}:${identity}`, bucket, expiresAt)
    .first<{ count: number }>();
  if ((row?.count ?? limit + 1) > limit) {
    throw new HttpError(429, "RATE_LIMITED", "Too many attempts. Please wait and try again.");
  }
}

async function audit(
  context: AppContext,
  actorUserId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  metadata: JsonRecord = {},
): Promise<void> {
  await context.env.DB.prepare(
    `INSERT INTO audit_events
      (id, actor_user_id, action, entity_type, entity_id, metadata_json, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      actorUserId,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata),
      context.requestId,
      new Date().toISOString(),
    )
    .run();
}

/**
 * Deliver an in-app notification. Notifications are the only channel the product
 * owns end to end, so they are synchronous with the workflow that produced them:
 * a user is never told "an email was sent" unless one actually was.
 */
async function notify(
  context: AppContext,
  userId: string,
  kind: string,
  title: string,
  body: string,
  href = "",
  entity: { type?: string; id?: string } = {},
): Promise<void> {
  await context.env.DB.prepare(
    `INSERT INTO notifications
       (id, user_id, kind, title, body, href, entity_type, entity_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      crypto.randomUUID(),
      userId,
      kind,
      title,
      body,
      href,
      entity.type ?? "",
      entity.id ?? "",
      new Date().toISOString(),
    )
    .run();
}

function mapBusiness(
  row: BusinessRow,
  extras?: {
    hours?: BusinessHoursEntry[];
    openNow?: boolean;
    yearEstablished?: number | null;
    teamSize?: string;
  },
): PublicBusiness {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    about: row.about,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    locationSlug: row.location_slug,
    city: row.city,
    state: row.state,
    address: row.address,
    rating: Number(row.rating_average),
    reviewCount: row.review_count,
    verificationLevel: row.verification_level,
    openNow: extras?.openNow ?? Boolean(row.is_open_now),
    whatsapp: row.whatsapp,
    phone: row.phone,
    website: row.website,
    priceRange: row.price_range ?? "",
    amenities: parseJsonArray<string>(row.amenities_json, []),
    serviceAreas: parseJsonArray<string>(row.service_areas_json, []),
    socials: parseJsonArray<{ label: string; handle: string }>(row.socials_json, []),
    hours: publicHours(extras?.hours ?? []),
    yearEstablished: extras?.yearEstablished ?? null,
    teamSize: extras?.teamSize ?? "",
  };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

async function hoursForBusinesses(
  context: AppContext,
  ids: string[],
): Promise<Map<string, BusinessHoursEntry[]>> {
  const result = new Map<string, BusinessHoursEntry[]>();
  if (!ids.length) return result;
  const chunkSize = 100;
  for (let index = 0; index < ids.length; index += chunkSize) {
    const chunk = ids.slice(index, index + chunkSize);
    const placeholders = chunk.map(() => "?").join(", ");
    const rows = await context.env.DB.prepare(
      `SELECT business_id, day_of_week, is_closed, opens_at, closes_at
         FROM business_hours
        WHERE business_id IN (${placeholders})
        ORDER BY business_id, day_of_week`,
    )
      .bind(...chunk)
      .all<{
        business_id: string;
        day_of_week: number;
        is_closed: number;
        opens_at: string;
        closes_at: string;
      }>();
    for (const row of rows.results) {
      const list = result.get(row.business_id) ?? [];
      list.push({
        dayOfWeek: row.day_of_week,
        isClosed: Boolean(row.is_closed),
        opensAt: row.opens_at,
        closesAt: row.closes_at,
      });
      result.set(row.business_id, list);
    }
  }
  return result;
}

async function listBusinesses(context: AppContext): Promise<Response> {
  const params = Object.fromEntries(context.url.searchParams);
  const parsed = directoryQuerySchema.safeParse(params);
  if (!parsed.success) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Check the search filters.",
      validationFields(parsed.error),
    );
  }
  const query = parsed.data;
  const clauses = ["b.status = 'published'"];
  const bindings: unknown[] = [];
  const now = lagosNow();
  const nowMinutes = String(now.minutes).padStart(4, "0");
  // `HH:MM` strings compare chronologically, so the open/close test is a string
  // comparison. The second branch covers overnight shifts (closes_at <= opens_at).
  const openNowPredicate =
    "EXISTS (SELECT 1 FROM business_hours h WHERE h.business_id = b.id" +
    " AND h.day_of_week = ? AND h.is_closed = 0" +
    " AND ((h.opens_at <= ? AND h.closes_at > ?)" +
    " OR (h.closes_at <= h.opens_at AND (h.opens_at <= ? OR h.closes_at > ?))))";
  const openNowBindings = [now.dayOfWeek, nowMinutes, nowMinutes, nowMinutes, nowMinutes];

  if (query.q) {
    const term = `%${escapeLike(query.q)}%`;
    clauses.push(
      `(b.name LIKE ? ESCAPE '\\' OR b.tagline LIKE ? ESCAPE '\\' OR b.about LIKE ? ESCAPE '\\' OR b.city LIKE ? ESCAPE '\\'
        OR EXISTS (
          SELECT 1 FROM business_services service
           WHERE service.business_id = b.id AND service.is_active = 1
             AND (service.name LIKE ? ESCAPE '\\' OR service.note LIKE ? ESCAPE '\\')
        ))`,
    );
    bindings.push(term, term, term, term, term, term);
  }
  if (query.category) {
    clauses.push("b.category_slug = ?");
    bindings.push(query.category);
  }
  if (query.location) {
    clauses.push("b.location_slug = ?");
    bindings.push(query.location);
  }
  if (query.verified) clauses.push("b.verification_level != 'unverified'");
  if (query.openNow) {
    clauses.push(openNowPredicate);
    bindings.push(...openNowBindings);
  }
  if (query.minRating > 0) {
    clauses.push("b.rating_average >= ?");
    bindings.push(query.minRating);
  }

  const where = clauses.join(" AND ");
  const sort =
    query.sort === "rating"
      ? "b.rating_average DESC, b.review_count DESC, b.id ASC"
      : query.sort === "name"
        ? "b.name COLLATE NOCASE ASC, b.id ASC"
        : query.sort === "recent"
          ? "b.published_at DESC, b.id ASC"
          : "CASE b.verification_level WHEN 'premium' THEN 5 WHEN 'documents' THEN 4 WHEN 'phone' THEN 3 WHEN 'email' THEN 2 ELSE 1 END DESC, b.rating_average DESC, b.id ASC";
  const offset = (query.page - 1) * query.pageSize;

  const [countRow, result] = await Promise.all([
    context.env.DB.prepare(`SELECT COUNT(*) AS total FROM businesses b WHERE ${where}`)
      .bind(...bindings)
      .first<{ total: number }>(),
    context.env.DB.prepare(
      `SELECT b.id, b.slug, b.name, b.tagline, b.about, b.category_slug,
              c.name AS category_name, b.location_slug, b.city, b.state, b.address,
              b.rating_average, b.review_count, b.verification_level, b.is_open_now,
              b.whatsapp, b.phone, b.website, b.price_range, b.amenities_json,
              b.service_areas_json, b.socials_json,
              d.year_established, d.team_size
         FROM businesses b
         JOIN categories c ON c.slug = b.category_slug
         LEFT JOIN business_profile_details d ON d.business_id = b.id
        WHERE ${where}
        ORDER BY ${sort}
        LIMIT ? OFFSET ?`,
    )
      // Only the WHERE clause is parameterised in this statement, so `bindings` maps
      // 1:1 onto the placeholders in SQL-text order. Open/closed state is derived in
      // JS below, which keeps this list free of SELECT-clause parameters.
      .bind(...bindings, query.pageSize, offset)
      .all<BusinessRow & { year_established: number | null; team_size: string | null }>(),
  ]);

  const total = countRow?.total ?? 0;
  const hoursById = await hoursForBusinesses(
    context,
    result.results.map((row) => row.id),
  );

  return success(
    {
      items: result.results.map((row) => {
        const hours = hoursById.get(row.id) ?? [];
        return mapBusiness(row, {
          hours,
          // Trust the hours-derived value whenever hours are published; otherwise fall
          // back to the stored column so businesses with no hours keep their state.
          openNow: hours.length
            ? isOpenAt(hours, now.dayOfWeek, now.minutes)
            : Boolean(row.is_open_now),
          yearEstablished: row.year_established ?? null,
          teamSize: row.team_size ?? "",
        });
      }),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pages: Math.max(1, Math.ceil(total / query.pageSize)),
      },
    },
    context.requestId,
    {
      headers: { "cache-control": "public, max-age=30, s-maxage=120, stale-while-revalidate=300" },
    },
  );
}

async function getBusiness(context: AppContext, identifier: string): Promise<Response> {
  const parsedIdentifier = z.string().trim().min(2).max(80).safeParse(identifier);
  if (!parsedIdentifier.success) throw new HttpError(404, "NOT_FOUND", "Business not found.");
  const row = await context.env.DB.prepare(
    `SELECT b.id, b.slug, b.name, b.tagline, b.about, b.category_slug,
            c.name AS category_name, b.location_slug, b.city, b.state, b.address,
            b.rating_average, b.review_count, b.verification_level, b.is_open_now,
            b.whatsapp, b.phone, b.website, b.price_range, b.amenities_json,
            b.service_areas_json, b.socials_json,
            d.year_established, d.team_size
       FROM businesses b
       JOIN categories c ON c.slug = b.category_slug
       LEFT JOIN business_profile_details d ON d.business_id = b.id
      WHERE (b.slug = ? OR b.id = ?) AND b.status = 'published'`,
  )
    .bind(parsedIdentifier.data, parsedIdentifier.data)
    .first<BusinessRow & { year_established: number | null; team_size: string | null }>();
  if (!row) throw new HttpError(404, "NOT_FOUND", "Business not found.");

  const [services, hoursRows] = await Promise.all([
    context.env.DB.prepare(
      `SELECT id, name, price, note
         FROM business_services
        WHERE business_id = ? AND is_active = 1
        ORDER BY sort_order, id`,
    )
      .bind(row.id)
      .all<{ id: string; name: string; price: string; note: string }>(),
    context.env.DB.prepare(
      `SELECT day_of_week, is_closed, opens_at, closes_at
         FROM business_hours WHERE business_id = ? ORDER BY day_of_week`,
    )
      .bind(row.id)
      .all<{
        day_of_week: number;
        is_closed: number;
        opens_at: string;
        closes_at: string;
      }>(),
  ]);

  const hours = hoursFromRows(hoursRows.results);
  const current = lagosNow();
  const business = mapBusiness(row, {
    hours,
    openNow: hours.length
      ? isOpenAt(hours, current.dayOfWeek, current.minutes)
      : Boolean(row.is_open_now),
    yearEstablished: row.year_established ?? null,
    teamSize: row.team_size ?? "",
  });
  business.services = services.results;
  return success(business, context.requestId, {
    headers: { "cache-control": "public, max-age=30, s-maxage=180, stale-while-revalidate=600" },
  });
}

/** Published reviews for one business. Reviews were previously write-only. */
async function listBusinessReviews(context: AppContext, identifier: string): Promise<Response> {
  const parsedIdentifier = z.string().trim().min(2).max(80).safeParse(identifier);
  if (!parsedIdentifier.success) throw new HttpError(404, "NOT_FOUND", "Business not found.");
  const business = await context.env.DB.prepare(
    `SELECT id FROM businesses
      WHERE (slug = ? OR id = ?) AND status = 'published'`,
  )
    .bind(parsedIdentifier.data, parsedIdentifier.data)
    .first<{ id: string }>();
  if (!business) throw new HttpError(404, "NOT_FOUND", "Business not found.");

  const [rows, summary] = await Promise.all([
    context.env.DB.prepare(
      `SELECT r.id, r.rating, r.body, r.created_at, u.full_name AS author_name
         FROM reviews r JOIN users u ON u.id = r.author_user_id
        WHERE r.business_id = ? AND r.status = 'published'
        ORDER BY r.created_at DESC
        LIMIT 50`,
    )
      .bind(business.id)
      .all<{ id: string; rating: number; body: string; created_at: string; author_name: string }>(),
    context.env.DB.prepare(
      `SELECT COUNT(*) AS total, COALESCE(AVG(rating), 0) AS average
         FROM reviews WHERE business_id = ? AND status = 'published'`,
    )
      .bind(business.id)
      .first<{ total: number; average: number }>(),
  ]);

  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  for (const row of rows.results) {
    const bucket = Math.min(5, Math.max(1, Math.round(row.rating))) as 1 | 2 | 3 | 4 | 5;
    distribution[bucket] += 1;
  }

  // The reader's own review, in any moderation state. Read separately (and never
  // cached with the public list) so a pending or rejected review is visible to
  // its author without leaking into the published set.
  const viewer = await sessionUser(context);
  const own = viewer
    ? await context.env.DB.prepare(
        `SELECT id, rating, body, status, created_at, updated_at, edited_at
           FROM reviews WHERE business_id = ? AND author_user_id = ?`,
      )
        .bind(business.id, viewer.id)
        .first<{
          id: string;
          rating: number;
          body: string;
          status: string;
          created_at: string;
          updated_at: string;
          edited_at: string | null;
        }>()
    : null;

  return success(
    {
      items: rows.results.map((row) => ({
        id: row.id,
        rating: row.rating,
        body: row.body,
        createdAt: row.created_at,
        authorName: row.author_name,
      })),
      summary: {
        average: Number((summary?.average ?? 0).toFixed(2)),
        total: summary?.total ?? 0,
        distribution,
      },
      mine: own
        ? {
            id: own.id,
            rating: own.rating,
            body: own.body,
            status: own.status,
            createdAt: own.created_at,
            updatedAt: own.updated_at,
            editedAt: own.edited_at,
          }
        : null,
    },
    context.requestId,
    // Only cache the anonymous shape; a signed-in response carries private state.
    viewer
      ? { headers: { "cache-control": "private, no-store" } }
      : { headers: { "cache-control": "public, max-age=30, s-maxage=180" } },
  );
}

/**
 * Related published businesses, used for "more like this" internal linking.
 * Falls back from same-category + same-city to same-category to same-city so a
 * thin directory still produces useful links instead of an empty rail.
 */
async function relatedBusinesses(context: AppContext, identifier: string): Promise<Response> {
  const parsedIdentifier = z.string().trim().min(2).max(80).safeParse(identifier);
  if (!parsedIdentifier.success) throw new HttpError(404, "NOT_FOUND", "Business not found.");
  const origin = await context.env.DB.prepare(
    `SELECT id, category_slug, location_slug FROM businesses
      WHERE (slug = ? OR id = ?) AND status = 'published'`,
  )
    .bind(parsedIdentifier.data, parsedIdentifier.data)
    .first<{ id: string; category_slug: string; location_slug: string }>();
  if (!origin) throw new HttpError(404, "NOT_FOUND", "Business not found.");

  const rows = await context.env.DB.prepare(
    `SELECT b.id, b.slug, b.name, b.tagline, b.about, b.category_slug,
            c.name AS category_name, b.location_slug, b.city, b.state, b.address,
            b.rating_average, b.review_count, b.verification_level, b.is_open_now,
            b.whatsapp, b.phone, b.website, b.price_range, b.amenities_json,
            b.service_areas_json, b.socials_json,
            (CASE WHEN b.category_slug = ? AND b.location_slug = ? THEN 0
                  WHEN b.category_slug = ? THEN 1
                  ELSE 2 END) AS related_rank
       FROM businesses b
       JOIN categories c ON c.slug = b.category_slug
      WHERE b.status = 'published' AND b.id != ?
      ORDER BY related_rank, b.rating_average DESC, b.review_count DESC, b.id ASC
      LIMIT 6`,
  )
    .bind(origin.category_slug, origin.location_slug, origin.category_slug, origin.id)
    .all<BusinessRow & { related_rank: number }>();

  const ids = rows.results.map((row) => row.id);
  const hoursById = await hoursForBusinesses(context, ids);
  const current = lagosNow();

  return success(
    rows.results.map((row) => {
      const hours = hoursById.get(row.id) ?? [];
      return mapBusiness(row, {
        hours,
        openNow: hours.length
          ? isOpenAt(hours, current.dayOfWeek, current.minutes)
          : Boolean(row.is_open_now),
      });
    }),
    context.requestId,
    { headers: { "cache-control": "public, max-age=60, s-maxage=600" } },
  );
}

/**
 * Type-ahead suggestions across businesses, categories, locations and services.
 * Bounded and rate limited; it is a convenience surface, not a search index.
 */
async function searchSuggestions(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "suggest", 120, 3_600);
  const term = (context.url.searchParams.get("q") ?? "").trim().slice(0, 60);
  if (term.length < 2) return success({ items: [] }, context.requestId);
  const like = `%${escapeLike(term)}%`;

  const [businesses, categories, locations, services] = await Promise.all([
    context.env.DB.prepare(
      `SELECT slug, name, city, state FROM businesses
        WHERE status = 'published' AND (name LIKE ? ESCAPE '\\' OR tagline LIKE ? ESCAPE '\\')
        ORDER BY rating_average DESC, name ASC LIMIT 5`,
    )
      .bind(like, like)
      .all<{ slug: string; name: string; city: string; state: string }>(),
    context.env.DB.prepare(
      `SELECT slug, name FROM categories
        WHERE is_active = 1 AND (name LIKE ? ESCAPE '\\' OR slug LIKE ? ESCAPE '\\')
        ORDER BY sort_order LIMIT 4`,
    )
      .bind(like, like)
      .all<{ slug: string; name: string }>(),
    context.env.DB.prepare(
      `SELECT slug, name, state FROM locations
        WHERE is_active = 1 AND (name LIKE ? ESCAPE '\\' OR state LIKE ? ESCAPE '\\')
        ORDER BY sort_order LIMIT 4`,
    )
      .bind(like, like)
      .all<{ slug: string; name: string; state: string }>(),
    context.env.DB.prepare(
      `SELECT s.name AS service_name, b.slug AS business_slug, b.name AS business_name
         FROM business_services s
         JOIN businesses b ON b.id = s.business_id
        WHERE s.is_active = 1 AND b.status = 'published' AND s.name LIKE ? ESCAPE '\\'
        GROUP BY lower(s.name)
        ORDER BY COUNT(*) DESC, s.name ASC LIMIT 4`,
    )
      .bind(like)
      .all<{ service_name: string; business_slug: string; business_name: string }>(),
  ]);

  const items = [
    ...businesses.results.map((row) => ({
      type: "business" as const,
      label: row.name,
      hint: `${row.city}, ${row.state}`,
      href: `/business/${row.slug}`,
    })),
    ...categories.results.map((row) => ({
      type: "category" as const,
      label: row.name,
      hint: "Category",
      href: `/category/${row.slug}`,
    })),
    ...locations.results.map((row) => ({
      type: "location" as const,
      label: row.name,
      hint: row.state,
      href: `/locations/${row.slug}`,
    })),
    ...services.results.map((row) => ({
      type: "service" as const,
      label: row.service_name,
      hint: "Service",
      href: `/search?q=${encodeURIComponent(row.service_name)}`,
    })),
  ].slice(0, 12);

  return success({ items }, context.requestId, {
    headers: { "cache-control": "public, max-age=30, s-maxage=300" },
  });
}

async function listCategories(context: AppContext): Promise<Response> {
  const result = await context.env.DB.prepare(
    `SELECT c.slug, c.name, c.description, COUNT(b.id) AS business_count
       FROM categories c
       LEFT JOIN businesses b ON b.category_slug = c.slug AND b.status = 'published'
      WHERE c.is_active = 1
      GROUP BY c.slug, c.name, c.description, c.sort_order
      ORDER BY c.sort_order, c.name`,
  ).all<{ slug: string; name: string; description: string; business_count: number }>();
  return success(
    result.results.map((row) => ({
      slug: row.slug,
      name: row.name,
      description: row.description,
      businessCount: row.business_count,
    })),
    context.requestId,
    { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } },
  );
}

async function listLocations(context: AppContext): Promise<Response> {
  const result = await context.env.DB.prepare(
    `SELECT l.slug, l.name, l.state, l.areas_json, COUNT(b.id) AS business_count
       FROM locations l
       LEFT JOIN businesses b ON b.location_slug = l.slug AND b.status = 'published'
      WHERE l.is_active = 1
      GROUP BY l.slug, l.name, l.state, l.areas_json, l.sort_order
      ORDER BY l.sort_order, l.name`,
  ).all<{
    slug: string;
    name: string;
    state: string;
    areas_json: string;
    business_count: number;
  }>();
  return success(
    result.results.map((row) => ({
      slug: row.slug,
      name: row.name,
      state: row.state,
      areas: JSON.parse(row.areas_json) as unknown,
      businessCount: row.business_count,
    })),
    context.requestId,
    { headers: { "cache-control": "public, max-age=300, s-maxage=3600" } },
  );
}

async function sitemapEntries(context: AppContext): Promise<Response> {
  const [businesses, rooms] = await Promise.all([
    context.env.DB.prepare(
      `SELECT slug, updated_at FROM businesses
        WHERE status = 'published' ORDER BY updated_at DESC LIMIT 10000`,
    ).all<{ slug: string; updated_at: string }>(),
    context.env.DB.prepare(
      `SELECT id, updated_at FROM contact_rooms
        WHERE status = 'active' ORDER BY updated_at DESC LIMIT 10000`,
    ).all<{ id: string; updated_at: string }>(),
  ]);
  return success({ businesses: businesses.results, rooms: rooms.results }, context.requestId, {
    headers: { "cache-control": "public, max-age=300, s-maxage=3600" },
  });
}

async function register(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "auth-register", 5, 900);
  const input = await parseJson(context.request, registerSchema);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  const duplicate = await context.env.DB.prepare(
    `SELECT id FROM users WHERE (? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?) LIMIT 1`,
  )
    .bind(email, email, phone, phone)
    .first<{ id: string }>();
  if (duplicate) {
    throw new HttpError(409, "ACCOUNT_EXISTS", "An account with those details already exists.");
  }

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const password = await hashPassword(input.password);
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = bytesToBase64(tokenBytes);
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();

  try {
    await context.env.DB.batch([
      context.env.DB.prepare(
        `INSERT INTO users
          (id, full_name, email, phone, password_hash, password_salt, role, status,
           terms_accepted_at, terms_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 'consumer', 'active', ?, ?, ?, ?)`,
      ).bind(
        id,
        input.fullName,
        email,
        phone,
        password.hash,
        password.salt,
        now,
        TERMS_VERSION,
        now,
        now,
      ),
      context.env.DB.prepare(
        `INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(tokenHash, id, expiresAt, now, now),
    ]);
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      throw new HttpError(409, "ACCOUNT_EXISTS", "An account with those details already exists.");
    }
    throw error;
  }

  await audit(context, id, "auth.registered", "user", id);
  return success(
    {
      user: { id, fullName: input.fullName, email, phone, role: "consumer" as const },
    },
    context.requestId,
    { status: 201, headers: { "set-cookie": sessionCookie(token, SESSION_DAYS * 86_400) } },
  );
}

async function login(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "auth-login", 10, 900);
  const input = await parseJson(context.request, loginSchema);
  const identity = input.identity.trim();
  const maybeEmail = identity.includes("@") ? normalizeEmail(identity) : null;
  let maybePhone: string | null = null;
  if (!maybeEmail) {
    try {
      maybePhone = normalizePhone(identity);
    } catch {
      maybePhone = null;
    }
  }

  const user = await context.env.DB.prepare(
    `SELECT id, full_name, email, phone, role, password_hash, password_salt
       FROM users
      WHERE status = 'active' AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))
      LIMIT 1`,
  )
    .bind(maybeEmail, maybeEmail, maybePhone, maybePhone)
    .first<DbUser>();

  const fallbackSalt = new Uint8Array(16);
  const derived = await hashPassword(
    input.password,
    user ? base64ToBytes(user.password_salt) : fallbackSalt,
  );
  if (!user || !constantTimeEqual(derived.hash, user.password_hash)) {
    throw new HttpError(401, "INVALID_CREDENTIALS", "The sign-in details are incorrect.");
  }

  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await context.env.DB.prepare(
    `INSERT INTO sessions (token_hash, user_id, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(tokenHash, user.id, expiresAt, now, now)
    .run();
  await audit(context, user.id, "auth.signed_in", "user", user.id);

  return success({ user: toSessionUser(user) }, context.requestId, {
    headers: { "set-cookie": sessionCookie(token, SESSION_DAYS * 86_400) },
  });
}

async function logout(context: AppContext): Promise<Response> {
  const token = cookieValue(context.request, "__Host-gh_session");
  if (token) {
    const tokenHash = await sha256(token);
    await context.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }
  return success({ signedOut: true }, context.requestId, {
    headers: { "set-cookie": sessionCookie("", 0) },
  });
}

async function currentSession(context: AppContext): Promise<Response> {
  const user = await sessionUser(context);
  return success({ user }, context.requestId);
}

async function submitListing(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "listing", 4, 3_600);
  const input = await parseJson(context.request, listingApplicationSchema);
  if (input.company)
    throw new HttpError(422, "VALIDATION_ERROR", "The submission could not be accepted.");
  const user = await sessionUser(context);
  const email = normalizeEmail(input.email);
  const whatsapp = normalizePhone(input.whatsapp);
  const phone = normalizePhone(input.phone);
  const taxonomy = await context.env.DB.prepare(
    `SELECT
       EXISTS(SELECT 1 FROM categories WHERE slug = ? AND is_active = 1) AS category_ok,
       EXISTS(SELECT 1 FROM locations WHERE slug = ? AND is_active = 1) AS location_ok`,
  )
    .bind(input.categorySlug, input.locationSlug)
    .first<{ category_ok: number; location_ok: number }>();
  if (!taxonomy?.category_ok || !taxonomy.location_ok) {
    throw new HttpError(422, "VALIDATION_ERROR", "Choose a supported category and location.");
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO listing_applications
      (id, applicant_user_id, owner_name, email, business_name, tagline, category_slug,
       location_slug, address, whatsapp, phone, website, about, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(
      id,
      user?.id ?? null,
      input.ownerName,
      email,
      input.businessName,
      input.tagline,
      input.categorySlug,
      input.locationSlug,
      input.address,
      whatsapp,
      phone ?? "",
      input.website,
      input.about,
      now,
      now,
    )
    .run();
  await audit(context, user?.id ?? null, "listing.submitted", "listing_application", id);
  return success(
    { id, status: "pending", message: "Your listing is in the review queue." },
    context.requestId,
    { status: 201 },
  );
}

async function submitEnquiry(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "enquiry", 12, 3_600);
  const input = await parseJson(context.request, enquirySchema);
  const exists = await context.env.DB.prepare(
    "SELECT id FROM businesses WHERE id = ? AND status = 'published'",
  )
    .bind(input.businessId)
    .first<{ id: string }>();
  if (!exists) throw new HttpError(404, "NOT_FOUND", "Business not found.");
  const user = await sessionUser(context);
  const idempotencyKey = context.request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey || idempotencyKey.length < 16 || idempotencyKey.length > 100) {
    throw new HttpError(
      400,
      "IDEMPOTENCY_KEY_REQUIRED",
      "A valid Idempotency-Key header is required.",
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await context.env.DB.prepare(
      `INSERT INTO enquiries
        (id, business_id, requester_user_id, name, phone, message, status, idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
    )
      .bind(
        id,
        input.businessId,
        user?.id ?? null,
        input.name,
        normalizePhone(input.phone),
        input.message,
        idempotencyKey,
        now,
        now,
      )
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      const existing = await context.env.DB.prepare(
        "SELECT id, status FROM enquiries WHERE business_id = ? AND idempotency_key = ?",
      )
        .bind(input.businessId, idempotencyKey)
        .first<{ id: string; status: string }>();
      return success(
        { id: existing?.id, status: existing?.status ?? "new", duplicate: true },
        context.requestId,
      );
    }
    throw error;
  }
  await audit(context, user?.id ?? null, "enquiry.created", "enquiry", id, {
    businessId: input.businessId,
  });

  // An enquiry nobody is told about is not a lead. Alert every authorised member
  // of the business so the conversation can actually start.
  const members = await context.env.DB.prepare(
    `SELECT bm.user_id, b.name AS business_name
       FROM business_members bm JOIN businesses b ON b.id = bm.business_id
      WHERE bm.business_id = ?`,
  )
    .bind(input.businessId)
    .all<{ user_id: string; business_name: string }>();
  for (const member of members.results) {
    await notify(
      context,
      member.user_id,
      "enquiry.received",
      `New enquiry for ${member.business_name}`,
      `${input.name} asked about your services. Open the workspace to respond.`,
      "/app",
      { type: "enquiry", id },
    );
  }

  return success({ id, status: "new" }, context.requestId, { status: 201 });
}

async function submitReview(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  await enforceRateLimit(context, "review", 5, 3_600, `user:${auth.user.id}`);
  const input = await parseJson(context.request, reviewSchema);
  const exists = await context.env.DB.prepare(
    "SELECT id FROM businesses WHERE id = ? AND status = 'published'",
  )
    .bind(input.businessId)
    .first<{ id: string }>();
  if (!exists) throw new HttpError(404, "NOT_FOUND", "Business not found.");

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await context.env.DB.prepare(
      `INSERT INTO reviews (id, business_id, author_user_id, rating, body, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
      .bind(id, input.businessId, auth.user.id, input.rating, input.body, now, now)
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      throw new HttpError(409, "REVIEW_EXISTS", "You have already reviewed this business.");
    }
    throw error;
  }
  await audit(context, auth.user.id, "review.submitted", "review", id, {
    businessId: input.businessId,
  });
  return success({ id, status: "pending" }, context.requestId, { status: 201 });
}

/**
 * Edit your own review.
 *
 * An edit is treated as a fresh submission: a review that was already published
 * goes back to the moderation queue and drops out of the aggregate until it is
 * re-approved. That is deliberately stricter than "edit in place" — without it,
 * a review could be approved and then rewritten into something that would never
 * have passed.
 */
async function updateReview(context: AppContext, reviewId: string): Promise<Response> {
  /*
   * Edits get their own bucket rather than sharing the 5/hour "review" write
   * budget. Rate limits are IP-scoped, so a shared bucket would let one person
   * writing new reviews exhaust the budget of everyone behind the same NAT who
   * just wants to correct a typo in a review they already own. Editing only
   * ever touches a single row the caller owns, so a higher ceiling is safe.
   */
  const auth = await requireUser(context);
  await enforceRateLimit(context, "review-edit", 10, 3_600, `user:${auth.user.id}`);
  if (!z.string().uuid().safeParse(reviewId).success) {
    throw new HttpError(404, "NOT_FOUND", "Review not found.");
  }
  const input = await parseJson(context.request, reviewUpdateSchema);

  const review = await context.env.DB.prepare(
    `SELECT r.id, r.status, r.business_id, b.slug AS business_slug, b.name AS business_name
       FROM reviews r JOIN businesses b ON b.id = r.business_id
      WHERE r.id = ? AND r.author_user_id = ?`,
  )
    .bind(reviewId, auth.user.id)
    .first<{
      id: string;
      status: string;
      business_id: string;
      business_slug: string;
      business_name: string;
    }>();
  // A review you cannot edit and a review that does not exist are the same thing
  // from the outside, so the response does not confirm which one it was.
  if (!review) throw new HttpError(404, "NOT_FOUND", "Review not found.");
  if (review.status === "disputed") {
    throw new HttpError(409, "REVIEW_LOCKED", "This review is under review and cannot be edited.");
  }

  const now = new Date().toISOString();
  const wasPublished = review.status === "published";
  const nextStatus = wasPublished ? "pending" : review.status;

  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(
      `UPDATE reviews SET rating = ?, body = ?, status = ?, edited_at = ?, updated_at = ?
        WHERE id = ? AND author_user_id = ?`,
    ).bind(input.rating, input.body, nextStatus, now, now, reviewId, auth.user.id),
  ];

  // Recompute only when the aggregate could have changed.
  if (wasPublished) {
    statements.push(
      context.env.DB.prepare(
        `UPDATE businesses
            SET rating_average = COALESCE((SELECT AVG(rating) FROM reviews WHERE business_id = ? AND status = 'published'), 0),
                review_count = (SELECT COUNT(*) FROM reviews WHERE business_id = ? AND status = 'published'),
                updated_at = ?
          WHERE id = ?`,
      ).bind(review.business_id, review.business_id, now, review.business_id),
    );
  }

  await context.env.DB.batch(statements);
  await audit(context, auth.user.id, "review.updated", "review", reviewId, {
    businessId: review.business_id,
    reSubmitted: nextStatus,
  });

  return success(
    {
      id: reviewId,
      status: nextStatus,
      reSubmitted: wasPublished,
    },
    context.requestId,
  );
}

async function submitSuggestion(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "suggestion", 5, 3_600);
  const input = await parseJson(context.request, suggestionSchema);
  if (input.company)
    throw new HttpError(422, "VALIDATION_ERROR", "The submission could not be accepted.");
  const user = await sessionUser(context);
  if (input.categorySlug) {
    const category = await context.env.DB.prepare(
      "SELECT slug FROM categories WHERE slug = ? AND is_active = 1",
    )
      .bind(input.categorySlug)
      .first<{ slug: string }>();
    if (!category) {
      throw new HttpError(422, "VALIDATION_ERROR", "Choose a supported category.", {
        categorySlug: "Choose a supported category",
      });
    }
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO suggestions
      (id, submitter_user_id, type, category_slug, business_name, phone, address, details,
       contact_email, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
  )
    .bind(
      id,
      user?.id ?? null,
      input.type,
      input.categorySlug ?? null,
      input.businessName,
      normalizePhone(input.phone) ?? "",
      input.address,
      input.details,
      normalizeEmail(input.contactEmail) ?? "",
      now,
      now,
    )
    .run();
  await audit(context, user?.id ?? null, "suggestion.submitted", "suggestion", id);
  return success({ id, status: "pending" }, context.requestId, { status: 201 });
}

async function submitReport(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "report", 8, 3_600);
  const input = await parseJson(context.request, reportSchema);
  if (input.company)
    throw new HttpError(422, "VALIDATION_ERROR", "The submission could not be accepted.");
  const user = await sessionUser(context);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const risk =
    input.reason === "scam" || input.reason === "impersonation" || input.reason === "abuse"
      ? "high"
      : "normal";
  await context.env.DB.prepare(
    `INSERT INTO reports
      (id, reporter_user_id, target_type, target_id, reason, details, contact_email, risk, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
  )
    .bind(
      id,
      user?.id ?? null,
      input.targetType,
      input.targetId,
      input.reason,
      input.details,
      normalizeEmail(input.contactEmail) ?? "",
      risk,
      now,
      now,
    )
    .run();
  await audit(context, user?.id ?? null, "report.submitted", "report", id, { risk });
  return success({ id, status: "open" }, context.requestId, { status: 201 });
}

async function hasValidEvidenceSignature(file: File): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "application/pdf") {
    return bytes.length >= 5 && String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  }
  if (file.type === "image/png") {
    const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    return signature.every((value, index) => bytes[index] === value);
  }
  if (file.type === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (file.type === "image/webp") {
    return (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    );
  }
  return false;
}

async function submitClaim(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  await enforceRateLimit(context, "claim", 3, 86_400, `user:${auth.user.id}`);
  const contentType = context.request.headers.get("content-type") ?? "";
  if (!contentType.startsWith("multipart/form-data")) {
    throw new HttpError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Upload claim evidence using multipart form data.",
    );
  }
  const contentLength = Number(context.request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 9 * 1_024 * 1_024) {
    throw new HttpError(413, "PAYLOAD_TOO_LARGE", "The evidence upload is too large.");
  }
  const form = await context.request.formData();
  const businessId = String(form.get("businessId") ?? "");
  const claimantRole = String(form.get("claimantRole") ?? "").trim();
  const details = String(form.get("details") ?? "").trim();
  const file = form.get("evidence");
  if (!z.string().uuid().safeParse(businessId).success) {
    throw new HttpError(422, "VALIDATION_ERROR", "Choose a valid business.", {
      businessId: "Choose a business",
    });
  }
  if (claimantRole.length < 2 || claimantRole.length > 80) {
    throw new HttpError(422, "VALIDATION_ERROR", "Check the highlighted fields.", {
      claimantRole: "Describe your role",
    });
  }
  if (details.length > 2_000) {
    throw new HttpError(422, "VALIDATION_ERROR", "Check the highlighted fields.", {
      details: "Use 2,000 characters or fewer",
    });
  }
  if (!(file instanceof File) || file.size === 0) {
    throw new HttpError(422, "VALIDATION_ERROR", "Evidence is required.", {
      evidence: "Choose a file",
    });
  }
  if (file.size > 8 * 1_024 * 1_024 || !ALLOWED_EVIDENCE_TYPES.has(file.type)) {
    throw new HttpError(
      422,
      "INVALID_FILE",
      "Upload a PDF, JPEG, PNG or WebP file no larger than 8 MB.",
    );
  }
  if (!(await hasValidEvidenceSignature(file))) {
    throw new HttpError(422, "INVALID_FILE", "The file contents do not match an allowed format.", {
      evidence: "Choose a genuine PDF, JPEG, PNG or WebP file",
    });
  }
  const business = await context.env.DB.prepare(
    "SELECT id FROM businesses WHERE id = ? AND status = 'published'",
  )
    .bind(businessId)
    .first<{ id: string }>();
  if (!business) throw new HttpError(404, "NOT_FOUND", "Business not found.");
  const activeClaim = await context.env.DB.prepare(
    `SELECT status FROM claims
      WHERE business_id = ? AND claimant_user_id = ?
        AND status IN ('pending', 'in_review', 'contested', 'approved')
      LIMIT 1`,
  )
    .bind(businessId, auth.user.id)
    .first<{ status: string }>();
  if (activeClaim) {
    throw new HttpError(
      409,
      "CLAIM_EXISTS",
      activeClaim.status === "approved"
        ? "This account already has approved ownership access."
        : "You already have an active claim for this business.",
    );
  }

  const id = crypto.randomUUID();
  const extension =
    file.type === "application/pdf"
      ? "pdf"
      : file.type === "image/png"
        ? "png"
        : file.type === "image/webp"
          ? "webp"
          : "jpg";
  const evidenceKey = `claims/${new Date().getUTCFullYear()}/${id}.${extension}`;
  await context.env.EVIDENCE.put(evidenceKey, file.stream(), {
    httpMetadata: { contentType: file.type },
    customMetadata: { claimId: id, uploaderId: auth.user.id },
  });

  const now = new Date().toISOString();
  try {
    await context.env.DB.prepare(
      `INSERT INTO claims
        (id, business_id, claimant_user_id, claimant_role, details, evidence_key, evidence_mime,
         evidence_size, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
      .bind(
        id,
        businessId,
        auth.user.id,
        claimantRole,
        details,
        evidenceKey,
        file.type,
        file.size,
        now,
        now,
      )
      .run();
  } catch (error) {
    await context.env.EVIDENCE.delete(evidenceKey);
    if (String(error).includes("UNIQUE")) {
      throw new HttpError(
        409,
        "CLAIM_EXISTS",
        "You already have an active claim for this business.",
      );
    }
    throw error;
  }
  await audit(context, auth.user.id, "claim.submitted", "claim", id, { businessId });
  return success({ id, status: "pending" }, context.requestId, { status: 201 });
}

async function listRooms(context: AppContext): Promise<Response> {
  const rows = await context.env.DB.prepare(
    `SELECT r.id, r.name, r.purpose, r.state, r.slot_limit, r.rules, r.verified_only,
            COUNT(CASE WHEN a.status = 'approved' THEN 1 END) AS member_count
       FROM contact_rooms r
       LEFT JOIN room_applications a ON a.room_id = r.id
      WHERE r.status = 'active'
      GROUP BY r.id
      ORDER BY r.created_at DESC
      LIMIT 100`,
  ).all<{
    id: string;
    name: string;
    purpose: string;
    state: string;
    slot_limit: number;
    rules: string;
    verified_only: number;
    member_count: number;
  }>();
  return success(
    {
      items: rows.results.map((row) => ({
        id: row.id,
        name: row.name,
        purpose: row.purpose,
        state: row.state,
        slotLimit: row.slot_limit,
        slotsLeft: Math.max(0, row.slot_limit - row.member_count),
        rules: row.rules,
        verifiedOnly: Boolean(row.verified_only),
        memberCount: row.member_count,
      })),
    },
    context.requestId,
    { headers: { "cache-control": "public, max-age=30, s-maxage=120" } },
  );
}

async function getRoom(context: AppContext, id: string): Promise<Response> {
  if (!z.string().uuid().safeParse(id).success)
    throw new HttpError(404, "NOT_FOUND", "Room not found.");
  const row = await context.env.DB.prepare(
    `SELECT r.id, r.name, r.purpose, r.state, r.slot_limit, r.rules, r.verified_only,
            COUNT(CASE WHEN a.status = 'approved' THEN 1 END) AS member_count
       FROM contact_rooms r
       LEFT JOIN room_applications a ON a.room_id = r.id
      WHERE r.id = ? AND r.status = 'active'
      GROUP BY r.id`,
  )
    .bind(id)
    .first<{
      id: string;
      name: string;
      purpose: string;
      state: string;
      slot_limit: number;
      rules: string;
      verified_only: number;
      member_count: number;
    }>();
  if (!row) throw new HttpError(404, "NOT_FOUND", "Room not found.");
  return success(
    {
      id: row.id,
      name: row.name,
      purpose: row.purpose,
      state: row.state,
      slotLimit: row.slot_limit,
      slotsLeft: Math.max(0, row.slot_limit - row.member_count),
      rules: row.rules,
      verifiedOnly: Boolean(row.verified_only),
      memberCount: row.member_count,
    },
    context.requestId,
    { headers: { "cache-control": "public, max-age=30, s-maxage=120" } },
  );
}

async function proposeRoom(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  await enforceRateLimit(context, "room-proposal", 2, 86_400, `user:${auth.user.id}`);
  const input = await parseJson(context.request, roomProposalSchema);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await context.env.DB.prepare(
      `INSERT INTO contact_rooms
        (id, owner_user_id, name, purpose, state, slot_limit, rules, verified_only,
         enforce_save_back, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    )
      .bind(
        id,
        auth.user.id,
        input.name,
        input.purpose,
        input.state,
        input.slotLimit,
        input.rules,
        input.verifiedOnly ? 1 : 0,
        0,
        now,
        now,
      )
      .run();
  } catch (error) {
    if (String(error).includes("UNIQUE")) {
      throw new HttpError(409, "ROOM_EXISTS", "A room with that name already exists.");
    }
    throw error;
  }
  await audit(context, auth.user.id, "room.proposed", "contact_room", id);
  return success({ id, status: "pending" }, context.requestId, { status: 201 });
}

async function applyToRoom(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  await enforceRateLimit(context, "room-application", 10, 86_400, `user:${auth.user.id}`);
  const input = await parseJson(context.request, roomApplicationSchema);
  const membership = await context.env.DB.prepare(
    `SELECT b.id, b.verification_level, r.verified_only
       FROM businesses b
       JOIN business_members bm ON bm.business_id = b.id
       JOIN contact_rooms r ON r.id = ?
      WHERE b.id = ? AND bm.user_id = ? AND b.status = 'published' AND r.status = 'active'`,
  )
    .bind(input.roomId, input.businessId, auth.user.id)
    .first<{ id: string; verification_level: string; verified_only: number }>();
  if (!membership) throw new HttpError(403, "FORBIDDEN", "You cannot apply with that business.");
  if (membership.verified_only && membership.verification_level === "unverified") {
    throw new HttpError(
      403,
      "VERIFICATION_REQUIRED",
      "This room only accepts verified businesses.",
    );
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await context.env.DB.prepare(
      `INSERT INTO room_applications
        (id, room_id, business_id, user_id, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'queued', ?, ?)`,
    )
      .bind(id, input.roomId, input.businessId, auth.user.id, now, now)
      .run();
  } catch (error) {
    if (!String(error).includes("UNIQUE")) throw error;

    // A business can only ever have one row per room. Rather than dead-ending on
    // a duplicate (which permanently blocks re-applying after leaving or being
    // declined), reopen the existing row when it is in a terminal state.
    const existing = await context.env.DB.prepare(
      `SELECT id, status FROM room_applications
        WHERE room_id = ? AND business_id = ?`,
    )
      .bind(input.roomId, input.businessId)
      .first<{ id: string; status: string }>();

    if (!existing || !["left", "rejected", "removed"].includes(existing.status)) {
      throw new HttpError(
        409,
        "APPLICATION_EXISTS",
        existing?.status === "queued"
          ? "This business already has an application waiting for review."
          : "This business is already a member of this room.",
      );
    }

    await context.env.DB.prepare(
      "UPDATE room_applications SET status = 'queued', user_id = ?, updated_at = ? WHERE id = ?",
    )
      .bind(auth.user.id, now, existing.id)
      .run();
    await audit(
      context,
      auth.user.id,
      "room.application_reopened",
      "room_application",
      existing.id,
    );
    return success({ id: existing.id, status: "queued" }, context.requestId);
  }
  await audit(context, auth.user.id, "room.application_created", "room_application", id);
  return success({ id, status: "queued" }, context.requestId, { status: 201 });
}

/**
 * Leave a contact circle.
 *
 * Membership is recorded as an approved application, so leaving marks that row
 * `left` rather than deleting it: the circle keeps an honest history of who
 * joined and when, and the business can apply again later.
 */
async function leaveRoom(context: AppContext, roomId: string): Promise<Response> {
  const auth = await requireUser(context);
  if (!z.string().uuid().safeParse(roomId).success) {
    throw new HttpError(404, "NOT_FOUND", "Room not found.");
  }

  /*
   * One person can hold more than one business, and each of those businesses
   * holds its own row in the room. Leaving has to release all of them: picking
   * a single row would silently leave the caller inside a circle they believe
   * they have walked away from.
   */
  const rows = await context.env.DB.prepare(
    `SELECT a.id, r.owner_user_id, r.name AS room_name, b.name AS business_name
       FROM room_applications a
       JOIN contact_rooms r ON r.id = a.room_id
       JOIN businesses b ON b.id = a.business_id
       JOIN business_members bm ON bm.business_id = a.business_id
      WHERE a.room_id = ? AND bm.user_id = ? AND a.status = 'approved'`,
  )
    .bind(roomId, auth.user.id)
    .all<{
      id: string;
      owner_user_id: string;
      room_name: string;
      business_name: string;
    }>();
  const [first, ...rest] = rows.results;
  if (!first) {
    throw new HttpError(409, "NOT_A_MEMBER", "You are not an active member of this room.");
  }

  const now = new Date().toISOString();
  const released = [first, ...rest];
  await context.env.DB.batch(
    released.map((row) =>
      context.env.DB.prepare(
        "UPDATE room_applications SET status = 'left', updated_at = ? WHERE id = ?",
      ).bind(now, row.id),
    ),
  );

  await audit(context, auth.user.id, "room.left", "room_application", first.id, {
    roomId,
    released: released.length,
  });
  await notify(
    context,
    first.owner_user_id,
    "room.member_left",
    `${first.business_name} left ${first.room_name}`,
    "A member has left your circle. Its slot is available again.",
    "/app/circles",
    { type: "room", id: roomId },
  );

  return success({ id: first.id, status: "left", released: released.length }, context.requestId);
}

/**
 * Lets a circle owner admit or decline a join request without a platform admin
 * acting as a go-between. The admission SQL is deliberately the same shape as
 * the admin path: it will not flip a row that is no longer queued, and it will
 * not overshoot the circle's slot limit even if two owners act at once.
 */
async function decideRoomApplication(
  context: AppContext,
  roomId: string,
  applicationId: string,
): Promise<Response> {
  const auth = await requireUser(context);
  if (!z.string().uuid().safeParse(roomId).success) {
    throw new HttpError(404, "NOT_FOUND", "Application not found.");
  }
  if (!z.string().uuid().safeParse(applicationId).success) {
    throw new HttpError(404, "NOT_FOUND", "Application not found.");
  }

  const owned = await context.env.DB.prepare(
    "SELECT id FROM contact_rooms WHERE id = ? AND owner_user_id = ?",
  )
    .bind(roomId, auth.user.id)
    .first<{ id: string }>();
  /*
   * A non-owner gets the same 404 as a nonexistent circle. Naming the room's
   * existence in the error would let anyone enumerate which circles are real.
   */
  if (!owned) throw new HttpError(404, "NOT_FOUND", "Application not found.");

  const input = await parseJson(context.request, roomApplicationDecisionSchema);
  const now = new Date().toISOString();

  if (input.action === "approve") {
    const write = await context.env.DB.prepare(
      `UPDATE room_applications
          SET status = 'approved', updated_at = ?
        WHERE id = ? AND room_id = ? AND status = 'queued'
          AND EXISTS (
            SELECT 1 FROM contact_rooms r
             WHERE r.id = room_applications.room_id AND r.status = 'active'
               AND (SELECT COUNT(*) FROM room_applications members
                     WHERE members.room_id = r.id AND members.status = 'approved') < r.slot_limit
          )`,
    )
      .bind(now, applicationId, roomId)
      .run();
    if (write.meta.changes === 0) {
      throw new HttpError(
        409,
        "ROOM_UNAVAILABLE",
        "This request is no longer queued, or the circle is already full.",
      );
    }
    await notifyRoomApplicant(context, applicationId, "room_application.approved", "approved", "");
  } else {
    const write = await context.env.DB.prepare(
      `UPDATE room_applications SET status = 'rejected', updated_at = ?
        WHERE id = ? AND room_id = ? AND status = 'queued'`,
    )
      .bind(now, applicationId, roomId)
      .run();
    if (write.meta.changes === 0) {
      throw new HttpError(409, "NOT_PENDING", "This request is no longer queued.");
    }
    await notifyRoomApplicant(
      context,
      applicationId,
      "room_application.rejected",
      "rejected",
      input.note ?? "",
    );
  }

  await audit(
    context,
    auth.user.id,
    input.action === "approve" ? "room.application_approved" : "room.application_rejected",
    "room_application",
    applicationId,
    { roomId },
  );

  return success(
    { id: applicationId, status: input.action === "approve" ? "approved" : "rejected" },
    context.requestId,
  );
}

async function createDataRequest(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  await enforceRateLimit(context, "data-request", 3, 86_400, `user:${auth.user.id}`);
  const input = await parseJson(context.request, dataRequestSchema);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    `INSERT INTO data_requests (id, user_id, kind, details, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, 'open', ?, ?)`,
  )
    .bind(id, auth.user.id, input.kind, input.details, now, now)
    .run();
  await audit(context, auth.user.id, "privacy.requested", "data_request", id, { kind: input.kind });
  return success({ id, status: "open" }, context.requestId, { status: 201 });
}

async function listSavedBusinesses(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  const rows = await context.env.DB.prepare(
    `SELECT b.id, b.slug, b.name, b.tagline, b.about, b.category_slug,
            c.name AS category_name, b.location_slug, b.city, b.state, b.address,
            b.rating_average, b.review_count, b.verification_level, b.is_open_now,
            b.whatsapp, b.phone, b.website, b.price_range, b.amenities_json,
            b.service_areas_json, b.socials_json,
            d.year_established, d.team_size
       FROM saved_businesses s
       JOIN businesses b ON b.id = s.business_id AND b.status = 'published'
       JOIN categories c ON c.slug = b.category_slug
       LEFT JOIN business_profile_details d ON d.business_id = b.id
      WHERE s.user_id = ?
      ORDER BY s.created_at DESC`,
  )
    .bind(auth.user.id)
    .all<BusinessRow & { year_established: number | null; team_size: string | null }>();

  const hoursById = await hoursForBusinesses(
    context,
    rows.results.map((row) => row.id),
  );
  const current = lagosNow();

  return success(
    {
      items: rows.results.map((row) => {
        const hours = hoursById.get(row.id) ?? [];
        return mapBusiness(row, {
          hours,
          openNow: hours.length
            ? isOpenAt(hours, current.dayOfWeek, current.minutes)
            : Boolean(row.is_open_now),
          yearEstablished: row.year_established ?? null,
          teamSize: row.team_size ?? "",
        });
      }),
    },
    context.requestId,
  );
}

async function saveBusiness(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  const input = await parseJson(context.request, saveBusinessSchema);
  if (input.saved) {
    const exists = await context.env.DB.prepare(
      "SELECT id FROM businesses WHERE id = ? AND status = 'published'",
    )
      .bind(input.businessId)
      .first<{ id: string }>();
    if (!exists) throw new HttpError(404, "NOT_FOUND", "Business not found.");
    await context.env.DB.prepare(
      `INSERT INTO saved_businesses (user_id, business_id, created_at) VALUES (?, ?, ?)
       ON CONFLICT (user_id, business_id) DO NOTHING`,
    )
      .bind(auth.user.id, input.businessId, new Date().toISOString())
      .run();
  } else {
    await context.env.DB.prepare(
      "DELETE FROM saved_businesses WHERE user_id = ? AND business_id = ?",
    )
      .bind(auth.user.id, input.businessId)
      .run();
  }
  return success({ saved: input.saved }, context.requestId);
}

async function recordContact(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "contact-event", 120, 3_600);
  const schema = z.object({
    businessId: z.string().uuid(),
    channel: z.enum(["whatsapp", "phone", "website", "directions"]),
    source: z.string().trim().min(1).max(80).optional().default("profile"),
  });
  const input = await parseJson(context.request, schema);
  const visitorHash = await privacyHash(context.ip, context.env);
  const result = await context.env.DB.prepare(
    `INSERT INTO contact_events (id, business_id, channel, source, visitor_hash, created_at)
     SELECT ?, id, ?, ?, ?, ? FROM businesses WHERE id = ? AND status = 'published'`,
  )
    .bind(
      crypto.randomUUID(),
      input.channel,
      input.source,
      visitorHash,
      new Date().toISOString(),
      input.businessId,
    )
    .run();
  if (result.meta.changes === 0) throw new HttpError(404, "NOT_FOUND", "Business not found.");
  return success({ recorded: true }, context.requestId, { status: 202 });
}

async function updateEnquiryStatus(context: AppContext, id: string): Promise<Response> {
  const auth = await requireUser(context);
  const parsedId = z.string().uuid().safeParse(id);
  if (!parsedId.success) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");
  const input = await parseJson(context.request, enquiryStatusSchema);
  const write = await context.env.DB.prepare(
    `UPDATE enquiries SET status = ?, updated_at = ?
      WHERE id = ? AND EXISTS (
        SELECT 1 FROM business_members bm
         WHERE bm.business_id = enquiries.business_id AND bm.user_id = ?
      )`,
  )
    .bind(input.status, new Date().toISOString(), parsedId.data, auth.user.id)
    .run();
  if (write.meta.changes === 0) throw new HttpError(404, "NOT_FOUND", "Enquiry not found.");
  await audit(context, auth.user.id, "enquiry.status_updated", "enquiry", parsedId.data, {
    status: input.status,
  });
  return success({ id: parsedId.data, status: input.status }, context.requestId);
}

async function workspaceSummary(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  const businesses = await context.env.DB.prepare(
    `SELECT b.id, b.slug, b.name, b.status, b.verification_level
       FROM businesses b
       JOIN business_members bm ON bm.business_id = b.id
      WHERE bm.user_id = ?
      ORDER BY b.updated_at DESC`,
  )
    .bind(auth.user.id)
    .all();
  const enquiries = await context.env.DB.prepare(
    `SELECT e.id, e.business_id, e.name, e.phone, e.message, e.status, e.created_at
       FROM enquiries e
       JOIN business_members bm ON bm.business_id = e.business_id
      WHERE bm.user_id = ?
      ORDER BY e.created_at DESC
      LIMIT 50`,
  )
    .bind(auth.user.id)
    .all();
  return success(
    { businesses: businesses.results, enquiries: enquiries.results },
    context.requestId,
  );
}

function businessSlug(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return slug || "business";
}

async function availableBusinessSlug(
  context: AppContext,
  name: string,
  id: string,
): Promise<string> {
  const base = businessSlug(name);
  const existing = await context.env.DB.prepare("SELECT id FROM businesses WHERE slug = ?")
    .bind(base)
    .first<{ id: string }>();
  return existing ? `${base}-${id.slice(0, 8)}` : base;
}

const NOTE_REQUIRED_ACTIONS = new Set(["reject", "resolve", "dismiss", "complete", "contest"]);

async function notifyRoomApplicant(
  context: AppContext,
  applicationId: string,
  kind: string,
  outcome: "approved" | "rejected",
  note: string,
): Promise<void> {
  const application = await context.env.DB.prepare(
    `SELECT a.user_id, r.name AS room_name, b.name AS business_name, r.status AS room_status
       FROM room_applications a
       JOIN contact_rooms r ON r.id = a.room_id
       JOIN businesses b ON b.id = a.business_id
      WHERE a.id = ?`,
  )
    .bind(applicationId)
    .first<{
      user_id: string;
      room_name: string;
      business_name: string;
      room_status: string;
    }>();
  if (!application) return;
  await notify(
    context,
    application.user_id,
    kind,
    outcome === "approved"
      ? `${application.business_name} joined ${application.room_name}`
      : `${application.business_name} was not admitted to ${application.room_name}`,
    outcome === "approved"
      ? "Your business is now listed in the circle and can receive member enquiries."
      : note || "The circle owner or our team did not admit this application.",
    "/app",
    { type: "room_application", id: applicationId },
  );
}

async function moderate(context: AppContext, queue: string, id: string): Promise<Response> {
  const auth = await requireAdmin(context);
  const body = await parseJson(
    context.request,
    z.object({
      action: moderationActionSchema.shape.action,
      note: moderationActionSchema.shape.note,
    }),
  );
  const parsed = moderationActionSchema.safeParse({ queue, id, ...body });
  if (!parsed.success) {
    throw new HttpError(
      422,
      "VALIDATION_ERROR",
      "Check the moderation action.",
      validationFields(parsed.error),
    );
  }
  const input = parsed.data;
  if (NOTE_REQUIRED_ACTIONS.has(input.action) && input.note.length < 10) {
    throw new HttpError(422, "VALIDATION_ERROR", "Add a short decision note.", {
      note: "Use at least 10 characters for this decision",
    });
  }

  const now = new Date().toISOString();
  let result: JsonRecord = { id: input.id, queue: input.queue, action: input.action };

  if (input.queue === "listing_applications") {
    const application = await context.env.DB.prepare(
      `SELECT a.*, l.name AS location_name, l.state AS location_state
         FROM listing_applications a
         JOIN locations l ON l.slug = a.location_slug
        WHERE a.id = ? AND a.status IN ('pending', 'in_review')`,
    )
      .bind(input.id)
      .first<{
        id: string;
        applicant_user_id: string | null;
        business_name: string;
        tagline: string;
        about: string;
        category_slug: string;
        location_slug: string;
        location_name: string;
        location_state: string;
        address: string;
        whatsapp: string;
        phone: string;
        website: string;
        status: string;
      }>();
    if (!application)
      throw new HttpError(409, "NOT_PENDING", "This application is no longer pending.");

    if (input.action === "start_review") {
      await context.env.DB.prepare(
        `UPDATE listing_applications
            SET status = 'in_review', reviewer_user_id = ?, review_note = ?, updated_at = ?
          WHERE id = ? AND status = 'pending'`,
      )
        .bind(auth.user.id, input.note, now, input.id)
        .run();
    } else if (input.action === "reject") {
      await context.env.DB.prepare(
        `UPDATE listing_applications
            SET status = 'rejected', reviewer_user_id = ?, review_note = ?, updated_at = ?
          WHERE id = ?`,
      )
        .bind(auth.user.id, input.note, now, input.id)
        .run();
      if (application.applicant_user_id) {
        await notify(
          context,
          application.applicant_user_id,
          "listing.rejected",
          `${application.business_name} was not published`,
          input.note ||
            "Our review team could not publish this listing yet. You may submit a corrected application.",
          "/join",
          { type: "listing_application", id: input.id },
        );
      }
    } else if (input.action === "approve") {
      const businessId = crypto.randomUUID();
      const slug = await availableBusinessSlug(context, application.business_name, businessId);
      const statements = [
        context.env.DB.prepare(
          `INSERT INTO businesses
            (id, slug, owner_user_id, name, tagline, about, category_slug, location_slug, city,
             state, address, whatsapp, phone, website, verification_level, rating_average,
             review_count, is_open_now, status, published_at, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unverified', 0, 0, 0,
                   'published', ?, ?, ?)`,
        ).bind(
          businessId,
          slug,
          application.applicant_user_id,
          application.business_name,
          application.tagline,
          application.about,
          application.category_slug,
          application.location_slug,
          application.location_name,
          application.location_state,
          application.address,
          application.whatsapp,
          application.phone,
          application.website,
          now,
          now,
          now,
        ),
        context.env.DB.prepare(
          `UPDATE listing_applications
              SET status = 'approved', reviewer_user_id = ?, review_note = ?, updated_at = ?
            WHERE id = ?`,
        ).bind(auth.user.id, input.note, now, input.id),
      ];
      if (application.applicant_user_id) {
        statements.push(
          context.env.DB.prepare(
            `INSERT INTO business_members (business_id, user_id, role, created_at)
             VALUES (?, ?, 'owner', ?)
             ON CONFLICT (business_id, user_id) DO UPDATE SET role = 'owner'`,
          ).bind(businessId, application.applicant_user_id, now),
          context.env.DB.prepare(
            `UPDATE users SET role = CASE WHEN role = 'consumer' THEN 'business_owner' ELSE role END,
                              updated_at = ? WHERE id = ?`,
          ).bind(now, application.applicant_user_id),
        );
      }
      await context.env.DB.batch(statements);
      if (application.applicant_user_id) {
        await notify(
          context,
          application.applicant_user_id,
          "listing.approved",
          `${application.business_name} is live`,
          "Your listing passed review and is now published. You can refine details and opening hours from the workspace.",
          `/business/${slug}`,
          { type: "business", id: businessId },
        );
      }
      result = { ...result, businessId, slug };
    } else {
      throw new HttpError(
        422,
        "INVALID_ACTION",
        "That action is not valid for a listing application.",
      );
    }
  } else if (input.queue === "reviews") {
    const review = await context.env.DB.prepare(
      `SELECT r.business_id, r.status, r.author_user_id, b.name AS business_name, b.slug AS business_slug
         FROM reviews r JOIN businesses b ON b.id = r.business_id
        WHERE r.id = ? AND r.status IN ('pending', 'disputed')`,
    )
      .bind(input.id)
      .first<{
        business_id: string;
        status: string;
        author_user_id: string;
        business_name: string;
        business_slug: string;
      }>();
    if (!review) throw new HttpError(409, "NOT_PENDING", "This review is no longer pending.");
    const status =
      input.action === "approve" ? "published" : input.action === "reject" ? "rejected" : null;
    if (!status)
      throw new HttpError(422, "INVALID_ACTION", "That action is not valid for a review.");
    await context.env.DB.batch([
      context.env.DB.prepare("UPDATE reviews SET status = ?, updated_at = ? WHERE id = ?").bind(
        status,
        now,
        input.id,
      ),
      context.env.DB.prepare(
        `UPDATE businesses
            SET rating_average = COALESCE((SELECT AVG(rating) FROM reviews WHERE business_id = ? AND status = 'published'), 0),
                review_count = (SELECT COUNT(*) FROM reviews WHERE business_id = ? AND status = 'published'),
                updated_at = ?
          WHERE id = ?`,
      ).bind(review.business_id, review.business_id, now, review.business_id),
    ]);
    await notify(
      context,
      review.author_user_id,
      status === "published" ? "review.approved" : "review.rejected",
      status === "published"
        ? `Your review of ${review.business_name} is published`
        : `Your review of ${review.business_name} was not published`,
      status === "published"
        ? "Thank you — your review is now visible on the business profile."
        : input.note ||
            "Our review team could not publish this review. You may submit a new one later.",
      `/business/${review.business_slug}`,
      { type: "review", id: input.id },
    );
  } else if (input.queue === "claims") {
    const claim = await context.env.DB.prepare(
      `SELECT business_id, claimant_user_id, status FROM claims
        WHERE id = ? AND status IN ('pending', 'in_review', 'contested')`,
    )
      .bind(input.id)
      .first<{ business_id: string; claimant_user_id: string; status: string }>();
    if (!claim) throw new HttpError(409, "NOT_PENDING", "This claim is no longer pending.");
    const status =
      input.action === "start_review"
        ? "in_review"
        : input.action === "approve"
          ? "approved"
          : input.action === "reject"
            ? "rejected"
            : input.action === "contest"
              ? "contested"
              : null;
    if (!status)
      throw new HttpError(422, "INVALID_ACTION", "That action is not valid for a claim.");
    const statements = [
      context.env.DB.prepare("UPDATE claims SET status = ?, updated_at = ? WHERE id = ?").bind(
        status,
        now,
        input.id,
      ),
    ];
    if (status === "approved") {
      statements.push(
        context.env.DB.prepare(
          `INSERT INTO business_members (business_id, user_id, role, created_at)
           VALUES (?, ?, 'owner', ?)
           ON CONFLICT (business_id, user_id) DO UPDATE SET role = 'owner'`,
        ).bind(claim.business_id, claim.claimant_user_id, now),
        context.env.DB.prepare(
          "UPDATE businesses SET owner_user_id = COALESCE(owner_user_id, ?), updated_at = ? WHERE id = ?",
        ).bind(claim.claimant_user_id, now, claim.business_id),
        context.env.DB.prepare(
          `UPDATE users SET role = CASE WHEN role = 'consumer' THEN 'business_owner' ELSE role END,
                            updated_at = ? WHERE id = ?`,
        ).bind(now, claim.claimant_user_id),
      );
    }
    await context.env.DB.batch(statements);
    await notify(
      context,
      claim.claimant_user_id,
      status === "approved"
        ? "claim.approved"
        : status === "rejected"
          ? "claim.rejected"
          : "claim.updated",
      status === "approved"
        ? "Ownership confirmed"
        : status === "rejected"
          ? "Ownership claim was not approved"
          : "Your ownership claim was updated",
      status === "approved"
        ? "Your evidence was accepted. The business workspace is now available to you."
        : status === "rejected"
          ? input.note ||
            "We could not confirm ownership from the evidence supplied. You may reapply with stronger proof."
          : `Claim status is now "${status}".`,
      status === "approved" ? "/app" : "/claim",
      { type: "claim", id: input.id },
    );
  } else if (input.queue === "reports") {
    const status =
      input.action === "start_review"
        ? "in_review"
        : input.action === "resolve"
          ? "resolved"
          : input.action === "dismiss"
            ? "dismissed"
            : null;
    if (!status)
      throw new HttpError(422, "INVALID_ACTION", "That action is not valid for a report.");
    const write = await context.env.DB.prepare(
      "UPDATE reports SET status = ?, updated_at = ? WHERE id = ? AND status IN ('open', 'in_review')",
    )
      .bind(status, now, input.id)
      .run();
    if (write.meta.changes === 0)
      throw new HttpError(409, "NOT_PENDING", "This report is no longer open.");
    const reporter = await context.env.DB.prepare(
      "SELECT reporter_user_id FROM reports WHERE id = ?",
    )
      .bind(input.id)
      .first<{ reporter_user_id: string | null }>();
    if (reporter?.reporter_user_id) {
      await notify(
        context,
        reporter.reporter_user_id,
        status === "resolved" ? "report.resolved" : "report.updated",
        status === "resolved" ? "Your report was resolved" : "Your report was updated",
        status === "resolved"
          ? input.note || "Thank you — our team has acted on this report."
          : `Report status is now "${status}".`,
        "/trust-safety",
        { type: "report", id: input.id },
      );
    }
  } else if (input.queue === "rooms") {
    const status =
      input.action === "approve" ? "active" : input.action === "reject" ? "rejected" : null;
    if (!status)
      throw new HttpError(422, "INVALID_ACTION", "That action is not valid for a room proposal.");
    const write = await context.env.DB.prepare(
      "UPDATE contact_rooms SET status = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
    )
      .bind(status, now, input.id)
      .run();
    if (write.meta.changes === 0)
      throw new HttpError(409, "NOT_PENDING", "This room is no longer pending.");
    const room = await context.env.DB.prepare(
      "SELECT owner_user_id, name FROM contact_rooms WHERE id = ?",
    )
      .bind(input.id)
      .first<{ owner_user_id: string; name: string }>();
    if (room) {
      await notify(
        context,
        room.owner_user_id,
        status === "active" ? "room.approved" : "room.rejected",
        status === "active" ? `${room.name} is live` : `${room.name} was not approved`,
        status === "active"
          ? "Your contact circle is now open for business applications."
          : input.note || "This circle proposal did not meet our publication rules.",
        status === "active" ? `/contact-gain/${input.id}` : "/contact-gain/create",
        { type: "room", id: input.id },
      );
    }
  } else if (input.queue === "room_applications") {
    if (input.action === "approve") {
      const write = await context.env.DB.prepare(
        `UPDATE room_applications
            SET status = 'approved', updated_at = ?
          WHERE id = ? AND status = 'queued'
            AND EXISTS (
              SELECT 1 FROM contact_rooms r
               WHERE r.id = room_applications.room_id AND r.status = 'active'
                 AND (SELECT COUNT(*) FROM room_applications members
                       WHERE members.room_id = r.id AND members.status = 'approved') < r.slot_limit
            )`,
      )
        .bind(now, input.id)
        .run();
      if (write.meta.changes === 0) {
        throw new HttpError(
          409,
          "ROOM_UNAVAILABLE",
          "The application is no longer queued or the room is full.",
        );
      }
      await notifyRoomApplicant(
        context,
        input.id,
        "room_application.approved",
        "approved",
        input.note,
      );
    } else if (input.action === "reject") {
      const write = await context.env.DB.prepare(
        "UPDATE room_applications SET status = 'rejected', updated_at = ? WHERE id = ? AND status = 'queued'",
      )
        .bind(now, input.id)
        .run();
      if (write.meta.changes === 0)
        throw new HttpError(409, "NOT_PENDING", "This application is no longer queued.");
      await notifyRoomApplicant(
        context,
        input.id,
        "room_application.rejected",
        "rejected",
        input.note,
      );
    } else {
      throw new HttpError(
        422,
        "INVALID_ACTION",
        "That action is not valid for a room application.",
      );
    }
  } else if (input.queue === "suggestions") {
    const status =
      input.action === "start_review"
        ? "in_review"
        : input.action === "approve"
          ? "accepted"
          : input.action === "reject"
            ? "rejected"
            : null;
    if (!status)
      throw new HttpError(422, "INVALID_ACTION", "That action is not valid for a suggestion.");
    const write = await context.env.DB.prepare(
      "UPDATE suggestions SET status = ?, updated_at = ? WHERE id = ? AND status IN ('pending', 'in_review')",
    )
      .bind(status, now, input.id)
      .run();
    if (write.meta.changes === 0)
      throw new HttpError(409, "NOT_PENDING", "This suggestion is no longer pending.");
    const suggestion = await context.env.DB.prepare(
      "SELECT submitter_user_id, business_name FROM suggestions WHERE id = ?",
    )
      .bind(input.id)
      .first<{ submitter_user_id: string | null; business_name: string }>();
    if (suggestion?.submitter_user_id) {
      await notify(
        context,
        suggestion.submitter_user_id,
        status === "accepted" ? "suggestion.accepted" : "suggestion.updated",
        status === "accepted"
          ? `Thanks — your note about ${suggestion.business_name} was accepted`
          : `Your suggestion about ${suggestion.business_name} was updated`,
        status === "accepted"
          ? "Our team has applied your correction to the directory."
          : `Suggestion status is now "${status}".`,
        "/suggest-business",
        { type: "suggestion", id: input.id },
      );
    }
  } else if (input.queue === "data_requests") {
    const status =
      input.action === "mark_verifying"
        ? "verifying"
        : input.action === "mark_processing"
          ? "processing"
          : input.action === "complete"
            ? "completed"
            : input.action === "reject"
              ? "rejected"
              : null;
    if (!status)
      throw new HttpError(422, "INVALID_ACTION", "That action is not valid for a data request.");
    const write = await context.env.DB.prepare(
      `UPDATE data_requests SET status = ?, updated_at = ?
        WHERE id = ? AND status IN ('open', 'verifying', 'processing')`,
    )
      .bind(status, now, input.id)
      .run();
    if (write.meta.changes === 0)
      throw new HttpError(409, "NOT_PENDING", "This request is no longer active.");
    const request = await context.env.DB.prepare(
      "SELECT user_id, kind FROM data_requests WHERE id = ?",
    )
      .bind(input.id)
      .first<{ user_id: string; kind: string }>();
    if (request) {
      await notify(
        context,
        request.user_id,
        status === "completed" ? "data_request.completed" : "data_request.updated",
        status === "completed"
          ? "Your data request is complete"
          : `Your data request moved to "${status}"`,
        status === "completed"
          ? input.note || `Your ${request.kind} request has been fulfilled.`
          : input.note || `We are progressing your ${request.kind} request.`,
        "/legal/data-request",
        { type: "data_request", id: input.id },
      );
    }
  }

  await audit(context, auth.user.id, "admin.moderated", input.queue, input.id, {
    action: input.action,
    note: input.note,
  });
  return success(result, context.requestId);
}

async function claimEvidence(context: AppContext, id: string): Promise<Response> {
  const auth = await requireAdmin(context);
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) throw new HttpError(404, "NOT_FOUND", "Claim evidence not found.");
  const claim = await context.env.DB.prepare(
    "SELECT evidence_key, evidence_mime FROM claims WHERE id = ? AND evidence_deleted_at IS NULL",
  )
    .bind(parsed.data)
    .first<{ evidence_key: string; evidence_mime: string }>();
  if (!claim) throw new HttpError(404, "NOT_FOUND", "Claim evidence not found.");
  const object = await context.env.EVIDENCE.get(claim.evidence_key);
  if (!object) throw new HttpError(404, "NOT_FOUND", "Claim evidence not found.");
  await audit(context, auth.user.id, "admin.claim_evidence_viewed", "claim", parsed.data);
  const extension =
    claim.evidence_mime === "application/pdf"
      ? "pdf"
      : claim.evidence_mime === "image/png"
        ? "png"
        : claim.evidence_mime === "image/webp"
          ? "webp"
          : "jpg";
  return new Response(object.body, {
    headers: {
      "content-type": claim.evidence_mime,
      "content-disposition": `attachment; filename="claim-evidence-${parsed.data}.${extension}"`,
      "cache-control": "private, no-store",
      "x-request-id": context.requestId,
    },
  });
}

async function adminQueue(context: AppContext): Promise<Response> {
  const auth = await requireAdmin(context);
  const [
    counts,
    listingApplications,
    claims,
    reports,
    reviews,
    rooms,
    roomApplications,
    suggestions,
    dataRequests,
  ] = await Promise.all([
    context.env.DB.prepare(
      `SELECT
        (SELECT COUNT(*) FROM listing_applications WHERE status IN ('pending', 'in_review')) AS listing_applications,
        (SELECT COUNT(*) FROM claims WHERE status IN ('pending', 'in_review', 'contested')) AS claims,
        (SELECT COUNT(*) FROM reports WHERE status IN ('open', 'in_review')) AS reports,
        (SELECT COUNT(*) FROM reviews WHERE status IN ('pending', 'disputed')) AS reviews,
        (SELECT COUNT(*) FROM contact_rooms WHERE status = 'pending') AS rooms,
        (SELECT COUNT(*) FROM room_applications WHERE status = 'queued') AS room_applications,
        (SELECT COUNT(*) FROM suggestions WHERE status IN ('pending', 'in_review')) AS suggestions,
        (SELECT COUNT(*) FROM data_requests WHERE status IN ('open', 'verifying', 'processing')) AS data_requests`,
    ).first<Record<string, number>>(),
    context.env.DB.prepare(
      `SELECT id, owner_name, email, business_name, tagline, category_slug, location_slug,
                address, whatsapp, phone, website, about, status, created_at
           FROM listing_applications WHERE status IN ('pending', 'in_review')
          ORDER BY created_at ASC LIMIT 50`,
    ).all(),
    context.env.DB.prepare(
      `SELECT c.id, c.business_id, b.name AS business_name, c.claimant_user_id,
                u.full_name AS claimant_name, u.email AS claimant_email, c.claimant_role,
                c.details, c.evidence_mime, c.evidence_size, c.status, c.created_at
           FROM claims c JOIN businesses b ON b.id = c.business_id
           JOIN users u ON u.id = c.claimant_user_id
          WHERE c.status IN ('pending', 'in_review', 'contested')
          ORDER BY c.created_at ASC LIMIT 50`,
    ).all(),
    context.env.DB.prepare(
      `SELECT id, target_type, target_id, reason, details, contact_email, risk, status, created_at
           FROM reports WHERE status IN ('open', 'in_review')
          ORDER BY risk DESC, created_at ASC LIMIT 50`,
    ).all(),
    context.env.DB.prepare(
      `SELECT r.id, r.business_id, b.name AS business_name, u.full_name AS author_name,
                r.rating, r.body, r.status, r.created_at
           FROM reviews r JOIN businesses b ON b.id = r.business_id
           JOIN users u ON u.id = r.author_user_id
          WHERE r.status IN ('pending', 'disputed') ORDER BY r.created_at ASC LIMIT 50`,
    ).all(),
    context.env.DB.prepare(
      `SELECT r.id, r.name, r.purpose, r.state, r.slot_limit, r.rules, r.verified_only,
                r.status, r.created_at, u.full_name AS owner_name,
                u.email AS owner_email
           FROM contact_rooms r JOIN users u ON u.id = r.owner_user_id
          WHERE r.status = 'pending' ORDER BY r.created_at ASC LIMIT 50`,
    ).all(),
    context.env.DB.prepare(
      `SELECT a.id, a.room_id, r.name AS room_name, a.business_id, b.name AS business_name,
                u.full_name AS applicant_name, a.status, a.created_at
           FROM room_applications a JOIN contact_rooms r ON r.id = a.room_id
           JOIN businesses b ON b.id = a.business_id JOIN users u ON u.id = a.user_id
          WHERE a.status = 'queued' ORDER BY a.created_at ASC LIMIT 50`,
    ).all(),
    context.env.DB.prepare(
      `SELECT id, type, category_slug, business_name, phone, address, details, contact_email,
                status, created_at FROM suggestions WHERE status IN ('pending', 'in_review')
          ORDER BY created_at ASC LIMIT 50`,
    ).all(),
    context.env.DB.prepare(
      `SELECT d.id, d.kind, d.details, d.status, d.created_at, u.id AS user_id,
                u.full_name, u.email, u.phone
           FROM data_requests d JOIN users u ON u.id = d.user_id
          WHERE d.status IN ('open', 'verifying', 'processing') ORDER BY d.created_at ASC LIMIT 50`,
    ).all(),
  ]);
  await audit(context, auth.user.id, "admin.queue_viewed", "admin", "queue");
  return success(
    {
      counts: [
        "listing_applications",
        "claims",
        "reports",
        "reviews",
        "rooms",
        "room_applications",
        "suggestions",
        "data_requests",
      ].map((queue) => ({ queue, count: counts?.[queue] ?? 0 })),
      items: {
        listing_applications: listingApplications.results,
        claims: claims.results,
        reports: reports.results,
        reviews: reviews.results,
        rooms: rooms.results,
        room_applications: roomApplications.results,
        suggestions: suggestions.results,
        data_requests: dataRequests.results,
      },
    },
    context.requestId,
  );
}

/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

async function listNotifications(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  const [rows, unread] = await Promise.all([
    context.env.DB.prepare(
      `SELECT id, kind, title, body, href, read_at, created_at
         FROM notifications WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 50`,
    )
      .bind(auth.user.id)
      .all<{
        id: string;
        kind: string;
        title: string;
        body: string;
        href: string;
        read_at: string | null;
        created_at: string;
      }>(),
    context.env.DB.prepare(
      "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read_at IS NULL",
    )
      .bind(auth.user.id)
      .first<{ total: number }>(),
  ]);
  return success(
    {
      items: rows.results.map((row) => ({
        id: row.id,
        kind: row.kind,
        title: row.title,
        body: row.body,
        href: row.href,
        readAt: row.read_at,
        createdAt: row.created_at,
      })),
      unreadCount: unread?.total ?? 0,
    },
    context.requestId,
  );
}

async function markNotificationsRead(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  const input = await parseJson(context.request, notificationsReadSchema);
  const now = new Date().toISOString();
  if (input.all || !input.ids?.length) {
    await context.env.DB.prepare(
      "UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL",
    )
      .bind(now, auth.user.id)
      .run();
    return success({ updated: true }, context.requestId);
  }
  const placeholders = input.ids.map(() => "?").join(", ");
  await context.env.DB.prepare(
    `UPDATE notifications SET read_at = ?
      WHERE user_id = ? AND read_at IS NULL AND id IN (${placeholders})`,
  )
    .bind(now, auth.user.id, ...input.ids)
    .run();
  return success({ updated: true }, context.requestId);
}

/* -------------------------------------------------------------------------- */
/* Owner analytics — the "contact gain" the product is named for               */
/* -------------------------------------------------------------------------- */

async function workspaceInsights(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  const days = Math.min(90, Math.max(7, Number(context.url.searchParams.get("days") ?? 30) || 30));
  const to = new Date();
  const from = new Date(to.getTime() - days * 86_400_000);
  const fromIso = from.toISOString();

  const owned = context.env.DB.prepare(
    `SELECT b.id, b.name, b.slug, b.rating_average, b.review_count
       FROM businesses b JOIN business_members bm ON bm.business_id = b.id
      WHERE bm.user_id = ?`,
  ).bind(auth.user.id);

  const [businesses, totals, byChannel, byDay, byBusiness, recent, enquiries] = await Promise.all([
    owned.all<{
      id: string;
      name: string;
      slug: string;
      rating_average: number;
      review_count: number;
    }>(),
    context.env.DB.prepare(
      `SELECT COUNT(*) AS contacts, COUNT(DISTINCT e.visitor_hash) AS unique_visitors,
              COUNT(CASE WHEN e.channel = 'whatsapp' THEN 1 END) AS whatsapp,
              COUNT(CASE WHEN e.channel = 'phone' THEN 1 END) AS phone,
              COUNT(CASE WHEN e.channel = 'website' THEN 1 END) AS website,
              COUNT(CASE WHEN e.channel = 'directions' THEN 1 END) AS directions
         FROM contact_events e
         JOIN business_members bm ON bm.business_id = e.business_id
        WHERE bm.user_id = ? AND e.created_at >= ?`,
    )
      .bind(auth.user.id, fromIso)
      .first<{
        contacts: number;
        unique_visitors: number;
        whatsapp: number;
        phone: number;
        website: number;
        directions: number;
      }>(),
    context.env.DB.prepare(
      `SELECT e.channel, COUNT(*) AS count
         FROM contact_events e
         JOIN business_members bm ON bm.business_id = e.business_id
        WHERE bm.user_id = ? AND e.created_at >= ?
        GROUP BY e.channel ORDER BY count DESC`,
    )
      .bind(auth.user.id, fromIso)
      .all<{ channel: string; count: number }>(),
    context.env.DB.prepare(
      `SELECT substr(e.created_at, 1, 10) AS date,
              COUNT(*) AS contacts,
              0 AS enquiries
         FROM contact_events e
         JOIN business_members bm ON bm.business_id = e.business_id
        WHERE bm.user_id = ? AND e.created_at >= ?
        GROUP BY date ORDER BY date ASC`,
    )
      .bind(auth.user.id, fromIso)
      .all<{ date: string; contacts: number; enquiries: number }>(),
    context.env.DB.prepare(
      `SELECT b.id, b.name, b.slug,
              (SELECT COUNT(*) FROM contact_events e
                WHERE e.business_id = b.id AND e.created_at >= ?) AS contacts,
              (SELECT COUNT(DISTINCT e.visitor_hash) FROM contact_events e
                WHERE e.business_id = b.id AND e.created_at >= ?) AS unique_visitors,
              (SELECT COUNT(*) FROM enquiries q
                WHERE q.business_id = b.id AND q.created_at >= ?) AS enquiries,
              (SELECT COUNT(*) FROM saved_businesses s WHERE s.business_id = b.id) AS saved_by
         FROM businesses b JOIN business_members bm ON bm.business_id = b.id
        WHERE bm.user_id = ?
        ORDER BY contacts DESC, b.name ASC`,
    )
      .bind(fromIso, fromIso, fromIso, auth.user.id)
      .all<{
        id: string;
        name: string;
        slug: string;
        contacts: number;
        unique_visitors: number;
        enquiries: number;
        saved_by: number;
      }>(),
    context.env.DB.prepare(
      `SELECT e.channel, b.name AS business_name, e.created_at
         FROM contact_events e
         JOIN businesses b ON b.id = e.business_id
         JOIN business_members bm ON bm.business_id = e.business_id
        WHERE bm.user_id = ? AND e.created_at >= ?
        ORDER BY e.created_at DESC LIMIT 12`,
    )
      .bind(auth.user.id, fromIso)
      .all<{ channel: string; business_name: string; created_at: string }>(),
    context.env.DB.prepare(
      `SELECT substr(q.created_at, 1, 10) AS date, COUNT(*) AS enquiries
         FROM enquiries q
         JOIN business_members bm ON bm.business_id = q.business_id
        WHERE bm.user_id = ? AND q.created_at >= ?
        GROUP BY date`,
    )
      .bind(auth.user.id, fromIso)
      .all<{ date: string; enquiries: number }>(),
  ]);

  const ratingById = new Map(businesses.results.map((row) => [row.id, row]));
  const enquiryByDate = new Map(enquiries.results.map((row) => [row.date, row.enquiries]));
  const totalsRow = totals ?? {
    contacts: 0,
    unique_visitors: 0,
    whatsapp: 0,
    phone: 0,
    website: 0,
    directions: 0,
  };

  return success(
    {
      range: { from: fromIso, to: to.toISOString() },
      totals: {
        contacts: totalsRow.contacts,
        uniqueVisitors: totalsRow.unique_visitors,
        enquiries: enquiries.results.reduce((sum, row) => sum + row.enquiries, 0),
        whatsapp: totalsRow.whatsapp,
        phone: totalsRow.phone,
        website: totalsRow.website,
        directions: totalsRow.directions,
      },
      byChannel: byChannel.results.map((row) => ({ channel: row.channel, count: row.count })),
      byDay: byDay.results.map((row) => ({
        date: row.date,
        contacts: row.contacts,
        enquiries: enquiryByDate.get(row.date) ?? 0,
      })),
      byBusiness: byBusiness.results.map((row) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        contacts: row.contacts,
        uniqueVisitors: row.unique_visitors,
        enquiries: row.enquiries,
        reviews: ratingById.get(row.id)?.review_count ?? 0,
        rating: Number(ratingById.get(row.id)?.rating_average ?? 0),
        savedBy: row.saved_by,
      })),
      recentContacts: recent.results.map((row) => ({
        channel: row.channel,
        businessName: row.business_name,
        createdAt: row.created_at,
      })),
    },
    context.requestId,
  );
}

/* -------------------------------------------------------------------------- */
/* Owner listing management                                                    */
/* -------------------------------------------------------------------------- */

async function requireManagedBusiness(context: AuthContext, businessId: string) {
  const row = await context.env.DB.prepare(
    `SELECT b.id, b.slug, b.name, b.status
       FROM businesses b JOIN business_members bm ON bm.business_id = b.id
      WHERE b.id = ? AND bm.user_id = ?`,
  )
    .bind(businessId, context.user.id)
    .first<{ id: string; slug: string; name: string; status: string }>();
  if (!row) throw new HttpError(404, "NOT_FOUND", "Business not found.");
  return row;
}

async function getManagedBusiness(context: AppContext, businessId: string): Promise<Response> {
  const auth = await requireUser(context);
  const business = await requireManagedBusiness(auth, businessId);
  const [row, hours, services] = await Promise.all([
    context.env.DB.prepare(
      `SELECT tagline, about, whatsapp, phone, website, address, price_range,
              amenities_json, service_areas_json, socials_json
         FROM businesses WHERE id = ?`,
    )
      .bind(business.id)
      .first<{
        tagline: string;
        about: string;
        whatsapp: string;
        phone: string;
        website: string;
        address: string;
        price_range: string;
        amenities_json: string;
        service_areas_json: string;
        socials_json: string;
      }>(),
    context.env.DB.prepare(
      `SELECT day_of_week, is_closed, opens_at, closes_at
         FROM business_hours WHERE business_id = ? ORDER BY day_of_week`,
    )
      .bind(business.id)
      .all<{
        day_of_week: number;
        is_closed: number;
        opens_at: string;
        closes_at: string;
      }>(),
    context.env.DB.prepare(
      `SELECT id, name, price, note FROM business_services
        WHERE business_id = ? AND is_active = 1 ORDER BY sort_order, id`,
    )
      .bind(business.id)
      .all<{ id: string; name: string; price: string; note: string }>(),
  ]);
  if (!row) throw new HttpError(404, "NOT_FOUND", "Business not found.");

  return success(
    {
      id: business.id,
      slug: business.slug,
      name: business.name,
      status: business.status,
      tagline: row.tagline,
      about: row.about,
      whatsapp: row.whatsapp,
      phone: row.phone,
      website: row.website,
      address: row.address,
      priceRange: row.price_range ?? "",
      amenities: parseJsonArray<string>(row.amenities_json, []),
      serviceAreas: parseJsonArray<string>(row.service_areas_json, []),
      socials: parseJsonArray<{ label: string; handle: string }>(row.socials_json, []),
      hours: hoursFromRows(hours.results),
      services: services.results,
    },
    context.requestId,
  );
}

async function updateManagedBusiness(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  const input = await parseJson(context.request, updateBusinessSchema);
  const business = await requireManagedBusiness(auth, input.businessId);

  const whatsapp = normalizePhone(input.whatsapp);
  const phone = normalizePhone(input.phone);
  const now = new Date().toISOString();

  const hoursInput = input.hours ?? [];
  const servicesInput = input.services ?? [];

  // Duplicate days would silently overwrite in the upsert below; reject them first.
  const seenDays = new Set<number>();
  for (const entry of hoursInput) {
    if (seenDays.has(entry.dayOfWeek)) {
      throw new HttpError(422, "VALIDATION_ERROR", "Check the highlighted fields.", {
        hours: "Each day may only appear once",
      });
    }
    seenDays.add(entry.dayOfWeek);
  }

  const statements: D1PreparedStatement[] = [
    context.env.DB.prepare(
      `UPDATE businesses
          SET tagline = ?, about = ?, whatsapp = ?, phone = ?, website = ?,
              address = ?, price_range = ?, amenities_json = ?, service_areas_json = ?,
              socials_json = ?, updated_at = ?
        WHERE id = ?`,
    ).bind(
      input.tagline,
      input.about,
      whatsapp ?? "",
      phone ?? "",
      input.website,
      input.address,
      input.priceRange,
      JSON.stringify(input.amenities),
      JSON.stringify(input.serviceAreas),
      JSON.stringify(input.socials),
      now,
      business.id,
    ),
    context.env.DB.prepare("UPDATE business_services SET is_active = 0 WHERE business_id = ?").bind(
      business.id,
    ),
    context.env.DB.prepare("DELETE FROM business_hours WHERE business_id = ?").bind(business.id),
  ];

  servicesInput.forEach((service, index) => {
    statements.push(
      context.env.DB.prepare(
        `INSERT INTO business_services
           (id, business_id, name, price, note, sort_order, is_active)
         VALUES (?, ?, ?, ?, ?, ?, 1)`,
      ).bind(
        crypto.randomUUID(),
        business.id,
        service.name,
        service.price,
        service.note,
        (index + 1) * 10,
      ),
    );
  });

  for (const entry of hoursInput) {
    statements.push(
      context.env.DB.prepare(
        `INSERT INTO business_hours (business_id, day_of_week, is_closed, opens_at, closes_at)
         VALUES (?, ?, ?, ?, ?)`,
      ).bind(
        business.id,
        entry.dayOfWeek,
        entry.isClosed ? 1 : 0,
        entry.isClosed ? "00:00" : entry.opensAt,
        entry.isClosed ? "00:00" : entry.closesAt,
      ),
    );
  }

  await context.env.DB.batch(statements);
  await audit(context, auth.user.id, "business.updated", "business", business.id, {
    services: servicesInput.length,
    hours: hoursInput.length,
  });
  void businessNotificationsEnabled();

  return success({ id: business.id, updatedAt: now }, context.requestId);
}

async function listMyRooms(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  const [owned, queue, memberships] = await Promise.all([
    context.env.DB.prepare(
      `SELECT r.id, r.name, r.purpose, r.state, r.status, r.slot_limit,
              COUNT(CASE WHEN a.status = 'approved' THEN 1 END) AS member_count,
              COUNT(CASE WHEN a.status = 'queued' THEN 1 END) AS queued_count
         FROM contact_rooms r
         LEFT JOIN room_applications a ON a.room_id = r.id
        WHERE r.owner_user_id = ?
        GROUP BY r.id ORDER BY r.created_at DESC`,
    )
      .bind(auth.user.id)
      .all<{
        id: string;
        name: string;
        purpose: string;
        state: string;
        status: string;
        slot_limit: number;
        member_count: number;
        queued_count: number;
      }>(),
    /*
     * The join requests waiting on this user as an owner. Without this the
     * "circles I run" view can only report that people are waiting, never who,
     * which forces every admission through a platform admin.
     */
    context.env.DB.prepare(
      `SELECT a.id, a.room_id, a.created_at,
              r.name AS room_name, r.status AS room_status,
              b.id AS business_id, b.name AS business_name, b.slug AS business_slug,
              u.full_name AS applicant_name
         FROM room_applications a
         JOIN contact_rooms r ON r.id = a.room_id
         JOIN businesses b ON b.id = a.business_id
         JOIN users u ON u.id = a.user_id
        WHERE r.owner_user_id = ? AND a.status = 'queued'
        ORDER BY a.created_at ASC`,
    )
      .bind(auth.user.id)
      .all<{
        id: string;
        room_id: string;
        created_at: string;
        room_name: string;
        room_status: string;
        business_id: string;
        business_name: string;
        business_slug: string;
        applicant_name: string;
      }>(),
    context.env.DB.prepare(
      `SELECT a.id, a.room_id, a.status, r.name AS room_name, r.status AS room_status,
              b.id AS business_id, b.name AS business_name, b.slug AS business_slug, a.created_at
         FROM room_applications a
         JOIN contact_rooms r ON r.id = a.room_id
         JOIN businesses b ON b.id = a.business_id
         JOIN business_members bm ON bm.business_id = a.business_id
        WHERE bm.user_id = ?
        ORDER BY a.created_at DESC`,
    )
      .bind(auth.user.id)
      .all<{
        id: string;
        room_id: string;
        status: string;
        room_name: string;
        room_status: string;
        business_id: string;
        business_name: string;
        business_slug: string;
        created_at: string;
      }>(),
  ]);
  return success(
    {
      owned: owned.results.map((row) => ({
        id: row.id,
        name: row.name,
        purpose: row.purpose,
        state: row.state,
        status: row.status,
        memberCount: row.member_count,
        queuedCount: row.queued_count,
        slotLimit: row.slot_limit,
      })),
      queue: queue.results.map((row) => ({
        id: row.id,
        roomId: row.room_id,
        roomName: row.room_name,
        businessId: row.business_id,
        businessName: row.business_name,
        businessSlug: row.business_slug,
        applicantName: row.applicant_name,
        createdAt: row.created_at,
      })),
      applications: memberships.results.map((row) => ({
        id: row.id,
        roomId: row.room_id,
        status: row.status,
        roomName: row.room_name,
        roomStatus: row.room_status,
        businessId: row.business_id,
        businessName: row.business_name,
        businessSlug: row.business_slug,
        createdAt: row.created_at,
      })),
    },
    context.requestId,
  );
}

/* -------------------------------------------------------------------------- */
/* Account management                                                          */
/* -------------------------------------------------------------------------- */

const RESET_TOKEN_MINUTES = 60;

function maskIdentity(value: string | null): string {
  if (!value) return "";
  if (value.includes("@")) {
    const [local = "", domain = ""] = value.split("@");
    return `${local.slice(0, 2)}***@${domain}`;
  }
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

async function queueOutbox(
  context: AppContext,
  toAddress: string,
  subject: string,
  body: string,
  kind: string,
): Promise<void> {
  await context.env.DB.prepare(
    `INSERT INTO outbox_messages (id, to_address, subject, body, kind, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(crypto.randomUUID(), toAddress, subject, body, kind, new Date().toISOString())
    .run();
}

async function forgotPassword(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "auth-forgot", 5, 900);
  const input = await parseJson(context.request, forgotPasswordSchema);
  const identity = input.identity.trim();
  const maybeEmail = identity.includes("@") ? normalizeEmail(identity) : null;
  let maybePhone: string | null = null;
  if (!maybeEmail) {
    try {
      maybePhone = normalizePhone(identity);
    } catch {
      maybePhone = null;
    }
  }

  const user = await context.env.DB.prepare(
    `SELECT id, email, phone FROM users
      WHERE status = 'active' AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))
      LIMIT 1`,
  )
    .bind(maybeEmail, maybeEmail, maybePhone, maybePhone)
    .first<{ id: string; email: string | null; phone: string | null }>();

  // Always answer identically. Revealing whether an account exists turns this
  // endpoint into an account-enumeration oracle.
  const neutral = {
    accepted: true,
    message:
      "If an active account matches those details, a reset link is on its way. It expires in 60 minutes.",
  };

  if (!user) {
    await audit(context, null, "auth.password_reset_unmatched", "user", "unknown");
    return success(neutral, context.requestId);
  }

  const token = bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_MINUTES * 60_000).toISOString();

  await context.env.DB.batch([
    // Revoke any outstanding token so only the newest link works.
    context.env.DB.prepare(
      "DELETE FROM password_resets WHERE user_id = ? AND consumed_at IS NULL",
    ).bind(user.id),
    context.env.DB.prepare(
      `INSERT INTO password_resets (token_hash, user_id, expires_at, created_at, request_id)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(await sha256(token), user.id, expiresAt, now, context.requestId),
  ]);

  const destination = user.email ?? user.phone ?? "";
  const link = `/auth?reset=${token}`;
  await queueOutbox(
    context,
    destination,
    "Reset your GainHub password",
    `Use this link within ${RESET_TOKEN_MINUTES} minutes to choose a new password:\n${link}\n\n` +
      "If you did not request this, no action is needed — the link expires on its own.",
    "password_reset",
  );
  await audit(context, user.id, "auth.password_reset_requested", "user", user.id);

  return success(
    {
      ...neutral,
      // Never in production: without a transactional mail provider configured the
      // link cannot leave the server, so the honest thing is to hand it back to the
      // caller and say so, rather than claim an email was delivered.
      ...(context.env.APP_ENV === "production"
        ? {}
        : { devResetLink: link, devNote: "No mail provider configured; link not emailed." }),
    },
    context.requestId,
  );
}

async function validateResetToken(context: AppContext, token: string): Promise<Response> {
  const parsed = z.string().trim().min(20).max(200).safeParse(token);
  if (!parsed.success) return success({ valid: false }, context.requestId);
  const row = await context.env.DB.prepare(
    `SELECT pr.user_id, u.email, u.phone
       FROM password_resets pr JOIN users u ON u.id = pr.user_id
      WHERE pr.token_hash = ? AND pr.consumed_at IS NULL AND pr.expires_at > ? AND u.status = 'active'`,
  )
    .bind(await sha256(parsed.data), new Date().toISOString())
    .first<{ user_id: string; email: string | null; phone: string | null }>();
  return success(
    row
      ? { valid: true, identity: maskIdentity(row.email ?? row.phone) }
      : { valid: false, identity: "" },
    context.requestId,
  );
}

async function resetPassword(context: AppContext): Promise<Response> {
  await enforceRateLimit(context, "auth-reset", 10, 900);
  const input = await parseJson(context.request, resetPasswordSchema);
  const now = new Date().toISOString();
  const row = await context.env.DB.prepare(
    `SELECT pr.user_id FROM password_resets pr JOIN users u ON u.id = pr.user_id
      WHERE pr.token_hash = ? AND pr.consumed_at IS NULL AND pr.expires_at > ? AND u.status = 'active'`,
  )
    .bind(await sha256(input.token), now)
    .first<{ user_id: string }>();
  // Identical response whether the token is unknown, expired or consumed, so the
  // endpoint cannot be used to probe which tokens were ever issued.
  if (!row) {
    throw new HttpError(
      400,
      "INVALID_RESET_TOKEN",
      "This reset link is no longer valid. Request a new one.",
    );
  }

  const password = await hashPassword(input.password);
  await context.env.DB.batch([
    context.env.DB.prepare(
      "UPDATE password_resets SET consumed_at = ? WHERE token_hash = ? AND consumed_at IS NULL",
    ).bind(now, await sha256(input.token)),
    context.env.DB.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
    ).bind(password.hash, password.salt, now, row.user_id),
    // A password reset must end every existing session, including the attacker's.
    context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ?").bind(row.user_id),
  ]);
  await audit(context, row.user_id, "auth.password_reset_completed", "user", row.user_id);
  await notify(
    context,
    row.user_id,
    "security.password_reset",
    "Your password was reset",
    "Your GainHub password was changed and every signed-in device was signed out. If this was not you, contact support immediately.",
    "/account",
  );

  return success({ reset: true }, context.requestId);
}

async function changePassword(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  await enforceRateLimit(context, "auth-change-password", 10, 900);
  const input = await parseJson(context.request, changePasswordSchema);
  const user = await context.env.DB.prepare(
    "SELECT id, password_hash, password_salt FROM users WHERE id = ? AND status = 'active'",
  )
    .bind(auth.user.id)
    .first<{ id: string; password_hash: string; password_salt: string }>();
  if (!user) throw new HttpError(401, "AUTH_REQUIRED", "Sign in to continue.");

  const derived = await hashPassword(input.currentPassword, base64ToBytes(user.password_salt));
  if (!constantTimeEqual(derived.hash, user.password_hash)) {
    throw new HttpError(400, "INVALID_CREDENTIALS", "Your current password is incorrect.");
  }

  const next = await hashPassword(input.newPassword);
  const now = new Date().toISOString();
  const currentToken = cookieValue(context.request, "__Host-gh_session");
  await context.env.DB.batch([
    context.env.DB.prepare(
      "UPDATE users SET password_hash = ?, password_salt = ?, updated_at = ? WHERE id = ?",
    ).bind(next.hash, next.salt, now, user.id),
    // Keep this device signed in; end every other session.
    context.env.DB.prepare("DELETE FROM sessions WHERE user_id = ? AND token_hash != ?").bind(
      user.id,
      currentToken ? await sha256(currentToken) : "__none__",
    ),
  ]);
  await audit(context, user.id, "auth.password_changed", "user", user.id);
  await notify(
    context,
    user.id,
    "security.password_changed",
    "Your password was changed",
    "Your GainHub password was updated. Other signed-in devices were signed out.",
    "/account",
  );
  return success({ changed: true }, context.requestId);
}

async function updateProfile(context: AppContext): Promise<Response> {
  const auth = await requireUser(context);
  const input = await parseJson(context.request, updateProfileSchema);
  const email = normalizeEmail(input.email);
  const phone = normalizePhone(input.phone);
  if (!email && !phone) {
    throw new HttpError(422, "VALIDATION_ERROR", "Check the highlighted fields.", {
      email: "Keep at least an email address or phone number",
    });
  }
  const clash = await context.env.DB.prepare(
    `SELECT id FROM users
      WHERE id != ? AND ((? IS NOT NULL AND email = ?) OR (? IS NOT NULL AND phone = ?))
      LIMIT 1`,
  )
    .bind(auth.user.id, email, email, phone, phone)
    .first<{ id: string }>();
  if (clash) {
    throw new HttpError(409, "ACCOUNT_EXISTS", "Those contact details belong to another account.");
  }
  const now = new Date().toISOString();
  await context.env.DB.prepare(
    "UPDATE users SET full_name = ?, email = ?, phone = ?, updated_at = ? WHERE id = ?",
  )
    .bind(input.fullName, email, phone, now, auth.user.id)
    .run();
  await audit(context, auth.user.id, "user.profile_updated", "user", auth.user.id);
  return success(
    {
      user: {
        id: auth.user.id,
        fullName: input.fullName,
        email,
        phone,
        role: auth.user.role,
      },
    },
    context.requestId,
  );
}

async function route(context: AppContext): Promise<Response> {
  const { request, url } = context;
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "GET" && path === "/health") {
    const row = await context.env.DB.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return success(
      {
        status: row?.ok === 1 ? "ok" : "degraded",
        environment: context.env.APP_ENV,
        timestamp: new Date().toISOString(),
      },
      context.requestId,
      { headers: { "cache-control": "no-store" } },
    );
  }
  if (request.method === "GET" && path === "/v1/categories") return listCategories(context);
  if (request.method === "GET" && path === "/v1/locations") return listLocations(context);
  if (request.method === "GET" && path === "/v1/sitemap") return sitemapEntries(context);
  if (request.method === "GET" && path === "/v1/rooms") return listRooms(context);
  if (request.method === "GET" && path.startsWith("/v1/rooms/")) {
    return getRoom(context, decodeURIComponent(path.slice("/v1/rooms/".length)));
  }
  if (request.method === "GET" && path === "/v1/businesses") return listBusinesses(context);
  if (request.method === "GET" && path === "/v1/suggest") return searchSuggestions(context);
  const reviewsMatch = path.match(/^\/v1\/businesses\/([^/]+)\/reviews$/);
  if (request.method === "GET" && reviewsMatch?.[1]) {
    return listBusinessReviews(context, decodeURIComponent(reviewsMatch[1]));
  }
  const relatedMatch = path.match(/^\/v1\/businesses\/([^/]+)\/related$/);
  if (request.method === "GET" && relatedMatch?.[1]) {
    return relatedBusinesses(context, decodeURIComponent(relatedMatch[1]));
  }
  if (request.method === "GET" && path.startsWith("/v1/businesses/")) {
    return getBusiness(context, decodeURIComponent(path.slice("/v1/businesses/".length)));
  }

  if (request.method === "POST" && path === "/v1/auth/register") return register(context);
  if (request.method === "POST" && path === "/v1/auth/login") return login(context);
  if (request.method === "POST" && path === "/v1/auth/logout") return logout(context);
  if (request.method === "GET" && path === "/v1/auth/session") return currentSession(context);
  if (request.method === "POST" && path === "/v1/auth/forgot-password")
    return forgotPassword(context);
  const resetTokenMatch = path.match(/^\/v1\/auth\/reset-password\/([^/]+)$/);
  if (request.method === "GET" && resetTokenMatch?.[1]) {
    return validateResetToken(context, decodeURIComponent(resetTokenMatch[1]));
  }
  if (request.method === "POST" && path === "/v1/auth/reset-password")
    return resetPassword(context);
  if (request.method === "POST" && path === "/v1/auth/change-password")
    return changePassword(context);
  if (request.method === "PATCH" && path === "/v1/me") return updateProfile(context);

  if (request.method === "POST" && path === "/v1/listing-applications")
    return submitListing(context);
  if (request.method === "POST" && path === "/v1/enquiries") return submitEnquiry(context);
  if (request.method === "POST" && path === "/v1/reviews") return submitReview(context);
  {
    const match = path.match(/^\/v1\/reviews\/([^/]+)$/);
    if (request.method === "PATCH" && match?.[1]) {
      return updateReview(context, decodeURIComponent(match[1]));
    }
  }
  if (request.method === "POST" && path === "/v1/suggestions") return submitSuggestion(context);
  if (request.method === "POST" && path === "/v1/reports") return submitReport(context);
  if (request.method === "POST" && path === "/v1/claims") return submitClaim(context);
  if (request.method === "POST" && path === "/v1/rooms") return proposeRoom(context);
  {
    const match = path.match(/^\/v1\/rooms\/([^/]+)\/leave$/);
    if (request.method === "POST" && match?.[1]) {
      return leaveRoom(context, decodeURIComponent(match[1]));
    }
  }
  if (request.method === "POST" && path === "/v1/room-applications") return applyToRoom(context);
  if (request.method === "POST" && path === "/v1/data-requests") return createDataRequest(context);
  if (request.method === "GET" && path === "/v1/me/saved-businesses")
    return listSavedBusinesses(context);
  if (request.method === "PUT" && path === "/v1/me/saved-businesses") return saveBusiness(context);
  if (request.method === "POST" && path === "/v1/events/contact") return recordContact(context);
  if (request.method === "GET" && path === "/v1/workspace/summary")
    return workspaceSummary(context);
  if (request.method === "GET" && path === "/v1/workspace/insights")
    return workspaceInsights(context);
  if (request.method === "GET" && path === "/v1/workspace/rooms") return listMyRooms(context);
  {
    const match = path.match(/^\/v1\/workspace\/rooms\/([^/]+)\/applications\/([^/]+)$/);
    if (request.method === "POST" && match?.[1] && match[2]) {
      return decideRoomApplication(
        context,
        decodeURIComponent(match[1]),
        decodeURIComponent(match[2]),
      );
    }
  }
  const managedMatch = path.match(/^\/v1\/workspace\/businesses\/([^/]+)$/);
  if (managedMatch?.[1]) {
    const id = decodeURIComponent(managedMatch[1]);
    if (request.method === "GET") return getManagedBusiness(context, id);
    if (request.method === "PATCH") return updateManagedBusiness(context);
  }
  if (request.method === "GET" && path === "/v1/notifications") return listNotifications(context);
  if (request.method === "POST" && path === "/v1/notifications/read")
    return markNotificationsRead(context);
  const enquiryMatch = path.match(/^\/v1\/workspace\/enquiries\/([^/]+)$/);
  if (request.method === "PATCH" && enquiryMatch?.[1]) {
    return updateEnquiryStatus(context, decodeURIComponent(enquiryMatch[1]));
  }
  if (request.method === "GET" && path === "/v1/admin/queue") return adminQueue(context);
  const evidenceMatch = path.match(/^\/v1\/admin\/claims\/([^/]+)\/evidence$/);
  if (request.method === "GET" && evidenceMatch?.[1]) {
    return claimEvidence(context, decodeURIComponent(evidenceMatch[1]));
  }
  const moderationMatch = path.match(/^\/v1\/admin\/moderation\/([^/]+)\/([^/]+)$/);
  if (request.method === "PATCH" && moderationMatch?.[1] && moderationMatch[2]) {
    return moderate(
      context,
      decodeURIComponent(moderationMatch[1]),
      decodeURIComponent(moderationMatch[2]),
    );
  }

  throw new HttpError(404, "NOT_FOUND", "Endpoint not found.");
}

async function fetchHandler(request: Request, env: Env): Promise<Response> {
  const requestId = request.headers.get("x-request-id")?.slice(0, 100) || crypto.randomUUID();
  const suppliedProxySecret = request.headers.get("x-gainhub-proxy-secret");
  if (suppliedProxySecret && !env.PROXY_SHARED_SECRET) {
    return withCors(
      failure(
        new HttpError(
          503,
          "CONFIGURATION_ERROR",
          "The secure application proxy is not configured.",
        ),
        requestId,
      ),
      request,
      env,
    );
  }
  if (suppliedProxySecret && !validProxySecret(request, env)) {
    return withCors(
      failure(new HttpError(403, "INVALID_PROXY_AUTH", "Proxy authentication failed."), requestId),
      request,
      env,
    );
  }
  const context: AppContext = {
    env,
    request,
    url: new URL(request.url),
    requestId,
    ip: clientIp(request, env),
  };

  if (request.method === "OPTIONS") {
    const origin = request.headers.get("origin");
    if (!origin || !isAllowedOrigin(origin, env)) {
      return withCors(
        failure(new HttpError(403, "ORIGIN_NOT_ALLOWED", "Origin not allowed."), requestId),
        request,
        env,
      );
    }
    return withCors(
      new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
          "access-control-allow-headers":
            "content-type, idempotency-key, x-request-id, x-gainhub-intent",
          "access-control-max-age": "86400",
          "x-request-id": requestId,
        },
      }),
      request,
      env,
    );
  }

  if (MUTATING_METHODS.has(request.method)) {
    const origin = request.headers.get("origin");
    if (origin && !isAllowedOrigin(origin, env)) {
      return withCors(
        failure(new HttpError(403, "ORIGIN_NOT_ALLOWED", "Origin not allowed."), requestId),
        request,
        env,
      );
    }
    if (request.headers.get("x-gainhub-intent") !== "web") {
      return withCors(
        failure(
          new HttpError(403, "REQUEST_INTENT_REQUIRED", "Request intent header is missing."),
          requestId,
        ),
        request,
        env,
      );
    }
  }

  try {
    return withCors(await route(context), request, env);
  } catch (error) {
    return withCors(failure(error, requestId), request, env);
  }
}

async function scheduledHandler(_controller: ScheduledController, env: Env): Promise<void> {
  const now = new Date();
  const nowIso = now.toISOString();
  const nowEpochSeconds = Math.floor(now.getTime() / 1_000);
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const shortLivedCutoff = daysAgo(180);
  const accountabilityCutoff = daysAgo(400);

  const expiredEvidence = await env.DB.prepare(
    `SELECT id, evidence_key FROM claims
      WHERE status IN ('approved', 'rejected') AND evidence_deleted_at IS NULL AND updated_at <= ?
      ORDER BY updated_at ASC LIMIT 1000`,
  )
    .bind(shortLivedCutoff)
    .all<{ id: string; evidence_key: string }>();
  if (expiredEvidence.results.length) {
    await env.EVIDENCE.delete(expiredEvidence.results.map((claim) => claim.evidence_key));
  }

  const cleanup = [
    env.DB.prepare("DELETE FROM sessions WHERE expires_at <= ?").bind(nowIso),
    env.DB.prepare("DELETE FROM rate_limits WHERE expires_at <= ?").bind(nowEpochSeconds),
    env.DB.prepare("DELETE FROM contact_events WHERE created_at <= ?").bind(shortLivedCutoff),
    env.DB.prepare("DELETE FROM audit_events WHERE created_at <= ?").bind(accountabilityCutoff),
    env.DB.prepare("DELETE FROM password_resets WHERE expires_at <= ?").bind(nowIso),
    env.DB.prepare("DELETE FROM notifications WHERE read_at IS NOT NULL AND read_at <= ?").bind(
      shortLivedCutoff,
    ),
    env.DB.prepare("DELETE FROM notifications WHERE created_at <= ?").bind(shortLivedCutoff),
    env.DB.prepare("DELETE FROM outbox_messages WHERE status = 'sent' AND created_at <= ?").bind(
      shortLivedCutoff,
    ),
    env.DB.prepare(
      "DELETE FROM listing_applications WHERE status IN ('approved', 'rejected', 'withdrawn') AND updated_at <= ?",
    ).bind(accountabilityCutoff),
    env.DB.prepare(
      "DELETE FROM suggestions WHERE status IN ('accepted', 'rejected') AND updated_at <= ?",
    ).bind(accountabilityCutoff),
    env.DB.prepare(
      "DELETE FROM reports WHERE status IN ('resolved', 'dismissed') AND updated_at <= ?",
    ).bind(accountabilityCutoff),
    env.DB.prepare("DELETE FROM reviews WHERE status = 'rejected' AND updated_at <= ?").bind(
      accountabilityCutoff,
    ),
    env.DB.prepare(
      "DELETE FROM data_requests WHERE status IN ('completed', 'rejected') AND updated_at <= ?",
    ).bind(accountabilityCutoff),
  ];
  if (expiredEvidence.results.length) {
    for (let index = 0; index < expiredEvidence.results.length; index += 50) {
      const claimIds = expiredEvidence.results.slice(index, index + 50).map((claim) => claim.id);
      const placeholders = claimIds.map(() => "?").join(", ");
      cleanup.push(
        env.DB.prepare(
          `UPDATE claims SET evidence_deleted_at = ? WHERE id IN (${placeholders})`,
        ).bind(nowIso, ...claimIds),
      );
    }
  }
  await env.DB.batch(cleanup);

  // Keep the denormalised is_open_now column honest for businesses that publish
  // opening hours. Public reads derive this at query time, but the stored value is
  // still used as the fallback for businesses with no hours and by ad-hoc queries.
  const current = lagosNow(now);
  const nowMinutes = String(current.minutes).padStart(4, "0");
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE businesses SET is_open_now = 1, updated_at = updated_at
        WHERE EXISTS (
          SELECT 1 FROM business_hours h
           WHERE h.business_id = businesses.id AND h.day_of_week = ? AND h.is_closed = 0
             AND ((h.opens_at <= ? AND h.closes_at > ?)
               OR (h.closes_at <= h.opens_at AND (h.opens_at <= ? OR h.closes_at > ?)))
        ) AND is_open_now = 0`,
    ).bind(current.dayOfWeek, nowMinutes, nowMinutes, nowMinutes, nowMinutes),
    env.DB.prepare(
      `UPDATE businesses SET is_open_now = 0, updated_at = updated_at
        WHERE EXISTS (SELECT 1 FROM business_hours h WHERE h.business_id = businesses.id)
          AND NOT EXISTS (
            SELECT 1 FROM business_hours h
             WHERE h.business_id = businesses.id AND h.day_of_week = ? AND h.is_closed = 0
               AND ((h.opens_at <= ? AND h.closes_at > ?)
                 OR (h.closes_at <= h.opens_at AND (h.opens_at <= ? OR h.closes_at > ?)))
          ) AND is_open_now = 1`,
    ).bind(current.dayOfWeek, nowMinutes, nowMinutes, nowMinutes, nowMinutes),
  ]);
}

export default {
  fetch: fetchHandler,
  scheduled: scheduledHandler,
} satisfies ExportedHandler<Env>;

export { constantTimeEqual, escapeLike, normalizeEmail, normalizePhone };
