CREATE TABLE rooms (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('business', 'niche', 'logistics', 'network')),
  house_rule TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'Lagos',
  verified_only INTEGER NOT NULL DEFAULT 1 CHECK (verified_only IN (0, 1)),
  capacity INTEGER NOT NULL DEFAULT 5000 CHECK (capacity BETWEEN 20 AND 20000),
  member_count INTEGER NOT NULL DEFAULT 0,
  avg_save_back INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'closed')),
  created_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  owned_by_business_id TEXT REFERENCES businesses (id) ON DELETE SET NULL,
  report_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX rooms_status_idx ON rooms (status, member_count DESC);

--> statement-breakpoint

CREATE TABLE room_members (
  room_id TEXT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_id TEXT REFERENCES businesses (id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'moderator', 'member')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'active', 'removed')),
  save_back_score INTEGER NOT NULL DEFAULT 0 CHECK (save_back_score BETWEEN 0 AND 100),
  checks_passed INTEGER NOT NULL DEFAULT 0,
  checks_failed INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  requested_at TEXT NOT NULL,
  joined_at TEXT,
  last_checkin_at TEXT,
  removed_at TEXT,
  removed_reason TEXT,
  PRIMARY KEY (room_id, user_id)
);

--> statement-breakpoint

CREATE INDEX room_members_user_idx ON room_members (user_id, status);

--> statement-breakpoint

CREATE INDEX room_members_queue_idx ON room_members (room_id, status, requested_at);

--> statement-breakpoint

CREATE TABLE room_activity (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX room_activity_idx ON room_activity (room_id, created_at DESC);

--> statement-breakpoint

CREATE TRIGGER room_members_recount_after_insert
AFTER INSERT ON room_members
WHEN NEW.status = 'active'
BEGIN
  UPDATE rooms SET member_count = (
    SELECT COUNT(*) FROM room_members WHERE room_id = NEW.room_id AND status = 'active'
  ) WHERE id = NEW.room_id;
END;

--> statement-breakpoint

CREATE TRIGGER room_members_recount_after_update
AFTER UPDATE OF status ON room_members
BEGIN
  UPDATE rooms SET member_count = (
    SELECT COUNT(*) FROM room_members WHERE room_id = NEW.room_id AND status = 'active'
  ) WHERE id = NEW.room_id;
END;

--> statement-breakpoint

CREATE TRIGGER room_members_score_after_update
AFTER UPDATE OF save_back_score ON room_members
BEGIN
  UPDATE rooms SET avg_save_back = COALESCE((
    SELECT ROUND(AVG(save_back_score * 1.0)) FROM room_members
    WHERE room_id = NEW.room_id AND status = 'active'
  ), 0) WHERE id = NEW.room_id;
END;

--> statement-breakpoint

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  reporter_contact TEXT,
  target_type TEXT NOT NULL CHECK (target_type IN ('business', 'review', 'user', 'room', 'media', 'listing')),
  target_id TEXT NOT NULL,
  business_id TEXT REFERENCES businesses (id) ON DELETE SET NULL,
  reason TEXT NOT NULL
    CHECK (reason IN ('scam', 'impersonation', 'fake_review', 'inappropriate_media', 'closed_or_wrong', 'spam', 'harassment', 'other')),
  detail TEXT NOT NULL,
  risk TEXT NOT NULL DEFAULT 'medium' CHECK (risk IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'actioned', 'dismissed')),
  assigned_to TEXT REFERENCES users (id) ON DELETE SET NULL,
  resolution_note TEXT,
  action_taken TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);

--> statement-breakpoint

CREATE INDEX reports_status_risk_idx ON reports (status, risk, created_at);

--> statement-breakpoint

CREATE INDEX reports_target_idx ON reports (target_type, target_id);

--> statement-breakpoint

CREATE TABLE moderation_items (
  id TEXT PRIMARY KEY,
  item_type TEXT NOT NULL CHECK (item_type IN ('media', 'review', 'listing', 'room')),
  target_id TEXT NOT NULL,
  business_id TEXT REFERENCES businesses (id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  risk TEXT NOT NULL DEFAULT 'medium' CHECK (risk IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'removed')),
  source TEXT NOT NULL DEFAULT 'automated' CHECK (source IN ('automated', 'user_report', 'system')),
  created_at TEXT NOT NULL,
  decided_at TEXT,
  decided_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  decision_note TEXT,
  UNIQUE (item_type, target_id)
);

--> statement-breakpoint

CREATE INDEX moderation_queue_idx ON moderation_items (status, risk, created_at);

--> statement-breakpoint

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  claimant_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'agent')),
  note TEXT NOT NULL,
  evidence_media_id TEXT REFERENCES media (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'contested')),
  review_note TEXT,
  reviewed_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  submitted_at TEXT NOT NULL,
  decided_at TEXT,
  UNIQUE (business_id, claimant_user_id)
);

--> statement-breakpoint

CREATE INDEX claims_status_idx ON claims (status, submitted_at);

--> statement-breakpoint

CREATE TABLE verification_requests (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  level_requested TEXT NOT NULL CHECK (level_requested IN ('email', 'phone', 'documents', 'premium')),
  document_media_id TEXT REFERENCES media (id) ON DELETE SET NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  review_note TEXT,
  reviewed_by TEXT REFERENCES users (id) ON DELETE SET NULL,
  submitted_at TEXT NOT NULL,
  decided_at TEXT
);

--> statement-breakpoint

CREATE INDEX verification_status_idx ON verification_requests (status, submitted_at);

--> statement-breakpoint

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_id TEXT REFERENCES businesses (id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  href TEXT,
  read_at TEXT,
  dedupe_key TEXT,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX notifications_user_idx ON notifications (user_id, read_at, created_at DESC);

--> statement-breakpoint

CREATE UNIQUE INDEX notifications_dedupe_idx ON notifications (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

--> statement-breakpoint

CREATE TABLE audit_logs (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses (id) ON DELETE CASCADE,
  actor_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  actor_label TEXT NOT NULL,
  actor_kind TEXT NOT NULL DEFAULT 'user' CHECK (actor_kind IN ('user', 'admin', 'system', 'cron')),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  ip_hash TEXT,
  request_id TEXT,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX audit_business_idx ON audit_logs (business_id, created_at DESC);

--> statement-breakpoint

CREATE INDEX audit_created_idx ON audit_logs (created_at DESC);

--> statement-breakpoint

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  business_id TEXT REFERENCES businesses (id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'waiting', 'resolved', 'closed')),
  assigned_to TEXT REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);

--> statement-breakpoint

CREATE INDEX tickets_status_idx ON tickets (status, priority, updated_at);

--> statement-breakpoint

CREATE TABLE ticket_messages (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  author_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  from_staff INTEGER NOT NULL DEFAULT 0 CHECK (from_staff IN (0, 1)),
  body TEXT NOT NULL,
  created_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX ticket_messages_idx ON ticket_messages (ticket_id, created_at);
