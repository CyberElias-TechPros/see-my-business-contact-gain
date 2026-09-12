-- Development-only fixtures. Never apply this file to production.
INSERT OR IGNORE INTO businesses (
  id, slug, name, tagline, about, category_slug, location_slug, city, state,
  address, whatsapp, phone, website, verification_level, rating_average,
  review_count, is_open_now, status, published_at, created_at, updated_at
) VALUES
  (
    '11111111-1111-4111-8111-111111111111', 'demo-swiftfix', 'SwiftFix Lab — demo',
    'Same-day phone and laptop repairs in Ikeja',
    'This clearly labelled demonstration profile shows how a published repair business appears in the local development environment.',
    'phone-gadgets', 'lagos', 'Ikeja', 'Lagos', 'Demo address, Ikeja, Lagos',
    '+2348000000001', '+2348000000001', 'https://example.com', 'documents', 4.8, 24, 1,
    'published', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z', '2026-09-01T10:00:00.000Z'
  ),
  (
    '22222222-2222-4222-8222-222222222222', 'demo-mama-ope', 'Mama Ope Kitchen — demo',
    'Nigerian meals and small chops in Surulere',
    'This clearly labelled demonstration profile shows how a food business appears in the local development environment.',
    'food-restaurants', 'lagos', 'Surulere', 'Lagos', 'Demo address, Surulere, Lagos',
    '+2348000000002', '+2348000000002', 'https://example.com', 'phone', 4.6, 18, 1,
    'published', '2026-09-02T10:00:00.000Z', '2026-09-02T10:00:00.000Z', '2026-09-02T10:00:00.000Z'
  ),
  (
    '33333333-3333-4333-8333-333333333333', 'demo-adire-atelier', 'Adire Atelier — demo',
    'Made-to-measure Nigerian clothing from Yaba',
    'This clearly labelled demonstration profile shows how a fashion business appears in the local development environment.',
    'fashion-tailoring', 'lagos', 'Yaba', 'Lagos', 'Demo address, Yaba, Lagos',
    '+2348000000003', '+2348000000003', 'https://example.com', 'premium', 4.9, 31, 0,
    'published', '2026-09-03T10:00:00.000Z', '2026-09-03T10:00:00.000Z', '2026-09-03T10:00:00.000Z'
  );

INSERT OR IGNORE INTO business_services (id, business_id, name, price, note, sort_order) VALUES
  ('a1111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'Screen diagnosis', 'Free', 'Quote before work begins', 10),
  ('a2222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'Screen replacement', 'From ₦25,000', 'Price depends on model', 20),
  ('b1111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', 'Meal tray', 'From ₦4,500', 'Advance order recommended', 10),
  ('c1111111-1111-4111-8111-111111111111', '33333333-3333-4333-8333-333333333333', 'Consultation', 'By appointment', 'Measurements and fabric guidance', 10);
