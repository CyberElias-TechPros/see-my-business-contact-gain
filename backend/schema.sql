-- GainHub NG — D1 schema
-- Apply with: wrangler d1 execute gainhub --file=./schema.sql

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',            -- user | owner | admin
  status TEXT NOT NULL DEFAULT 'Active',        -- Active | Suspended
  whatsapp TEXT,
  prefs TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Store',
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS locations (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  areas TEXT NOT NULL DEFAULT '[]',
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  category_slug TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  rating REAL NOT NULL DEFAULT 0,
  reviews_count INTEGER NOT NULL DEFAULT 0,
  verified TEXT NOT NULL DEFAULT 'unverified',  -- unverified | email | phone | documents | premium
  open_now INTEGER NOT NULL DEFAULT 1,
  whatsapp TEXT NOT NULL,
  phone TEXT NOT NULL,
  website TEXT NOT NULL DEFAULT '',
  socials TEXT NOT NULL DEFAULT '[]',
  services TEXT NOT NULL DEFAULT '[]',
  products TEXT NOT NULL DEFAULT '[]',
  amenities TEXT NOT NULL DEFAULT '[]',
  service_areas TEXT NOT NULL DEFAULT '[]',
  gallery TEXT NOT NULL DEFAULT '[]',
  team TEXT NOT NULL DEFAULT '[]',
  hours TEXT NOT NULL DEFAULT '[]',
  plan TEXT NOT NULL DEFAULT 'Free',            -- Free | Growth | Pro
  status TEXT NOT NULL DEFAULT 'Active',        -- Active | Suspended
  contacts_gained INTEGER NOT NULL DEFAULT 0,
  saved_by INTEGER NOT NULL DEFAULT 0,
  featured INTEGER NOT NULL DEFAULT 0,
  response_minutes INTEGER NOT NULL DEFAULT 15,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_businesses_category ON businesses(category_slug);
CREATE INDEX IF NOT EXISTS idx_businesses_owner ON businesses(owner_id);
CREATE INDEX IF NOT EXISTS idx_businesses_state ON businesses(state);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT,
  author TEXT NOT NULL,
  rating INTEGER NOT NULL,
  body TEXT NOT NULL,
  reply TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Published',     -- Published | Hidden | Flagged
  created_at INTEGER NOT NULL
);

-- ------------------------------------------------------------ contact hub
-- Private per-user contact lists over the public directory ("contact gain").
CREATE TABLE IF NOT EXISTS contact_lists (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_lists_user ON contact_lists(user_id);

CREATE TABLE IF NOT EXISTS contact_list_members (
  list_id TEXT NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'New',           -- New | Contacted | Responded | Interested | Not interested | Archived
  tags TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'Directory search',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (list_id, business_id)            -- dedupe: a business lives once per list
);
CREATE INDEX IF NOT EXISTS idx_clm_business ON contact_list_members(business_id);

-- Personal "contact gain" listings (post-a-number social layer)
CREATE TABLE IF NOT EXISTS personal_listings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  owner_name TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL,
  category TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL,
  adds INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_personal_listings_user ON personal_listings(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_business ON reviews(business_id);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL DEFAULT '',
  rule TEXT NOT NULL DEFAULT '',
  verified_only INTEGER NOT NULL DEFAULT 0,
  state TEXT NOT NULL DEFAULT 'Nationwide',
  slots INTEGER NOT NULL DEFAULT 5000,
  members INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending',       -- Pending | Active | Rejected | Closed
  owner_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS room_members (
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  niche TEXT NOT NULL DEFAULT '',
  save_back INTEGER NOT NULL DEFAULT 100,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (room_id, name)
);

CREATE TABLE IF NOT EXISTS room_activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'Directory profile',
  channel TEXT NOT NULL DEFAULT 'WhatsApp',
  stage TEXT NOT NULL DEFAULT 'New',            -- New | Qualified | Quotation | Follow up | Won | Lost
  value TEXT NOT NULL DEFAULT '',
  agent TEXT NOT NULL DEFAULT 'Unassigned',
  score INTEGER NOT NULL DEFAULT 50,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_business ON leads(business_id);

CREATE TABLE IF NOT EXISTS contacts (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  email TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  last TEXT NOT NULL DEFAULT '',
  unread INTEGER NOT NULL DEFAULT 0,
  tag TEXT NOT NULL DEFAULT '',
  assigned TEXT NOT NULL DEFAULT 'Unassigned',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender TEXT NOT NULL,                          -- business | contact
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due TEXT NOT NULL DEFAULT '',
  owner TEXT NOT NULL DEFAULT 'Unassigned',
  priority TEXT NOT NULL DEFAULT 'Medium',      -- High | Medium | Low
  done INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS campaigns (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'WhatsApp link',
  scans INTEGER NOT NULL DEFAULT 0,
  leads INTEGER NOT NULL DEFAULT 0,
  cost TEXT NOT NULL DEFAULT '₦0',
  status TEXT NOT NULL DEFAULT 'Live',          -- Live | Paused | Ended
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  scans INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'Directory',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  trigger TEXT NOT NULL,
  action TEXT NOT NULL,
  runs INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Active',        -- Active | Paused
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Staff',
  status TEXT NOT NULL DEFAULT 'Invited',       -- Active | Invited | Suspended
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  business_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  business_id TEXT,
  business_name TEXT NOT NULL,
  claimant TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'Owner',
  contact TEXT NOT NULL DEFAULT '',
  evidence TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',       -- Pending | In review | Approved | Rejected
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS moderation (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  item TEXT NOT NULL,
  reason TEXT NOT NULL,
  risk TEXT NOT NULL DEFAULT 'Medium',          -- High | Medium | Low
  status TEXT NOT NULL DEFAULT 'Pending',       -- Pending | Approved | Removed
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_label TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  contact TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open',          -- Open | Reviewing | Resolved | Dismissed
  risk TEXT NOT NULL DEFAULT 'Medium',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS suggestions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  category_slug TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  contact TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  user TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'Medium',
  status TEXT NOT NULL DEFAULT 'Open',          -- Open | Waiting | Resolved
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',       -- Paid | Pending
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS ads (
  id TEXT PRIMARY KEY,
  advertiser TEXT NOT NULL,
  inventory TEXT NOT NULL,
  spend TEXT NOT NULL DEFAULT '₦0',
  chats INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Live',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS flags (
  key TEXT PRIMARY KEY,
  rollout TEXT NOT NULL DEFAULT '0%',
  audience TEXT NOT NULL DEFAULT 'All',
  status TEXT NOT NULL DEFAULT 'Disabled',
  description TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  schedule TEXT NOT NULL,
  last_run TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Healthy',
  output TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS enquiries (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT,
  name TEXT NOT NULL,
  whatsapp TEXT NOT NULL DEFAULT '',
  message TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'Directory profile',
  status TEXT NOT NULL DEFAULT 'New',           -- New | Answered | Closed
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS saved_businesses (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, business_id)
);

CREATE TABLE IF NOT EXISTS data_requests (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  request_type TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_id TEXT NOT NULL,
  type TEXT NOT NULL,                            -- contact | call | save | share | review | scan
  source TEXT NOT NULL DEFAULT 'Directory profile',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_business_time ON events(business_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_time ON events(created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  ip TEXT NOT NULL,
  route TEXT NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (ip, route, window)
);
