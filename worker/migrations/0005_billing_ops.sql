CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL UNIQUE REFERENCES businesses (id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'growth', 'pro')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled')),
  billing_interval TEXT NOT NULL DEFAULT 'month' CHECK (billing_interval IN ('month', 'year')),
  current_period_start TEXT,
  current_period_end TEXT,
  cancel_at_period_end INTEGER NOT NULL DEFAULT 0 CHECK (cancel_at_period_end IN (0, 1)),
  -- Internal ledger only: no card data ever touches this system (PCI stays with
  -- the payment provider, wired in via docs/DEPLOYMENT.md).
  provider TEXT NOT NULL DEFAULT 'manual' CHECK (provider IN ('manual', 'flutterwave')),
  provider_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE TABLE invoices (
  id TEXT PRIMARY KEY,
  number TEXT NOT NULL UNIQUE,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  subscription_id TEXT REFERENCES subscriptions (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  amount_minor INTEGER NOT NULL CHECK (amount_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'paid' CHECK (status IN ('draft', 'paid', 'void', 'refunded')),
  period_start TEXT,
  period_end TEXT,
  issued_at TEXT NOT NULL,
  paid_at TEXT,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX invoices_business_idx ON invoices (business_id, issued_at DESC);

--> statement-breakpoint

CREATE TABLE metrics_daily (
  business_id TEXT NOT NULL,
  day TEXT NOT NULL,
  views INTEGER NOT NULL DEFAULT 0,
  enquiries INTEGER NOT NULL DEFAULT 0,
  whatsapp_chats INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  won_value_minor INTEGER NOT NULL DEFAULT 0,
  signups INTEGER NOT NULL DEFAULT 0,
  new_listings INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (business_id, day)
);

--> statement-breakpoint

CREATE INDEX metrics_day_idx ON metrics_daily (day);

--> statement-breakpoint

CREATE TABLE cron_runs (
  id TEXT PRIMARY KEY,
  job TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'failure')),
  items_processed INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  error TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT
);

--> statement-breakpoint

CREATE INDEX cron_runs_job_idx ON cron_runs (job, started_at DESC);

--> statement-breakpoint

CREATE TABLE business_settings (
  business_id TEXT PRIMARY KEY REFERENCES businesses (id) ON DELETE CASCADE,
  enquiry_form_enabled INTEGER NOT NULL DEFAULT 1 CHECK (enquiry_form_enabled IN (0, 1)),
  enquiry_require_phone INTEGER NOT NULL DEFAULT 1 CHECK (enquiry_require_phone IN (0, 1)),
  autoack_message TEXT,
  hide_phone INTEGER NOT NULL DEFAULT 0 CHECK (hide_phone IN (0, 1)),
  notify_new_enquiry INTEGER NOT NULL DEFAULT 1 CHECK (notify_new_enquiry IN (0, 1)),
  notify_new_review INTEGER NOT NULL DEFAULT 1 CHECK (notify_new_review IN (0, 1)),
  notify_lead_stale INTEGER NOT NULL DEFAULT 1 CHECK (notify_lead_stale IN (0, 1)),
  weekly_digest INTEGER NOT NULL DEFAULT 1 CHECK (weekly_digest IN (0, 1)),
  updated_at TEXT NOT NULL
);
