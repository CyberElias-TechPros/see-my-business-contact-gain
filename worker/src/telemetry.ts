/**
 * Structured logging. Never logs passwords, tokens, cookies or full phone numbers:
 * everything sensitive passes through `redact()` first.
 */
const SENSITIVE_KEYS =
  /^(password|token|secret|authorization|cookie|csrf|session|apikey|api_key|otp|pin)$/i;
const PHONE_LIKE = /^(\+?\d[\d -]{6,}\d)$/;

export type LogFields = Record<string, unknown>;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    if (PHONE_LIKE.test(value.trim())) {
      const digits = value.replace(/\D/g, "");
      return `redacted:phone(+${digits.slice(0, 3)}…${digits.slice(-2)})`;
    }
    return value.length > 500 ? `${value.slice(0, 500)}…` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 25).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>).slice(0, 40)) {
      out[key] = SENSITIVE_KEYS.test(key) ? "redacted" : redact(val, depth + 1);
    }
    return out;
  }
  return value;
}

export function errorFields(error: unknown): LogFields {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? { cause: error.cause.message } : {};
    const named = error as Error & { code?: string; status?: number };
    return {
      name: error.name,
      message: error.message,
      stack: (error.stack ?? "").split("\n").slice(0, 6).join(" | "),
      ...(named.code ? { code: named.code } : {}),
      ...cause,
    };
  }
  return { message: String(error) };
}

export type Logger = (level: "info" | "warn" | "error", event: string, fields?: LogFields) => void;

export function createLogger(base: {
  requestId: string;
  method: string;
  path: string;
  env: string;
}): Logger {
  return (level, event, fields) => {
    const line = {
      ts: new Date().toISOString(),
      level,
      event,
      requestId: base.requestId,
      method: base.method,
      path: base.path,
      env: base.env,
      ...(fields ? { fields: redact(fields) as LogFields } : {}),
    };
    const serialized = JSON.stringify(line);
    // workerd surfaces console output in the Tail Logs view; keep it single-line JSON.
    if (level === "error") console.error(serialized);
    else if (level === "warn") console.warn(serialized);
    else console.info(serialized);
  };
}
