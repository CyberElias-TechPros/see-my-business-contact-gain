-- Development-only fixtures. Never apply this file to production.
--
-- These three profiles are clearly labelled demonstrations. Every aggregate below is
-- derived from rows that actually exist: ratings come from the seeded published
-- reviews (recomputed at the end of this file), and opening hours are real rows so
-- the "Open now" filter behaves as it will in production.

INSERT OR IGNORE INTO businesses (
  id, slug, name, tagline, about, category_slug, location_slug, city, state,
  address, whatsapp, phone, website, verification_level, rating_average,
  review_count, is_open_now, status, published_at, created_at, updated_at
) VALUES
  (
    '11111111-1111-4111-8111-111111111111', 'demo-swiftfix', 'SwiftFix Lab — demo',
    'Same-day phone and laptop repairs in Ikeja',
    'This clearly labelled demonstration profile shows how a published repair business appears in the local development environment. It exists so search, comparison, enquiry and review flows can be exercised end to end before any real submission is reviewed.',
    'phone-gadgets', 'lagos', 'Ikeja', 'Lagos', '14 Obafemi Awolowo Way, Ikeja, Lagos',
    '+2348000000001', '+2348000000001', 'https://example.com', 'documents', 0, 0, 1,
    'published', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222', 'demo-mama-ope', 'Mama Ope Kitchen — demo',
    'Nigerian meals and small chops in Surulere',
    'This clearly labelled demonstration profile shows how a food business appears in the local development environment. Services, hours and reviews below are fixtures, and the rating is calculated from the seeded reviews rather than invented.',
    'food-restaurants', 'lagos', 'Surulere', 'Lagos', '8 Bode Thomas Street, Surulere, Lagos',
    '+2348000000002', '+2348000000002', 'https://example.com', 'phone', 0, 0, 1,
    'published', '2026-09-02T10:00:00.000Z', '2026-09-02T10:00:00.000Z', '2026-09-02T10:00:00.000Z'
  ),
  (
    '33333333-3333-4333-8333-333333333333', 'demo-adire-atelier', 'Adire Atelier — demo',
    'Made-to-measure Nigerian clothing from Yaba',
    'This clearly labelled demonstration profile shows how a fashion business appears in the local development environment. It uses the same schema, moderation rules and retrieval paths as a real published listing.',
    'fashion-tailoring', 'lagos', 'Yaba', 'Lagos', '22 Herbert Macaulay Road, Yaba, Lagos',
    '+2348000000003', '+2348000000003', 'https://example.com', 'premium', 0, 0, 0,
    'published', '2026-09-03T10:00:00.000Z', '2026-09-03T10:00:00.000Z', '2026-09-03T10:00:00.000Z'
  );

INSERT OR IGNORE INTO business_profile_details (business_id, year_established, team_size, updated_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 2019, '4 technicians', '2026-09-01T10:00:00.000Z'),
  ('22222222-2222-4222-8222-222222222222', 2016, '9 staff', '2026-09-02T10:00:00.000Z'),
  ('33333333-3333-4333-8333-333333333333', 2021, '6 artisans', '2026-09-03T10:00:00.000Z');

UPDATE businesses SET
  price_range = '₦₦',
  amenities_json = '["Walk-in welcome","Free diagnosis","Card payment","Parking available"]',
  service_areas_json = '["Ikeja","Ogba","Ojodu","Alausa"]',
  socials_json = '[{"label":"Instagram","handle":"@swiftfix.demo"}]'
WHERE id = '11111111-1111-4111-8111-111111111111';

UPDATE businesses SET
  price_range = '₦',
  amenities_json = '["Dine-in","Takeaway","Bulk orders","Vegetarian options"]',
  service_areas_json = '["Surulere","Yaba","Mushin","Ikoyi"]',
  socials_json = '[{"label":"Instagram","handle":"@mamaope.demo"}]'
WHERE id = '22222222-2222-4222-8222-222222222222';

UPDATE businesses SET
  price_range = '₦₦₦',
  amenities_json = '["By appointment","Custom fittings","Fabric sourcing","Delivery"]',
  service_areas_json = '["Yaba","Gbagada","Ikeja","Lekki"]',
  socials_json = '[{"label":"Instagram","handle":"@adireatelier.demo"}]'
WHERE id = '33333333-3333-4333-8333-333333333333';

INSERT OR IGNORE INTO business_services (id, business_id, name, price, note, sort_order) VALUES
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Screen diagnosis', 'Free', 'Quote before work begins', 10),
  ('a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Screen replacement', 'From ₦25,000', 'Price depends on model', 20),
  ('a3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', 'Battery swap', 'From ₦12,000', 'Most models same day', 30),
  ('b1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Meal tray', 'From ₦4,500', 'Advance order recommended', 10),
  ('b2222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'Small chops platter', 'From ₦18,000', 'Serves 10-15 guests', 20),
  ('b3333333-3333-4333-8333-333333333333', '22222222-2222-4222-8222-222222222222', 'Event catering', 'Quote on request', 'Lagos-wide within reason', 30),
  ('c1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Consultation', 'By appointment', 'Measurements and fabric guidance', 10),
  ('c2222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', 'Adire gown', 'From ₦45,000', 'Two fittings included', 20),
  ('c3333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'Agbada set', 'From ₦95,000', 'Hand-dyed fabric options', 30);

-- Real opening hours so the public "Open now" filter is factual in development.
-- 0 = Sunday … 6 = Saturday. Times are Africa/Lagos.
DELETE FROM business_hours WHERE business_id IN
  ('11111111-1111-4111-8111-111111111111',
   '22222222-2222-4222-8222-222222222222',
   '33333333-3333-4333-8333-333333333333');

INSERT OR IGNORE INTO business_hours (business_id, day_of_week, is_closed, opens_at, closes_at) VALUES
  ('11111111-1111-4111-8111-111111111111', 0, 1, '00:00', '00:00'),
  ('11111111-1111-4111-8111-111111111111', 1, 0, '09:00', '19:00'),
  ('11111111-1111-4111-8111-111111111111', 2, 0, '09:00', '19:00'),
  ('11111111-1111-4111-8111-111111111111', 3, 0, '09:00', '19:00'),
  ('11111111-1111-4111-8111-111111111111', 4, 0, '09:00', '19:00'),
  ('11111111-1111-4111-8111-111111111111', 5, 0, '09:00', '19:00'),
  ('11111111-1111-4111-8111-111111111111', 6, 0, '10:00', '16:00'),
  ('22222222-2222-4222-8222-222222222222', 0, 0, '12:00', '20:00'),
  ('22222222-2222-4222-8222-222222222222', 1, 0, '08:00', '21:00'),
  ('22222222-2222-4222-8222-222222222222', 2, 0, '08:00', '21:00'),
  ('22222222-2222-4222-8222-222222222222', 3, 0, '08:00', '21:00'),
  ('22222222-2222-4222-8222-222222222222', 4, 0, '08:00', '21:00'),
  ('22222222-2222-4222-8222-222222222222', 5, 0, '08:00', '22:00'),
  ('22222222-2222-4222-8222-222222222222', 6, 0, '08:00', '22:00'),
  ('33333333-3333-4333-8333-333333333333', 0, 1, '00:00', '00:00'),
  ('33333333-3333-4333-8333-333333333333', 1, 0, '10:00', '18:00'),
  ('33333333-3333-4333-8333-333333333333', 2, 0, '10:00', '18:00'),
  ('33333333-3333-4333-8333-333333333333', 3, 0, '10:00', '18:00'),
  ('33333333-3333-4333-8333-333333333333', 4, 0, '10:00', '18:00'),
  ('33333333-3333-4333-8333-333333333333', 5, 0, '10:00', '18:00'),
  ('33333333-3333-4333-8333-333333333333', 6, 0, '11:00', '15:00');

-- Fixture reviewers. Passwords are irrelevant: these accounts exist only so that
-- review authorship, the one-review-per-account rule and moderation can be tested.
INSERT OR IGNORE INTO users (
  id, full_name, email, phone, password_hash, password_salt, role, status,
  terms_accepted_at, terms_version, created_at, updated_at
) VALUES
  ('99999991-1111-4111-8111-111111111111', 'Amaka Obi', 'amaka.demo@gainhub.test', '+2348010000001',
   'not-a-real-hash', 'not-a-real-salt', 'consumer', 'active',
   '2026-09-01T10:00:00.000Z', '2026-09-12', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z'),
  ('99999992-2222-4222-8222-222222222222', 'Tunde Adeyemi', 'tunde.demo@gainhub.test', '+2348010000002',
   'not-a-real-hash', 'not-a-real-salt', 'consumer', 'active',
   '2026-09-01T10:00:00.000Z', '2026-09-12', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z'),
  ('99999993-3333-4333-8333-333333333333', 'Ngozi Eze', 'ngozi.demo@gainhub.test', '+2348010000003',
   'not-a-real-hash', 'not-a-real-salt', 'consumer', 'active',
   '2026-09-01T10:00:00.000Z', '2026-09-12', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z'),
  ('99999994-4444-4444-8444-444444444444', 'Ibrahim Musa', 'ibrahim.demo@gainhub.test', '+2348010000004',
   'not-a-real-hash', 'not-a-real-salt', 'consumer', 'active',
   '2026-09-01T10:00:00.000Z', '2026-09-12', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z'),
  ('99999995-5555-4555-8555-555555555555', 'Chioma Balogun', 'chioma.demo@gainhub.test', '+2348010000005',
   'not-a-real-hash', 'not-a-real-salt', 'consumer', 'active',
   '2026-09-01T10:00:00.000Z', '2026-09-12', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z');

-- Published reviews. The rating aggregates are derived from these rows below, so a
-- profile never advertises a score nobody can read the reviews behind.
INSERT OR IGNORE INTO reviews (id, business_id, author_user_id, rating, body, status, created_at, updated_at) VALUES
  ('r1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111',
   '99999991-1111-4111-8111-111111111111', 5,
   'Dropped a water-damaged phone in the morning and collected it the same afternoon. They quoted before touching anything and called me when a part cost more than expected.',
   'published', '2026-09-04T09:30:00.000Z', '2026-09-04T09:30:00.000Z'),
  ('r2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111',
   '99999992-2222-4222-8222-222222222222', 4,
   'Good work on a cracked screen and the price matched the quote. Only complaint is that the shop gets busy around lunchtime, so expect a wait if you walk in.',
   'published', '2026-09-08T15:10:00.000Z', '2026-09-08T15:10:00.000Z'),
  ('r3333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111',
   '99999993-3333-4333-8333-333333333333', 5,
   'They replaced a laptop battery and showed me the old cell without being asked. Small thing, but it made the whole transaction easy to trust.',
   'published', '2026-09-11T11:45:00.000Z', '2026-09-11T11:45:00.000Z'),
  ('r4444444-4444-4444-8444-444444444444', '22222222-2222-4222-8222-222222222222',
   '99999994-4444-4444-8444-444444444444', 5,
   'Ordered two trays for a small office lunch and everything arrived warm and on time. The portions were generous for the price and the packaging did not leak.',
   'published', '2026-09-05T13:20:00.000Z', '2026-09-05T13:20:00.000Z'),
  ('r5555555-5555-4555-8555-555555555555', '22222222-2222-4222-8222-222222222222',
   '99999995-5555-4555-8555-555555555555', 4,
   'The food is genuinely good and consistent. Order ahead on weekends though, because the queue builds up quickly after midday and popular items sell out.',
   'published', '2026-09-09T18:05:00.000Z', '2026-09-09T18:05:00.000Z'),
  ('r6666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222',
   '99999991-1111-4111-8111-111111111111', 5,
   'Catered a family event for forty people and delivered exactly what we agreed. They confirmed the menu twice before the date, which I appreciated.',
   'published', '2026-09-13T10:00:00.000Z', '2026-09-13T10:00:00.000Z'),
  ('r7777777-7777-4777-8777-777777777777', '33333333-3333-4333-8333-333333333333',
   '99999992-2222-4222-8222-222222222222', 5,
   'Two fittings and the gown fit perfectly. They helped choose fabric rather than pushing the most expensive option, and delivered a day earlier than promised.',
   'published', '2026-09-06T14:40:00.000Z', '2026-09-06T14:40:00.000Z'),
  ('r8888888-8888-4888-8888-888888888888', '33333333-3333-4333-8333-333333333333',
   '99999993-3333-4333-8333-333333333333', 5,
   'The hand-dyed adire is beautiful and the stitching has held up through many washes. Worth the wait if you want something properly made rather than rushed.',
   'published', '2026-09-12T16:25:00.000Z', '2026-09-12T16:25:00.000Z');

-- Derive the aggregates from the reviews above. Never hard-code a rating.
UPDATE businesses
   SET rating_average = COALESCE((
         SELECT AVG(r.rating) FROM reviews r
          WHERE r.business_id = businesses.id AND r.status = 'published'
       ), 0),
       review_count = (
         SELECT COUNT(*) FROM reviews r
          WHERE r.business_id = businesses.id AND r.status = 'published'
       ),
       updated_at = businesses.updated_at
 WHERE id IN ('11111111-1111-4111-8111-111111111111',
              '22222222-2222-4222-8222-222222222222',
              '33333333-3333-4333-8333-333333333333');
