CREATE TABLE memberships (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'agent', 'marketing')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('invited', 'active', 'revoked')),
  invited_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  invite_token_hash TEXT,
  invited_at TEXT NOT NULL,
  joined_at TEXT,
  revoked_at TEXT,
  PRIMARY KEY (user_id, business_id)
);

--> statement-breakpoint

CREATE INDEX memberships_business_idx ON memberships (business_id, status);

--> statement-breakpoint

CREATE INDEX memberships_invite_token_idx ON memberships (invite_token_hash);

--> statement-breakpoint

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp_link', 'qr', 'campaign_link', 'room', 'print')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live', 'paused', 'ended')),
  budget_minor INTEGER CHECK (budget_minor IS NULL OR budget_minor >= 0),
  spend_minor INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT,
  ends_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX campaigns_business_idx ON campaigns (business_id, status);

--> statement-breakpoint

CREATE TABLE links (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  campaign_id TEXT REFERENCES campaigns (id) ON DELETE SET NULL,
  label TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('whatsapp', 'qr', 'profile', 'campaign')),
  target_url TEXT,
  whatsapp_message TEXT,
  scans INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  chats_started INTEGER NOT NULL DEFAULT 0,
  leads_created INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (target_url IS NULL OR target_url LIKE 'https://%')
);

--> statement-breakpoint

CREATE INDEX links_business_idx ON links (business_id, active);

--> statement-breakpoint

CREATE TABLE link_events (
  id TEXT PRIMARY KEY,
  link_id TEXT NOT NULL REFERENCES links (id) ON DELETE CASCADE,
  business_id TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('scan', 'click', 'chat')),
  day TEXT NOT NULL,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX link_events_day_idx ON link_events (business_id, day);

--> statement-breakpoint

CREATE INDEX link_events_link_idx ON link_events (link_id, created_at DESC);

--> statement-breakpoint

CREATE TABLE contacts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  whatsapp TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  owner_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  last_contacted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (email IS NULL OR email = lower(email))
);

--> statement-breakpoint

CREATE UNIQUE INDEX contacts_business_phone_key ON contacts (business_id, phone) WHERE phone IS NOT NULL;

--> statement-breakpoint

CREATE UNIQUE INDEX contacts_business_email_key ON contacts (business_id, email) WHERE email IS NOT NULL;

--> statement-breakpoint

CREATE INDEX contacts_business_idx ON contacts (business_id, last_contacted_at DESC);

--> statement-breakpoint

CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  sender_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  contact_id TEXT REFERENCES contacts (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  need TEXT NOT NULL,
  service_id TEXT REFERENCES services (id) ON DELETE SET NULL,
  budget_minor INTEGER,
  preferred_date TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'closed')),
  source TEXT NOT NULL DEFAULT 'directory_profile',
  link_id TEXT REFERENCES links (id) ON DELETE SET NULL,
  campaign_id TEXT REFERENCES campaigns (id) ON DELETE SET NULL,
  idempotency_key TEXT NOT NULL,
  owner_reply TEXT,
  autoack_sent INTEGER NOT NULL DEFAULT 0 CHECK (autoack_sent IN (0, 1)),
  reply_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, idempotency_key)
);

--> statement-breakpoint

CREATE INDEX enquiries_business_status_idx ON enquiries (business_id, status, last_message_at DESC);

--> statement-breakpoint

CREATE INDEX enquiries_link_idx ON enquiries (link_id);

--> statement-breakpoint

CREATE TABLE enquiry_messages (
  id TEXT PRIMARY KEY,
  enquiry_id TEXT NOT NULL REFERENCES enquiries (id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  from_business INTEGER NOT NULL DEFAULT 0 CHECK (from_business IN (0, 1)),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX enquiry_messages_idx ON enquiry_messages (enquiry_id, created_at);

--> statement-breakpoint

CREATE TABLE leads (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  contact_id TEXT REFERENCES contacts (id) ON DELETE SET NULL,
  enquiry_id TEXT REFERENCES enquiries (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  stage TEXT NOT NULL DEFAULT 'new'
    CHECK (stage IN ('new', 'qualified', 'quoted', 'follow_up', 'won', 'lost')),
  score INTEGER NOT NULL DEFAULT 50 CHECK (score BETWEEN 0 AND 100),
  value_minor INTEGER CHECK (value_minor IS NULL OR value_minor >= 0),
  source TEXT NOT NULL DEFAULT 'manual',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high')),
  assignee_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  note TEXT,
  lost_reason TEXT,
  last_activity_at TEXT NOT NULL,
  won_at TEXT,
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (won_at IS NULL OR stage = 'won')
);

--> statement-breakpoint

CREATE INDEX leads_business_stage_idx ON leads (business_id, stage, last_activity_at DESC);

--> statement-breakpoint

CREATE INDEX leads_business_activity_idx ON leads (business_id, last_activity_at DESC);

--> statement-breakpoint

CREATE INDEX leads_assignee_idx ON leads (assignee_user_id, stage);

--> statement-breakpoint

CREATE UNIQUE INDEX leads_enquiry_key ON leads (enquiry_id) WHERE enquiry_id IS NOT NULL;

--> statement-breakpoint

CREATE TABLE lead_events (
  id TEXT PRIMARY KEY,
  lead_id TEXT NOT NULL REFERENCES leads (id) ON DELETE CASCADE,
  from_stage TEXT,
  to_stage TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  actor_label TEXT,
  note TEXT,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX lead_events_lead_idx ON lead_events (lead_id, created_at);

--> statement-breakpoint

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  lead_id TEXT REFERENCES leads (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_at TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done', 'archived')),
  assignee_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX tasks_business_status_idx ON tasks (business_id, status, due_at);

--> statement-breakpoint

CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  trigger_key TEXT NOT NULL
    CHECK (trigger_key IN ('new_enquiry', 'lead_stale', 'quote_requested', 'review_published', 'listing_reported')),
  action TEXT NOT NULL
    CHECK (action IN ('create_task', 'notify_owner', 'assign_round_robin', 'tag_contact')),
  config_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  runs INTEGER NOT NULL DEFAULT 0,
  last_run_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE UNIQUE INDEX automations_one_per_trigger ON automations (business_id, trigger_key);

--> statement-breakpoint

CREATE TRIGGER leads_contacts_gained_after_insert
AFTER INSERT ON leads
BEGIN
  UPDATE businesses
  SET contacts_gained = (SELECT COUNT(*) FROM leads WHERE business_id = NEW.business_id)
  WHERE id = NEW.business_id;
END;

--> statement-breakpoint

CREATE TRIGGER leads_contacts_gained_after_delete
AFTER DELETE ON leads
BEGIN
  UPDATE businesses
  SET contacts_gained = (SELECT COUNT(*) FROM leads WHERE business_id = OLD.business_id)
  WHERE id = OLD.business_id;
END;
