/**
 * Browser-side API client.
 *
 * Two rules shape this file. First, the browser only ever talks to its own origin: `/api/v1/*`
 * is proxied to the Worker by Vite in development and by `vercel.json` rewrites in production, so
 * the `SameSite=Lax` session cookie is first-party (see
 * `docs/adr/0005-same-origin-cookie-and-derived-csrf.md`). Second, every unsafe request carries
 * the CSRF token the API handed us in the session/login payload — the server derives it from the
 * session id, so it cannot be read cross-origin and there is no second cookie to keep in sync.
 *
 * Reads that must work during server rendering do NOT go through here; they use the server
 * functions in `./server-api` so that hydration and SSR issue one identical request.
 */
import type { ApiError } from "../../shared/api.ts";

export class ApiFailure extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string> | undefined;
  readonly requestId: string | undefined;
  readonly retryAfterSeconds: number | undefined;

  constructor(body: ApiError, status: number) {
    super(body.error.message);
    this.name = "ApiFailure";
    this.status = status;
    this.code = body.error.code;
    this.fields = body.error.fields;
    this.requestId = body.error.requestId;
    this.retryAfterSeconds = body.error.retryAfterSeconds;
  }

  /** Field-level messages for react-hook-form, keyed exactly like the API's `error.fields`. */
  get formErrors(): Record<string, string> {
    return this.fields ?? {};
  }
}

/**
 * The CSRF token is cached per tab and re-fetched once when the server says it is stale (which
 * happens after a sign-in in another tab, or a session revocation).
 */
let csrfToken: string | null = null;

export function setCsrfToken(token: string | null): void {
  csrfToken = token;
}

export function csrfTokenValue(): string | null {
  return csrfToken;
}

export type ApiFetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  /** Sent as `X-Idempotency-Key`; the enquiry/lead endpoints dedupe on it. */
  idempotencyKey?: string;
  headers?: HeadersInit;
  /**
   * `false` for the endpoints that *create* a session (login, register, password reset). There is
   * no token to send yet, so the lazy session fetch below would be a wasted round trip in front
   * of every sign-in. Requests that do need a token never pass this.
   */
  csrf?: boolean;
};

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const unsafe = method !== "GET";
  const headers = new Headers(options.headers);
  headers.set("accept", "application/json");
  if (options.body !== undefined) headers.set("content-type", "application/json");
  if (options.idempotencyKey) headers.set("x-idempotency-key", options.idempotencyKey);
  if (unsafe && options.csrf !== false) {
    if (csrfToken === null) {
      // A cold tab that jumped straight to a form: ask for a session before submitting, or the
      // request is rejected for a reason the user cannot act on.
      const session = await fetch("/api/v1/auth/session", { credentials: "same-origin" });
      const parsed = session.ok
        ? ((await session.json()) as { csrfToken?: string | undefined })
        : {};
      csrfToken = parsed.csrfToken ?? "";
    }
    if (csrfToken) headers.set("x-csrf-token", csrfToken);
  }

  const response = await fetch(path, {
    method,
    headers,
    credentials: "same-origin",
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const payload: unknown = text ? safeJson(text) : null;

  if (!response.ok) {
    if (response.status === 403 && csrfToken !== null && unsafe) csrfToken = null; // retry once after a reload
    const errorBody: ApiError =
      payload && typeof payload === "object" && "error" in payload
        ? (payload as ApiError)
        : {
            error: {
              code: response.status === 404 ? "not_found" : "internal_error",
              message: response.ok
                ? "Unexpected empty response."
                : `The server answered ${response.status}. Please try again.`,
            },
          };
    throw new ApiFailure(errorBody, response.status);
  }

  return (payload ?? null) as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // An HTML body from a proxy error page is not a JSON contract; ApiFailure turns it into a
    // readable message rather than a SyntaxError in the console.
    return null;
  }
}

/** Media ids become same-origin URLs the proxy can resolve (`/media/<id>`). */
export function mediaSrc(mediaId: string | null | undefined): string | null {
  return mediaId ? `/media/${mediaId}` : null;
}

/**
 * Listings without an approved cover still need a visual. Rather than fabricate photography, the
 * card renders a deterministic gradient chosen from the slug, so a reload never changes a
 * business's look and two listings rarely show the same pattern.
 */
const COVERS = [
  "bg-[linear-gradient(135deg,#0f7b6c,#12b98a)]",
  "bg-[linear-gradient(135deg,#7c3aed,#db2777)]",
  "bg-[linear-gradient(135deg,#b45309,#f59e0b)]",
  "bg-[linear-gradient(135deg,#0369a1,#22d3ee)]",
  "bg-[linear-gradient(135deg,#166534,#84cc16)]",
  "bg-[linear-gradient(135deg,#9f1239,#fb7185)]",
  "bg-[linear-gradient(135deg,#1e3a8a,#38bdf8)]",
  "bg-[linear-gradient(135deg,#3f3f46,#a1a1aa)]",
];

export function coverClass(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return COVERS[hash % COVERS.length] ?? COVERS[0]!;
}
