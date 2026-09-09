CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Store',
  description TEXT NOT NULL DEFAULT '',
  checklist_json TEXT NOT NULL DEFAULT '[]',
  required_media_json TEXT NOT NULL DEFAULT '[]',
  sort INTEGER NOT NULL DEFAULT 100,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX categories_active_sort_idx ON categories (is_active, sort);

--> statement-breakpoint

CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  state TEXT NOT NULL,
  areas_json TEXT NOT NULL DEFAULT '[]',
  sort INTEGER NOT NULL DEFAULT 100,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE TABLE businesses (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  owner_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL DEFAULT '',
  about TEXT NOT NULL DEFAULT '',
  category_id TEXT NOT NULL REFERENCES categories (id) ON DELETE RESTRICT,
  location_id TEXT REFERENCES locations (id) ON DELETE SET NULL,
  city TEXT NOT NULL,
  area TEXT,
  state TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  socials_json TEXT NOT NULL DEFAULT '[]',
  amenities_json TEXT NOT NULL DEFAULT '[]',
  service_areas_json TEXT NOT NULL DEFAULT '[]',
  verified_level TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verified_level IN ('unverified', 'email', 'phone', 'documents', 'premium')),
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'growth', 'pro')),
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'pending', 'published', 'suspended', 'hidden')),
  response_minutes INTEGER,
  rating_avg REAL NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0,
  contacts_gained INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  saved_count INTEGER NOT NULL DEFAULT 0,
  enquiry_count INTEGER NOT NULL DEFAULT 0,
  profile_complete INTEGER NOT NULL DEFAULT 0 CHECK (profile_complete BETWEEN 0 AND 100),
  is_featured INTEGER NOT NULL DEFAULT 0 CHECK (is_featured IN (0, 1)),
  moderation_note TEXT,
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX businesses_status_category_idx ON businesses (status, category_id);

--> statement-breakpoint

CREATE INDEX businesses_status_location_idx ON businesses (status, location_id);

--> statement-breakpoint

CREATE INDEX businesses_status_rating_idx ON businesses (status, rating_avg DESC, rating_count DESC);

--> statement-breakpoint

CREATE INDEX businesses_owner_idx ON businesses (owner_user_id);

--> statement-breakpoint

CREATE UNIQUE INDEX businesses_name_city_key ON businesses (lower(name), lower(city));

--> statement-breakpoint

CREATE TABLE business_search_index (
  business_id TEXT PRIMARY KEY REFERENCES businesses (id) ON DELETE CASCADE,
  search_text TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE TABLE business_hours (
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  opens TEXT,
  closes TEXT,
  closed INTEGER NOT NULL DEFAULT 0 CHECK (closed IN (0, 1)),
  PRIMARY KEY (business_id, day_of_week)
);

--> statement-breakpoint

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  business_id TEXT REFERENCES businesses (id) ON DELETE CASCADE,
  uploaded_by_user_id TEXT REFERENCES users (id) ON DELETE SET NULL,
  kind TEXT NOT NULL
    CHECK (kind IN ('logo', 'cover', 'shop', 'interior', 'team', 'product', 'work', 'document')),
  label TEXT,
  alt TEXT NOT NULL DEFAULT '',
  r2_key TEXT NOT NULL UNIQUE,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  checksum TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'removed')),
  moderation_note TEXT,
  is_primary INTEGER NOT NULL DEFAULT 0 CHECK (is_primary IN (0, 1)),
  created_at TEXT NOT NULL,
  deleted_at TEXT
);

--> statement-breakpoint

CREATE INDEX media_business_idx ON media (business_id, kind, position);

--> statement-breakpoint

CREATE INDEX media_moderation_idx ON media (moderation_status, created_at);

--> statement-breakpoint

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  note TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX services_business_idx ON services (business_id, position);

--> statement-breakpoint

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_minor INTEGER CHECK (price_minor IS NULL OR price_minor >= 0),
  tag TEXT,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  position INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

--> statement-breakpoint

CREATE INDEX products_business_idx ON products (business_id, position);

--> statement-breakpoint

CREATE TABLE saves (
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, business_id)
);

--> statement-breakpoint

CREATE INDEX saves_business_idx ON saves (business_id);

--> statement-breakpoint

CREATE TABLE reviews (
  id TEXT PRIMARY KEY,
  business_id TEXT NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  author_user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body TEXT NOT NULL,
  visit_date TEXT,
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('pending', 'published', 'hidden')),
  source TEXT NOT NULL DEFAULT 'directory',
  owner_reply TEXT,
  owner_reply_at TEXT,
  reported_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  -- One review per customer per business: keeps AggregateRating honest and
  -- removes the "review farming" path the prototype had no defence against.
  UNIQUE (business_id, author_user_id)
);

--> statement-breakpoint

CREATE INDEX reviews_business_status_idx ON reviews (business_id, status, created_at DESC);

--> statement-breakpoint

CREATE INDEX reviews_status_idx ON reviews (status, created_at DESC);

--> statement-breakpoint

CREATE TRIGGER reviews_recalc_after_insert
AFTER INSERT ON reviews
BEGIN
  UPDATE businesses
  SET rating_avg = COALESCE((
        SELECT ROUND(AVG(rating * 1.0), 2) FROM reviews
        WHERE business_id = NEW.business_id AND status = 'published'
      ), 0),
      rating_count = COALESCE((
        SELECT COUNT(*) FROM reviews
        WHERE business_id = NEW.business_id AND status = 'published'
      ), 0)
  WHERE id = NEW.business_id;
END;

--> statement-breakpoint

CREATE TRIGGER reviews_recalc_after_update
AFTER UPDATE OF rating, status ON reviews
BEGIN
  UPDATE businesses
  SET rating_avg = COALESCE((
        SELECT ROUND(AVG(rating * 1.0), 2) FROM reviews
        WHERE business_id = NEW.business_id AND status = 'published'
      ), 0),
      rating_count = COALESCE((
        SELECT COUNT(*) FROM reviews
        WHERE business_id = NEW.business_id AND status = 'published'
      ), 0)
  WHERE id = NEW.business_id;
  UPDATE businesses
  SET rating_avg = COALESCE((
        SELECT ROUND(AVG(rating * 1.0), 2) FROM reviews
        WHERE business_id = OLD.business_id AND status = 'published'
      ), 0),
      rating_count = COALESCE((
        SELECT COUNT(*) FROM reviews
        WHERE business_id = OLD.business_id AND status = 'published'
      ), 0)
  WHERE id = OLD.business_id;
END;

--> statement-breakpoint

CREATE TRIGGER reviews_recalc_after_delete
AFTER DELETE ON reviews
BEGIN
  UPDATE businesses
  SET rating_avg = COALESCE((
        SELECT ROUND(AVG(rating * 1.0), 2) FROM reviews
        WHERE business_id = OLD.business_id AND status = 'published'
      ), 0),
      rating_count = COALESCE((
        SELECT COUNT(*) FROM reviews
        WHERE business_id = OLD.business_id AND status = 'published'
      ), 0)
  WHERE id = OLD.business_id;
END;

--> statement-breakpoint

CREATE TRIGGER businesses_search_after_insert
AFTER INSERT ON businesses
BEGIN
  INSERT INTO business_search_index (business_id, search_text, updated_at)
  VALUES (
    NEW.id,
    lower(
      NEW.name || ' ' || NEW.tagline || ' ' || NEW.about || ' ' ||
      NEW.city || ' ' || COALESCE(NEW.area, '') || ' ' || NEW.state
    ),
    NEW.updated_at
  )
  ON CONFLICT (business_id) DO UPDATE
    SET search_text = excluded.search_text, updated_at = excluded.updated_at;
END;

--> statement-breakpoint

CREATE TRIGGER businesses_search_after_update
AFTER UPDATE OF name, tagline, about, city, area, state, updated_at ON businesses
BEGIN
  INSERT INTO business_search_index (business_id, search_text, updated_at)
  VALUES (
    NEW.id,
    lower(
      NEW.name || ' ' || NEW.tagline || ' ' || NEW.about || ' ' ||
      NEW.city || ' ' || COALESCE(NEW.area, '') || ' ' || NEW.state
    ),
    NEW.updated_at
  )
  ON CONFLICT (business_id) DO UPDATE
    SET search_text = excluded.search_text, updated_at = excluded.updated_at;
END;
