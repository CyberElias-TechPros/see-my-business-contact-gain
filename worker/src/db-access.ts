import { all, count, first, write, type SqlFragment } from "./db.ts";
import type { Env } from "./types.ts";

/**
 * env-first wrappers around the D1 helpers.
 *
 * Every query in the codebase goes through this file, which keeps parameter
 * binding discipline in one place (`sql` is always a literal; values always in
 * `params`) and makes a future migration to a query builder a one-file change.
 */
export const DB = {
  all: <T>(env: Env, sql: string, params: unknown[] = []) => all<T>(env.DB, sql, params),
  first: <T>(env: Env, sql: string, params: unknown[] = []) => first<T>(env.DB, sql, params),
  count: (env: Env, sql: string, params: unknown[] = []) => count(env.DB, sql, params),
  write: (env: Env, statements: { sql: string; params?: unknown[] }[]) => write(env.DB, statements),
  run: (env: Env, sql: string, params: unknown[] = []) =>
    env.DB.prepare(sql)
      .bind(...params)
      .run(),
};

export type { SqlFragment };
