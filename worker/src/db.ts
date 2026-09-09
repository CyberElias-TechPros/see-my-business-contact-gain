import type { Env } from "./types.ts";

/** Thin, typed helpers over D1 so call sites never repeat the `{results}` dance. */

export type D1Like = Env["DB"];

export async function all<T>(db: D1Like, sql: string, params: unknown[] = []): Promise<T[]> {
  const { results } = await db
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return (results ?? []) as T[];
}

export async function first<T>(db: D1Like, sql: string, params: unknown[] = []): Promise<T | null> {
  const row = await db
    .prepare(sql)
    .bind(...params)
    .first<T>();
  return row ?? null;
}

export async function count(db: D1Like, sql: string, params: unknown[] = []): Promise<number> {
  const row = await db
    .prepare(sql)
    .bind(...params)
    .first<{ n: number | string }>();
  return Number(row?.n ?? 0);
}

export type SqlFragment = { sql: string; params: unknown[] };

export function where(parts: (string | SqlFragment | null | undefined)[]): SqlFragment {
  const conditions: string[] = [];
  const params: unknown[] = [];
  for (const part of parts) {
    if (!part) continue;
    if (typeof part === "string") {
      conditions.push(part);
      continue;
    }
    if (part.sql) {
      conditions.push(part.sql);
      params.push(...part.params);
    }
  }
  return { sql: conditions.length ? `WHERE ${conditions.join(" AND ")}` : "", params };
}

/** `IN (…)` with bound parameters (never string-interpolated). */
export function inClause(column: string, values: readonly unknown[]): SqlFragment {
  if (values.length === 0) return { sql: "1 = 0", params: [] };
  return { sql: `${column} IN (${values.map(() => "?").join(", ")})`, params: [...values] };
}

export function json<T>(value: unknown, fallback: T): T {
  if (value == null) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

/** SQLite `RETURNING` is unavailable in D1, so ids are minted in code. */
export function newId(prefix: string): string {
  const bytes = new Uint8Array(9);
  crypto.getRandomValues(bytes);
  let out = "";
  for (const b of bytes) out += b.toString(36).padStart(2, "0");
  return `${prefix}_${out.slice(0, 16)}`;
}

export function nowIso(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

export function today(): string {
  return nowIso().slice(0, 10);
}

/** Batch write helper: D1 has no transactions, so multi-statement writes are grouped. */
export async function write(
  db: D1Like,
  statements: { sql: string; params?: unknown[] }[],
): Promise<void> {
  if (statements.length === 0) return;
  await db.batch(statements.map((s) => db.prepare(s.sql).bind(...(s.params ?? []))));
}

/** Escapes the LIKE wildcards in user-supplied search terms. */
export function likeEscape(term: string): string {
  return term.replace(/[%_\\]/g, (m) => `\\${m}`).toLowerCase();
}
