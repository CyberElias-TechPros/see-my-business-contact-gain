import type { D1Database, KVNamespace } from "@cloudflare/workers-types";

export type Env = {
  DB: D1Database;
  CACHE?: KVNamespace;
  ALLOWED_ORIGINS?: string;
  APP_URL?: string;
  SESSION_TTL_DAYS?: string;
};

export type Variables = {
  user?: SessionUser | null;
};

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "user" | "owner" | "admin";
  status: string;
  phone: string | null;
  whatsapp: string | null;
  prefs: Record<string, unknown>;
};

import type { Context } from "hono";

export type AppEnv = { Bindings: Env; Variables: { user: SessionUser | null } };
export type AppContext = Context<AppEnv>;
