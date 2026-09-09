import { ApiError } from "./errors.ts";
import { applySecurityHeaders, errorBody, json, withCors } from "./http.ts";
import { createLogger, errorFields } from "./telemetry.ts";
import { clientIpHash } from "./http.ts";
import type { AppContext, Env, RouteHandler } from "./types.ts";

type Segment = { literal: string | null; param?: string };
type Route = { method: string; segments: Segment[]; handler: RouteHandler };

function compile(pattern: string): Segment[] {
  return pattern
    .split("/")
    .filter(Boolean)
    .map((part) =>
      part.startsWith(":") ? { literal: null, param: part.slice(1) } : { literal: part },
    );
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: RouteHandler): this {
    this.routes.push({ method, segments: compile(pattern), handler });
    return this;
  }

  get = (pattern: string, handler: RouteHandler) => this.add("GET", pattern, handler);
  post = (pattern: string, handler: RouteHandler) => this.add("POST", pattern, handler);
  put = (pattern: string, handler: RouteHandler) => this.add("PUT", pattern, handler);
  patch = (pattern: string, handler: RouteHandler) => this.add("PATCH", pattern, handler);
  delete = (pattern: string, handler: RouteHandler) => this.add("DELETE", pattern, handler);

  /** Prefixes every route of `other` (e.g. mount("/admin", adminRouter)). */
  mount(prefix: string, other: Router): this {
    for (const route of other.routes) {
      this.routes.push({ ...route, segments: [...compile(prefix), ...route.segments] });
    }
    return this;
  }

  match(
    method: string,
    pathname: string,
  ): { handler: RouteHandler; params: Record<string, string> } | "method_not_allowed" | null {
    const parts = pathname.split("/").filter(Boolean);
    let pathMatched = false;
    for (const route of this.routes) {
      if (route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < route.segments.length; i++) {
        const segment = route.segments[i]!;
        const part = parts[i]!;
        if (segment.literal !== null) {
          if (segment.literal !== part) {
            ok = false;
            break;
          }
        } else if (segment.param) {
          params[segment.param] = safeDecode(part);
        }
      }
      if (!ok) continue;
      pathMatched = true;
      if (route.method === method) return { handler: route.handler, params };
    }
    return pathMatched ? "method_not_allowed" : null;
  }
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export type FetchHandler = (
  request: Request,
  env: Env,
  execution: ExecutionContext,
) => Promise<Response>;

/**
 * Cross-cutting request pipeline: request id, logger, CORS preflight, security
 * headers, and the one place where thrown errors become public responses.
 * `prepare` is where auth/session resolution happens before the handler runs.
 */
export function createFetchHandler(
  router: Router,
  prepare?: (c: AppContext) => Promise<AppContext> | AppContext,
): FetchHandler {
  return async (request, env, execution) => {
    const url = new URL(request.url);
    const requestId =
      (request.headers.get("cf-ray") ?? "").slice(-8) || crypto.randomUUID().slice(0, 8);
    const log = createLogger({
      requestId,
      method: request.method,
      path: url.pathname,
      env: env.APP_ENV ?? "production",
    });

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsPreflightHeaders(env, request) });
    }

    let context: AppContext = {
      request,
      env,
      execution,
      url,
      requestId,
      ipHash: clientIpHash(request, env.APP_ENV === "development" || env.APP_ENV === "test"),
      params: {},
      session: null,
      log,
    };

    try {
      if (prepare) context = await prepare(context);
      const matched = router.match(request.method, url.pathname);
      if (matched === null)
        throw ApiError.notFound(`No API route for ${request.method} ${url.pathname}`);
      if (matched === "method_not_allowed") {
        throw new ApiError(
          "validation_error",
          405,
          `${request.method} is not allowed on this endpoint.`,
        );
      }
      const response = await matched.handler({
        ...context,
        params: { ...context.params, ...matched.params },
      });
      return finalize(env, request, response, requestId);
    } catch (error) {
      log("error", error instanceof ApiError ? "request_rejected" : "unhandled_error", {
        ...errorFields(error),
        status: error instanceof ApiError ? error.status : undefined,
      });
      return finalize(env, request, toErrorResponse(env, error, requestId, log), requestId);
    }
  };
}

function toErrorResponse(
  env: Env,
  error: unknown,
  requestId: string,
  log: ReturnType<typeof createLogger>,
): Response {
  if (error instanceof ApiError) {
    const body = errorBody(error.code, error.message, {
      requestId,
      ...(error.fields ? { fields: error.fields } : {}),
      ...(error.retryAfterSeconds ? { retryAfterSeconds: error.retryAfterSeconds } : {}),
    });
    const headers: Record<string, string> = { "cache-control": "no-store" };
    if (error.code === "rate_limited" && error.retryAfterSeconds)
      headers["retry-after"] = String(error.retryAfterSeconds);
    if (error.status >= 500 && env.APP_ENV !== "test")
      log("error", "server_error", { message: error.message });
    return new Response(JSON.stringify(body), {
      status: error.status,
      headers: { "content-type": "application/json; charset=utf-8", ...headers },
    });
  }
  // Unexpected failure: log the detail, hand the client an opaque id to quote.
  log("error", "unhandled_exception", errorFields(error));
  return json(
    errorBody("internal_error", "Something went wrong on our side. Please try again.", {
      requestId,
    }),
    { status: 500, headers: { "cache-control": "no-store" } },
  );
}

function corsPreflightHeaders(env: Env, request: Request): Headers {
  const origin = allowedOriginFor(env, request);
  const headers = new Headers();
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-credentials", "true");
    headers.set("access-control-allow-headers", "content-type,x-csrf-token,x-idempotency-key");
    headers.set("access-control-allow-methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
    headers.set("access-control-max-age", "600");
    headers.set("vary", "Origin");
  }
  return headers;
}

function allowedOriginFor(env: Env, request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  if (env.APP_ENV === "development" || env.APP_ENV === "test") return origin;
  const list = (env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return list.includes(origin.replace(/\/$/, "")) ? origin : null;
}

function finalize(env: Env, request: Request, raw: Response, requestId: string): Response {
  // SECURITY_HEADERS is the one list of what every response carries; `applySecurityHeaders`
  // is the one place that writes it. (They were previously duplicated, and the copy in here
  // had silently dropped x-frame-options.)
  const response = applySecurityHeaders(raw);
  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  if (!headers.has("cache-control")) headers.set("cache-control", "no-store");
  let out = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  out = withCors(env, request, out);
  return out;
}
