CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'consumer'
    CHECK (role IN ('consumer', 'owner', 'staff', 'admin')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'banned')),
  email_verified_at TEXT,
  marketing_opt_in INTEGER NOT NULL DEFAULT 0 CHECK (marketing_opt_in IN (0, 1)),
  show_name_on_reviews INTEGER NOT NULL DEFAULT 1 CHECK (show_name_on_reviews IN (0, 1)),
  allow_business_messaging INTEGER NOT NULL DEFAULT 1 CHECK (allow_business_messaging IN (0, 1)),
  -- Bumping this invalidates every issued session at once ("log out everywhere").
  session_version INTEGER NOT NULL DEFAULT 0,
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_login_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

--> statement-breakpoint

CREATE INDEX users_role_status_idx ON users (role, status);

--> statement-breakpoint

CREATE INDEX users_created_idx ON users (created_at DESC);

--> statement-breakpoint

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_hash TEXT NOT NULL,
  session_version INTEGER NOT NULL,
  user_agent TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  replaced_by TEXT
);

--> statement-breakpoint

CREATE INDEX sessions_user_idx ON sessions (user_id, expires_at);

--> statement-breakpoint

CREATE INDEX sessions_expiry_idx ON sessions (expires_at);

--> statement-breakpoint

CREATE TABLE action_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('email_verify', 'password_reset')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX action_tokens_user_idx ON action_tokens (user_id, kind);

--> statement-breakpoint

CREATE TABLE idempotency_keys (
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  business_id TEXT,
  response_status INTEGER NOT NULL,
  response_body TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  PRIMARY KEY (scope, key)
);

--> statement-breakpoint

CREATE INDEX idempotency_expiry_idx ON idempotency_keys (expires_at);
