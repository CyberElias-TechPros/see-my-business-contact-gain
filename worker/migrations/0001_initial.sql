PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL CHECK (length(full_name) BETWEEN 2 AND 100),
  email TEXT,
  phone TEXT,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'consumer' CHECK (role IN ('consumer', 'business_owner', 'platform_admin')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted')),
  email_verified_at TEXT,
  phone_verified_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE UNIQUE INDEX users_email_unique ON users(email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX users_phone_unique ON users(phone) WHERE phone IS NOT NULL;

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions(user_id);
CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE locations (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL,
  areas_json TEXT NOT NULL DEFAULT '[]',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 2 AND 120),
  tagline TEXT NOT NULL CHECK (length(tagline) BETWEEN 8 AND 160),
  about TEXT NOT NULL CHECK (length(about) BETWEEN 40 AND 2000),
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  location_slug TEXT NOT NULL REFERENCES locations(slug),
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  address TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  verification_level TEXT NOT NULL DEFAULT 'unverified' CHECK (verification_level IN ('unverified', 'email', 'phone', 'documents', 'premium')),
  rating_average REAL NOT NULL DEFAULT 0 CHECK (rating_average BETWEEN 0 AND 5),
  review_count INTEGER NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  is_open_now INTEGER NOT NULL DEFAULT 0 CHECK (is_open_now IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'published', 'suspended', 'archived')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX businesses_directory_idx ON businesses(status, category_slug, location_slug, updated_at DESC);
CREATE INDEX businesses_rating_idx ON businesses(status, rating_average DESC, review_count DESC);
CREATE INDEX businesses_owner_idx ON businesses(owner_user_id);

CREATE TABLE business_members (
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'sales', 'marketing', 'staff')),
  created_at TEXT NOT NULL,
  PRIMARY KEY (business_id, user_id)
);
CREATE INDEX business_members_user_idx ON business_members(user_id);

CREATE TABLE business_services (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);
CREATE INDEX services_business_idx ON business_services(business_id, sort_order);

CREATE TABLE listing_applications (
  id TEXT PRIMARY KEY,
  applicant_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  owner_name TEXT NOT NULL,
  email TEXT NOT NULL,
  business_name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  location_slug TEXT NOT NULL REFERENCES locations(slug),
  address TEXT NOT NULL,
  whatsapp TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'withdrawn')),
  reviewer_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX listing_applications_queue_idx ON listing_applications(status, created_at);
CREATE INDEX listing_applications_email_idx ON listing_applications(email, created_at DESC);

CREATE TABLE enquiries (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  requester_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'qualified', 'closed', 'spam')),
  idempotency_key TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, idempotency_key)
);
CREATE INDEX enquiries_business_queue_idx ON enquiries(business_id, status, created_at DESC);
CREATE INDEX enquiries_requester_idx ON enquiries(requester_user_id, created_at DESC);

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL CHECK (length(body) BETWEEN 20 AND 1500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected', 'disputed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, author_user_id)
);
CREATE INDEX reviews_public_idx ON reviews(business_id, status, created_at DESC);
CREATE INDEX reviews_moderation_idx ON reviews(status, created_at);

CREATE TABLE saved_businesses (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, business_id)
);

CREATE TABLE suggestions (
  id TEXT PRIMARY KEY,
  submitter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('new', 'correction', 'closed', 'duplicate')),
  category_slug TEXT REFERENCES categories(slug),
  business_name TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  details TEXT NOT NULL,
  contact_email TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'accepted', 'rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX suggestions_queue_idx ON suggestions(status, created_at);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  reporter_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('business', 'review', 'room', 'member', 'other')),
  target_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('scam', 'impersonation', 'incorrect', 'closed', 'abuse', 'other')),
  details TEXT NOT NULL,
  contact_email TEXT NOT NULL DEFAULT '',
  risk TEXT NOT NULL DEFAULT 'normal' CHECK (risk IN ('normal', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_review', 'resolved', 'dismissed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX reports_queue_idx ON reports(status, risk DESC, created_at);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  claimant_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  claimant_role TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  evidence_key TEXT NOT NULL,
  evidence_mime TEXT NOT NULL,
  evidence_size INTEGER NOT NULL CHECK (evidence_size > 0 AND evidence_size <= 8388608),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'contested')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (business_id, claimant_user_id)
);
CREATE INDEX claims_queue_idx ON claims(status, created_at);

CREATE TABLE contact_rooms (
  id TEXT PRIMARY KEY,
  owner_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL CHECK (purpose IN ('business', 'niche', 'network')),
  state TEXT NOT NULL,
  slot_limit INTEGER NOT NULL CHECK (slot_limit BETWEEN 20 AND 5000),
  rules TEXT NOT NULL,
  verified_only INTEGER NOT NULL DEFAULT 1 CHECK (verified_only IN (0, 1)),
  enforce_save_back INTEGER NOT NULL DEFAULT 1 CHECK (enforce_save_back IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'paused', 'closed', 'rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX contact_rooms_public_idx ON contact_rooms(status, state, created_at DESC);

CREATE TABLE room_applications (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES contact_rooms(id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'approved', 'rejected', 'left', 'removed')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (room_id, business_id)
);
CREATE INDEX room_applications_queue_idx ON room_applications(room_id, status, created_at);

CREATE TABLE data_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('access', 'portability', 'correction', 'deletion')),
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'verifying', 'processing', 'completed', 'rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX data_requests_queue_idx ON data_requests(status, created_at);

CREATE TABLE contact_events (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'phone', 'website', 'directions')),
  source TEXT NOT NULL DEFAULT 'profile',
  visitor_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX contact_events_business_idx ON contact_events(business_id, created_at DESC);

CREATE TABLE rate_limits (
  key TEXT NOT NULL,
  bucket INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  expires_at INTEGER NOT NULL,
  PRIMARY KEY (key, bucket)
);
CREATE INDEX rate_limits_expiry_idx ON rate_limits(expires_at);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  request_id TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX audit_events_entity_idx ON audit_events(entity_type, entity_id, created_at DESC);
CREATE INDEX audit_events_actor_idx ON audit_events(actor_user_id, created_at DESC);

INSERT INTO categories (slug, name, description, sort_order) VALUES
  ('phone-gadgets', 'Phone & Gadget Repair', 'Device repairs, accessories and technical support.', 10),
  ('food-restaurants', 'Food & Restaurants', 'Restaurants, caterers, kitchens and food vendors.', 20),
  ('fashion-tailoring', 'Fashion & Tailoring', 'Designers, tailors, textiles and fashion services.', 30),
  ('beauty-spa', 'Beauty, Hair & Spa', 'Hair, beauty, wellness and personal care.', 40),
  ('real-estate', 'Real Estate & Agents', 'Property sales, rentals and professional agents.', 50),
  ('logistics', 'Logistics & Dispatch', 'Courier, delivery, haulage and dispatch services.', 60),
  ('events', 'Events & Rentals', 'Event planning, rentals, entertainment and production.', 70),
  ('auto', 'Auto & Mechanics', 'Vehicle repairs, diagnostics, parts and related services.', 80),
  ('health', 'Health & Pharmacy', 'Licensed health providers, pharmacies and care services.', 90),
  ('education', 'Schools & Tutors', 'Schools, tutors, training and educational services.', 100),
  ('professionals', 'Professionals & Legal', 'Legal, accounting, consulting and specialist services.', 110),
  ('home-services', 'Home Services', 'Repairs, cleaning, electrical and property maintenance.', 120);

INSERT INTO locations (slug, name, state, areas_json, sort_order) VALUES
  ('lagos', 'Lagos', 'Lagos', '["Ikeja","Lekki","Yaba","Surulere","Ajah"]', 10),
  ('abuja', 'Abuja (FCT)', 'FCT', '["Wuse","Garki","Gwarinpa","Lugbe"]', 20),
  ('port-harcourt', 'Port Harcourt', 'Rivers', '["GRA","D-Line","Rumuokoro"]', 30),
  ('ibadan', 'Ibadan', 'Oyo', '["Bodija","Ring Road","Challenge"]', 40),
  ('kano', 'Kano', 'Kano', '["Nassarawa","Sabon Gari"]', 50),
  ('enugu', 'Enugu', 'Enugu', '["Independence Layout","New Haven"]', 60);
