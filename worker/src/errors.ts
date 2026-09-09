import { type ApiErrorCode } from "../../shared/api.ts";

/** Every non-2xx the API can produce goes through this class. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly fields?: Record<string, string>;
  readonly retryAfterSeconds?: number;

  constructor(
    code: ApiErrorCode,
    status: number,
    message: string,
    init: { fields?: Record<string, string>; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    if (init.fields !== undefined) this.fields = init.fields;
    if (init.retryAfterSeconds !== undefined) this.retryAfterSeconds = init.retryAfterSeconds;
  }

  static validation(
    fields: Record<string, string>,
    message = "Please fix the highlighted fields.",
  ): ApiError {
    return new ApiError("validation_error", 422, message, { fields });
  }

  static unauthenticated(message = "Sign in to continue."): ApiError {
    return new ApiError("unauthenticated", 401, message);
  }

  static forbidden(message = "You do not have access to this resource."): ApiError {
    return new ApiError("forbidden", 403, message);
  }

  static notFound(message = "Not found."): ApiError {
    return new ApiError("not_found", 404, message);
  }

  static conflict(message: string, fields?: Record<string, string>): ApiError {
    return new ApiError("conflict", 409, message, fields ? { fields } : {});
  }

  static domain(message: string, fields?: Record<string, string>): ApiError {
    return new ApiError("domain_rule", 422, message, fields ? { fields } : {});
  }

  static rateLimited(
    retryAfterSeconds: number,
    message = "Too many requests. Slow down a little.",
  ): ApiError {
    return new ApiError("rate_limited", 429, message, { retryAfterSeconds });
  }

  static dependency(message: string): ApiError {
    return new ApiError("dependency_failure", 502, message);
  }
}

export function statusForMessage(code: ApiErrorCode): string {
  switch (code) {
    case "validation_error":
      return "Request could not be processed";
    case "unauthenticated":
      return "Sign in required";
    case "forbidden":
      return "Access denied";
    case "not_found":
      return "Not found";
    case "conflict":
      return "Already exists";
    case "rate_limited":
      return "Too many requests";
    default:
      return "Something went wrong";
  }
}
