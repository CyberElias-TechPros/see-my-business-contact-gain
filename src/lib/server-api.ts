/**
 * Server-side data access for TanStack Start loaders.
 *
 * Why this exists instead of `fetch("/api/v1/…")` inside a loader: a loader runs on the server
 * during SSR, where a *relative* URL has no origin to resolve against, and where the visitor's
 * session cookie must be forwarded explicitly — otherwise every logged-in page renders as
 * logged-out on first paint and then swaps. `createServerFn` gives us both: the browser calls it
 * as an RPC, the handler runs on the server with the incoming request available.
 *
 * `API_INTERNAL_URL` (falling back to `API_URL`) is the origin the *server* uses, so a deployment
 * can point it at a private/reachable hostname while browsers keep using the public proxy.
 *
 * The `path` argument is validated against an allow-list of this API's own route shapes. A server
 * function is callable by anyone with the URL, so "it only comes from our code" is not a control:
 * without this check the handler would be a generic authenticated proxy onto whatever host and
 * path a client chose.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders, setResponseStatus } from "@tanstack/react-start/server";
import type { ApiError } from "../../shared/api.ts";

/** Every read path the frontend may ask for, as a matcher + a human name for error messages. */
const ALLOWED_PATHS: { name: string; match: RegExp }[] = [
  { name: "health", match: /^\/api\/v1\/health$/ },
  { name: "taxonomy", match: /^\/api\/v1\/(categories|locations)$/ },
  { name: "search", match: /^\/api\/v1\/search$/ },
  { name: "sitemap", match: /^\/api\/v1\/sitemap$/ },
  { name: "suggestions", match: /^\/api\/v1\/suggestions$/ },
  { name: "listing", match: /^\/api\/v1\/businesses\/[A-Za-z0-9_-]{1,64}$/ },
  { name: "listing-reviews", match: /^\/api\/v1\/businesses\/[A-Za-z0-9_-]{1,64}\/reviews$/ },
  { name: "listing-similar", match: /^\/api\/v1\/businesses\/[A-Za-z0-9_-]{1,64}\/similar$/ },
  { name: "listing-activity", match: /^\/api\/v1\/businesses\/[A-Za-z0-9_-]{1,64}\/activity$/ },
  { name: "rooms", match: /^\/api\/v1\/rooms$/ },
  { name: "room", match: /^\/api\/v1\/rooms\/[a-z0-9-]{2,80}$/ },
  { name: "session", match: /^\/api\/v1\/auth\/session$/ },
  { name: "workspace-summary", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/summary$/ },
  { name: "workspace-profile", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/profile$/ },
  { name: "workspace-leads", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/leads$/ },
  // Read-only counts per stage; the `?slug` write paths (stage, assign) are deliberately absent —
  // a loader that can *mutate* is the hole this list exists to prevent.
  {
    name: "workspace-lead-stats",
    match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/leads\/stats$/,
  },
  { name: "workspace-enquiries", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/enquiries$/ },
  { name: "workspace-analytics", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/analytics$/ },
  { name: "workspace-media", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/media$/ },
  { name: "workspace-services", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/services$/ },
  { name: "workspace-products", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/products$/ },
  { name: "workspace-settings", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/settings$/ },
  { name: "workspace-links", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/links$/ },
  { name: "workspace-tasks", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/tasks$/ },
  { name: "workspace-contacts", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/contacts$/ },
  { name: "workspace-team", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/team$/ },
  { name: "workspace-audit", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/audit$/ },
  { name: "workspace-billing", match: /^\/api\/v1\/workspaces\/[A-Za-z0-9_-]{1,64}\/billing$/ },
  { name: "my-saves", match: /^\/api\/v1\/me\/saves$/ },
  { name: "my-enquiries", match: /^\/api\/v1\/me\/enquiries$/ },
  { name: "my-notifications", match: /^\/api\/v1\/me\/notifications$/ },
];

export function assertAllowedPath(path: string): string {
  const url = new URL(path, "http://internal.invalid");
  if (url.origin !== "http://internal.invalid") {
    throw new Error(`Refusing to fetch a cross-origin path from the server: ${path.slice(0, 120)}`);
  }
  const clean = `${url.pathname}${url.search}`;
  if (!ALLOWED_PATHS.some((entry) => entry.match.test(url.pathname))) {
    throw new Error(
      `"${url.pathname}" is not a path the frontend is allowed to read through the server.`,
    );
  }
  return clean;
}

class ServerApiFailure extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
  ) {
    super(message);
    this.name = "ServerApiFailure";
  }
}

/**
 * Thrown by a loader when the API said "this page does not exist". TanStack turns a thrown
 * error into the route's error component; `status` is what lets the shell keep the real HTTP
 * status instead of a soft 200 — the single most important SEO fix for a directory whose
 * listings get unpublished every day.
 */
export class NotFoundError extends Error {
  readonly notFound = true;
  constructor(message = "This page could not be found.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export function isNotFoundError(error: unknown): boolean {
  return error instanceof NotFoundError || (error as ServerApiFailure)?.status === 404;
}

/** TanStack serialises a server function's return value, so the payload type must be concrete. */
type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

/**
 * One same-host GET to the Worker, with the visitor's cookie and nothing else attached.
 *
 * Only the cookie crosses over. Forwarding `authorization` or a client's `x-forwarded-for` would
 * let a caller impersonate another visitor to our own API; `user-agent` is kept because the
 * Worker records it on sessions and sign-ins for the security log.
 */
async function readApi(path: string, cache: boolean): Promise<Response> {
  const env = process.env;
  const base = env["API_INTERNAL_URL"] || env["API_URL"] || "http://localhost:8787";
  const incoming = getRequestHeaders();
  const headers = new Headers();
  const cookie = incoming.get("cookie");
  if (cookie) headers.set("cookie", cookie);
  const userAgent = incoming.get("user-agent");
  if (userAgent) headers.set("user-agent", userAgent.slice(0, 256));
  headers.set("accept", "application/json");
  // SSR revalidation is driven by the API's own `s-maxage`; this keeps a bot crawl from
  // hammering D1 through us.
  if (cache) headers.set("cache-control", "max-age=30, stale-while-revalidate=120");
  return fetch(new URL(path, base).toString(), { headers, cache: "no-store" });
}

/**
 * "Who is signed in?" as a value instead of an exception.
 *
 * This is its own server function rather than another `serverApiFetch` path for two reasons. It
 * returns `null` instead of throwing: a page that cannot reach the API should render the logged-out
 * shell, and a 500 on `/` because a session probe timed out is the worst possible trade. And it is
 * skipped entirely when the request carries no session cookie, so the bot crawl that dominates a
 * directory's traffic costs nothing at all.
 *
 * `GET /auth/session` answers **200** with `{ user: null }` for an anonymous visitor, so "logged
 * out" never depends on a status code — but an unreachable or erroring API takes the same shape,
 * which is deliberate: the UI has one branch for "we do not know you".
 */
export const sessionProbe = createServerFn({ method: "GET" }).handler(
  async (): Promise<JsonValue | null> => {
    const cookie = getRequestHeaders().get("cookie");
    if (!cookie || !cookie.split(";").some((part) => part.trim().startsWith("gh_session="))) {
      return null;
    }
    try {
      const response = await readApi("/api/v1/auth/session", false);
      if (!response.ok) return null;
      const text = await response.text();
      return text ? (parseJson(text) as JsonValue) : null;
    } catch {
      return null;
    }
  },
);

export const serverApiFetch = createServerFn({ method: "GET" })
  .validator((input: { path: string; cache?: boolean }) => {
    if (typeof input?.path !== "string") throw new Error("path is required");
    return { path: assertAllowedPath(input.path), cache: input.cache !== false };
  })
  .handler(async ({ data }): Promise<JsonValue> => {
    let response: Response;
    try {
      response = await readApi(data.path, data.cache);
    } catch (error) {
      // The frontend must still render (with a retry affordance) when the API is briefly down.
      throw new ServerApiFailure(
        `Could not reach the GainHub API: ${error instanceof Error ? error.message : "unknown error"}`,
        503,
        "upstream_unavailable",
      );
    }

    const text = await response.text();
    const payload: JsonValue | null = text ? (parseJson(text) as JsonValue | null) : null;

    if (response.status === 404) {
      setResponseStatus(404);
      throw new NotFoundError();
    }
    if (!response.ok) {
      const body = (payload ?? {}) as unknown as ApiError;
      setResponseStatus(response.status >= 500 ? 500 : response.status);
      throw new ServerApiFailure(
        body?.error?.message ?? `The API answered ${response.status}.`,
        response.status,
        body?.error?.code ?? "api_error",
      );
    }

    // The server function's payload crosses a serializer, so it must be a plain JSON value;
    // every read endpoint in this API answers with an object.
    return (payload ?? {}) as JsonValue;
  });

function parseJson(text: string): JsonValue | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
