-- Product completeness: real opening hours + derived open-now, richer public profile,
-- readable reviews, owner analytics, in-app notifications, password recovery, outbox.
--
-- Forward-only and additive: every statement is idempotent-safe on a database that has
-- already run 0001–0004, and no existing row is dropped or rewritten destructively.

PRAGMA foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 1. Opening hours. Makes the public "Open now" filter factual instead of a
--    boolean frozen at publication time. Times are 'HH:MM' in Africa/Lagos
--    (UTC+1 year round, no DST), zero padded, so lexicographic comparison is
--    chronological. `closes_at <= opens_at` encodes an overnight shift.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_hours (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed INTEGER NOT NULL DEFAULT 0 CHECK (is_closed IN (0, 1)),
  opens_at TEXT NOT NULL DEFAULT '09:00',
  closes_at TEXT NOT NULL DEFAULT '18:00',
  PRIMARY KEY (business_id, day_of_week)
);

CREATE INDEX IF NOT EXISTS business_hours_day_idx ON business_hours(day_of_week, is_closed);

-- ---------------------------------------------------------------------------
-- 2. Richer public profile. Closes the gap where fictional preview profiles
--    carried more useful detail than real published businesses.
-- ---------------------------------------------------------------------------
ALTER TABLE businesses ADD COLUMN amenities_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN service_areas_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN socials_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE businesses ADD COLUMN price_range TEXT NOT NULL DEFAULT '';

-- Optional profile depth is kept in its own table so the hot `businesses` row
-- stays narrow and the directory list query is unaffected.
CREATE TABLE IF NOT EXISTS business_profile_details (
  business_id TEXT PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  year_established INTEGER,
  team_size TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------------------------
-- 3. Readable reviews. Reviews were write-only: they were moderated and folded
--    into aggregates but never returned to anyone, so a profile could advertise
--    "24 reviews" with nothing to read.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS reviews_business_published_idx
  ON reviews(business_id, created_at DESC)
  WHERE status = 'published';

-- ---------------------------------------------------------------------------
-- 4. In-app notifications. Every asynchronous workflow (enquiry received,
--    listing decision, claim decision, review decision, room decision, report
--    outcome, data-request update) previously terminated in silence.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  href TEXT NOT NULL DEFAULT '',
  entity_type TEXT NOT NULL DEFAULT '',
  entity_id TEXT NOT NULL DEFAULT '',
  read_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications(user_id)
  WHERE read_at IS NULL;

-- ---------------------------------------------------------------------------
-- 5. Password recovery. Single-use, time-boxed, hashed at rest. Without this a
--    forgotten password is a permanent lockout.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  consumed_at TEXT,
  created_at TEXT NOT NULL,
  request_id TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS password_resets_expiry_idx ON password_resets(expires_at);

-- ---------------------------------------------------------------------------
-- 6. Outbound message outbox. When no transactional mail provider is configured
--    the Worker does not pretend an email was delivered — it records the message
--    here so an operator can relay it, and the UI says so plainly.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbox_messages (
  id TEXT PRIMARY KEY,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
  detail TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX IF NOT EXISTS outbox_messages_status_idx ON outbox_messages(status, created_at DESC);

-- ---------------------------------------------------------------------------
-- 7. Derived open-now cache. Kept in sync by the daily cron so any legacy read
--    of businesses.is_open_now stays truthful for businesses that publish hours.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS businesses_status_updated_idx ON businesses(status, updated_at DESC);
