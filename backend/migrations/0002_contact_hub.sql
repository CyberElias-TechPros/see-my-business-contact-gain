-- Contact-hub features: review replies, private contact lists, personal listings.
ALTER TABLE reviews ADD COLUMN reply TEXT NOT NULL DEFAULT '';

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
  status TEXT NOT NULL DEFAULT 'New',
  tags TEXT NOT NULL DEFAULT '[]',
  note TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT 'Directory search',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (list_id, business_id)
);
CREATE INDEX IF NOT EXISTS idx_clm_business ON contact_list_members(business_id);

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
