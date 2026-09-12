import type { ApiErrorPayload, ApiSuccess } from "./contracts";

export class ApiClientError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, string>;
  readonly requestId?: string;

  constructor(
    status: number,
    code: string,
    message: string,
    fields: Record<string, string> = {},
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    if (requestId) this.requestId = requestId;
  }
}

function isApiError(value: unknown): value is ApiErrorPayload {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ApiErrorPayload>;
  return Boolean(candidate.error && typeof candidate.error.message === "string");
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { idempotencyKey?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  const bodyIsForm = typeof FormData !== "undefined" && init.body instanceof FormData;
  if (init.body && !bodyIsForm && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (init.method && init.method !== "GET" && init.method !== "HEAD") {
    headers.set("x-gainhub-intent", "web");
  }
  if (init.idempotencyKey) headers.set("idempotency-key", init.idempotencyKey);

  let response: Response;
  try {
    response = await fetch(`/api${path.startsWith("/") ? path : `/${path}`}`, {
      ...init,
      headers,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiClientError(
      0,
      "NETWORK_ERROR",
      "We could not reach the service. Check your connection and try again.",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      response.status,
      "INVALID_RESPONSE",
      "The service returned an unexpected response.",
    );
  }

  if (!response.ok) {
    if (isApiError(payload)) {
      throw new ApiClientError(
        response.status,
        payload.error.code,
        payload.error.message,
        payload.error.fields ?? {},
        payload.requestId,
      );
    }
    throw new ApiClientError(
      response.status,
      "REQUEST_FAILED",
      "The request could not be completed.",
    );
  }

  return (payload as ApiSuccess<T>).data;
}

export function jsonBody(value: unknown): string {
  return JSON.stringify(value);
}
