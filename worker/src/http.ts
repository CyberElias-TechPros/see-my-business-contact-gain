import type { z } from "zod";

import { type ApiError as ApiErrorBody } from "../../shared/api.ts";
import { ApiError } from "./errors.ts";
import type { AppContext, Env } from "./types.ts";

export const MAX_BODY_BYTES = 512 * 1024;

export function json(data: unknown, init: ResponseInit = {}): Response {
  // `init.headers` may be a Headers instance or a plain record (error paths build
  // literal objects), so normalise before reading anything back out of it.
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  // Handlers set `public, max-age=…, stale-while-revalidate=…` on cold read paths;
  // only default to no-store when the caller did not choose a policy.
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  return new Response(JSON.stringify(data), { ...init, headers: stripEmpty(headers) });
}

function stripEmpty(headers: Headers): Headers {
  if (!headers.get("x-request-id")) headers.delete("x-request-id");
  return headers;
}

export function errorBody(
  code: ApiErrorBody["error"]["code"],
  message: string,
  extra?: Partial<ApiErrorBody["error"]>,
): ApiErrorBody {
  return { error: { code, message, ...extra } };
}

export async function readJson(request: Request): Promise<unknown> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_BODY_BYTES) {
    throw new ApiError("payload_too_large", 413, "That submission is too large.");
  }
  const text = await request.text();
  if (!text) return {};
  if (text.length > MAX_BODY_BYTES)
    throw new ApiError("payload_too_large", 413, "That submission is too large.");
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw ApiError.validation({ "": "Request body must be valid JSON." });
  }
}

export async function parseBody<S extends z.ZodTypeAny>(
  schema: S,
  request: Request,
): Promise<z.infer<S>> {
  const raw = await readJson(request);
  const result = schema.safeParse(raw);
  if (!result.success) throw zodToApiError(result.error);
  return result.data as z.infer<S>;
}

export function parseQuery<S extends z.ZodTypeAny>(schema: S, url: URL): z.infer<S> {
  const source: Record<string, string> = {};
  for (const [key, value] of url.searchParams) source[key] = value;
  const result = schema.safeParse(source);
  if (!result.success) throw zodToApiError(result.error);
  return result.data as z.infer<S>;
}

export function zodToApiError(error: z.ZodError): ApiError {
  const fields: Record<string, string> = {};
  let firstMessage = "Please check your input.";
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form";
    const message = issue.code === "custom" ? issue.message : humaniseIssue(issue);
    if (!fields[path]) fields[path] = message;
    if (firstMessage.startsWith("Please check")) firstMessage = message;
  }
  return ApiError.validation(fields, firstMessage);
}

/** Turns zod issues into copy a person can act on, never into stack-trace prose. */
function humaniseIssue(issue: z.ZodIssue): string {
  switch (issue.code) {
    case "too_small": {
      const minimum = (issue as { minimum?: number }).minimum;
      if (issue.type === "string") {
        return minimum === 1
          ? "This field is required."
          : `Please write at least ${minimum} characters.`;
      }
      if (typeof minimum === "number") return `Must be ${minimum} or more.`;
      return issue.message;
    }
    case "too_big": {
      const maximum = (issue as { maximum?: number }).maximum;
      if (issue.type === "string" && typeof maximum === "number")
        return `Please keep this under ${maximum} characters.`;
      if (typeof maximum === "number") return `Must be ${maximum} or less.`;
      return issue.message;
    }
    case "invalid_type":
      return "This field is missing or the wrong type.";
    case "invalid_string":
      return issue.validation === "regex" ? "That format does not look right." : issue.message;
    case "invalid_enum_value":
      return `Choose one of: ${(issue.options ?? []).join(", ")}`;
    case "unrecognized_keys":
      return "Unexpected field.";
    default:
      return issue.message;
  }
}

// --------------------------------------------------------------- cookies ----

export function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const index = part.indexOf("=");
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export type CookieOptions = {
  maxAge?: number;
  httpOnly?: boolean;
  path?: string;
  sameSite?: "Lax" | "None" | "Strict";
};

/**
 * Session cookies are `HttpOnly`, `Secure` and `SameSite=Lax` because the frontend proxies
 * `/api/v1/*` to this Worker on the same site; set COOKIE_SAMESITE_NONE=true only when the
 * API is called cross-site from a dev preview, where `None` is required for the cookie to be
 * sent at all.
 *
 * `COOKIE_DOMAIN` exists for one reason: when a session set through `www.gainhub.ng` should
 * also be sent to `gainhub.ng`. Outside development it is applied verbatim; in development it
 * is ignored, because a `Domain=gainhub.ng` cookie cannot be stored by `localhost` at all and
 * every login would appear to succeed and then evaporate — the single most confusing way to
 * break a local checkout.
 */
export function buildCookie(
  env: Env,
  name: string,
  value: string,
  opts: CookieOptions = {},
): string {
  const development = env.APP_ENV === "development";
  const sameSite = opts.sameSite ?? (env.COOKIE_SAMESITE_NONE === "true" ? "None" : "Lax");
  const parts = [
    `${name}=${value}`,
    `Path=${opts.path ?? "/"}`,
    `Max-Age=${opts.maxAge ?? 0}`,
    `SameSite=${sameSite}`,
    // `Secure` is required by SameSite=None, so it is only ever dropped for plain
    // development previews; staging and production always have it.
    ...(sameSite === "None" || !development ? ["Secure"] : []),
  ];
  if (!development && env.COOKIE_DOMAIN) parts.push(`Domain=${env.COOKIE_DOMAIN}`);
  if (opts.httpOnly !== false) parts.push("HttpOnly");
  return parts.join("; ");
}

export function deleteCookie(env: Env, name: string): string {
  return buildCookie(env, name, "", { maxAge: 0 });
}

export function setCookies(response: Response, cookies: (string | undefined)[]): Response {
  const headers = new Headers(response.headers);
  for (const cookie of cookies) if (cookie) headers.append("set-cookie", cookie);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ------------------------------------------------------------------ cors ----

export function allowedOrigin(env: Env, request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const list = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (env.APP_ENV === "development") return origin;
  return list.includes(origin) ? origin : null;
}

export function withCors(
  env: Env,
  request: Request,
  response: Response,
  allowMethods = "GET,POST,PATCH,PUT,DELETE,OPTIONS",
): Response {
  const origin = allowedOrigin(env, request);
  if (!origin) return response;
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin);
  headers.set("vary", "Origin");
  headers.set("access-control-allow-credentials", "true");
  headers.set("access-control-allow-headers", "content-type,x-csrf-token,x-idempotency-key");
  headers.set("access-control-allow-methods", allowMethods);
  headers.set("access-control-max-age", "600");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// -------------------------------------------------------------- security ----

export const SECURITY_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "geolocation=(), microphone=(), camera=()",
};

export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/** Trusted client IP for rate limiting: only CF's own header, never a client-supplied X-Forwarded-For. */
/**
 * Buckets abuse limits by client. On Cloudflare `request.cf.clientIp` is authoritative;
 * see the body for when a forwarded header may be consulted instead.
 */
export function clientIpHash(request: Request, fallbackHeader = false): string | null {
  const cf = (request as Request & { cf?: { clientIp?: string } }).cf;
  const fromCf = cf?.clientIp ?? null;
  // `fallbackHeader` is true only for APP_ENV "development"/"test", where local workerd
  // gives every request the same (or no) client IP — without it all of localhost shares
  // one bucket, which makes the abuse limits impossible to exercise or re-run. A real
  // deployment never sets those APP_ENV values (the deploy config check enforces it), so
  // in production the authoritative `cf.clientIp` is the only thing consulted and the
  // client cannot influence the bucket.
  const ip = fallbackHeader ? (forwardedFor(request) ?? fromCf) : fromCf;
  if (!ip) return null;
  // Cheap, stable, non-reversible enough for bucketing; no salt is stored.
  let hash = 2166136261;
  for (let i = 0; i < ip.length; i++) {
    hash ^= ip.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `ip_${(hash >>> 0).toString(36)}`;
}

/** First hop of X-Forwarded-For, then CF-Connecting-IP. Development/test only. */
function forwardedFor(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  const candidate =
    (forwarded ? forwarded.split(",")[0]?.trim() : null) ??
    request.headers.get("cf-connecting-ip")?.trim() ??
    null;
  return candidate && candidate.length <= 64 && candidate !== "127.0.0.1" ? candidate : null;
}

export function contextHelpers(c: AppContext) {
  return {
    userId: c.session?.user.id ?? null,
    query<S extends z.ZodTypeAny>(schema: S) {
      return parseQuery(schema, c.url);
    },
    body<S extends z.ZodTypeAny>(schema: S) {
      return parseBody(schema, c.request);
    },
  };
}
