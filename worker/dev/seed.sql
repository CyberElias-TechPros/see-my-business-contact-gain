-- GainHub development / demo seed.
--
-- Purpose: give `wrangler dev` and the vitest suite a dataset that is rich enough to
-- exercise every surface (search facets, rankings, the CRM pipeline, the moderation
-- queue) without inventing numbers in the UI. Everything here is clearly demo data:
-- business names, phone numbers and review bodies are fictional.
--
--   npm run db:migrate:local && npm run db:migrate:seed
--
-- Idempotent: every block deletes its own rows first, so re-running is safe.
-- Timestamps are ISO-8601 UTC strings, matching what the API writes.
-- Aggregates (rating_avg, rating_count, contacts_gained, search index, room counts)
-- are NOT set here — the D1 triggers compute them from the rows below, which is
-- exactly what makes them trustworthy in the UI.

-- ------------------------------------------------------------------ cleanup ----

DELETE FROM metrics_daily;
DELETE FROM invoices;
DELETE FROM subscriptions;
DELETE FROM notifications;
DELETE FROM audit_logs;
DELETE FROM ticket_messages;
DELETE FROM tickets;
DELETE FROM verification_requests;
DELETE FROM claims;
DELETE FROM moderation_items;
DELETE FROM reports;
DELETE FROM room_activity;
DELETE FROM room_members;
DELETE FROM rooms;
DELETE FROM link_events;
DELETE FROM automations;
DELETE FROM tasks;
DELETE FROM lead_events;
DELETE FROM leads;
DELETE FROM enquiry_messages;
DELETE FROM enquiries;
DELETE FROM contacts;
DELETE FROM links;
DELETE FROM campaigns;
DELETE FROM saves;
DELETE FROM reviews;
DELETE FROM media;
DELETE FROM products;
DELETE FROM services;
DELETE FROM business_settings;
DELETE FROM business_hours;
DELETE FROM business_search_index;
DELETE FROM businesses;
DELETE FROM locations;
DELETE FROM categories;
DELETE FROM sessions;
DELETE FROM action_tokens;
DELETE FROM idempotency_keys;
DELETE FROM memberships;
DELETE FROM users;

-- --------------------------------------------------------------- reference ----

INSERT INTO categories (id, slug, name, icon, description, checklist_json, required_media_json, sort, is_active, created_at, updated_at) VALUES
  ('cat_phone',    'phone-gadgets',    'Phone & Gadget Repair', 'Smartphone',        'Screen swaps, battery work and board-level diagnostics from shops you can walk into.', '["Show the repair on camera","Publish a turnaround time","State warranty in writing"]', '["cover","work"]', 10, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_food',     'food-restaurants', 'Food & Restaurants',    'UtensilsCrossed',   'Kitchens taking orders on WhatsApp, with delivery or a table waiting.', '["Publish today''s menu","Show the kitchen","Confirm delivery radius"]', '["cover","menu"]', 20, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_fashion',  'fashion-tailoring','Fashion & Tailoring',   'Scissors',          'Tailors and ateliers taking measurements and finishing on time.', '["Show finished pieces","Quote a fitting date","Publish fabric options"]', '["cover","work"]', 30, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_beauty',   'beauty-spa',       'Beauty, Hair & Spa',    'Sparkles',          'Salons and home-service artists with bookable slots.', '["Publish price list","Show before and after","State home-service fee"]', '["cover","team"]', 40, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_realestate','real-estate',     'Real Estate & Agents',  'Building2',         'Agents with inspected listings — verified means the file was actually seen.', '["Upload the title document","State inspection status","Publish agency fee"]', '["cover","documents"]', 50, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_logistics','logistics',         'Logistics & Dispatch',  'Truck',             'Same-day bikes, vans and inter-state dispatch.', '["Publish cut-off times","State insurance cover","Show tracking method"]', '["cover"]', 60, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_events',   'events',            'Events & Rentals',      'PartyPopper',       'Canopies, chairs, décor and the crew that sets them up.', '["Publish package pricing","Show setup photos","State deposit terms"]', '["cover","work"]', 70, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_auto',     'auto',              'Auto & Mechanics',      'Car',               'Diagnostics, mobile mechanics and body work with a written quote.', '["Show the diagnostic tool","Quote before work","State parts sourcing"]', '["cover","work"]', 80, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_health',   'health',            'Health & Pharmacy',     'Stethoscope',       'Registered pharmacies and clinics with delivery and home visits.', '["Publish the registration number","State delivery hours"]', '["cover","documents"]', 90, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_education','education',         'Schools & Tutors',      'GraduationCap',     'Tutors and centres preparing students for WAEC, JAMB and IELTS.', '["State results honestly","Publish tutor profiles","Offer a trial lesson"]', '["cover","team"]', 100, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_pro',      'professionals',     'Professionals & Legal', 'Briefcase',         'Solicitors, accountants and CAC filing agents you can book directly.', '["Publish the bar or ICAN number","State engagement terms"]', '["cover","documents"]', 110, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('cat_home',     'home-services',     'Home Services',         'Wrench',            'Plumbing, POP, electrical and cleaning crews with a callback promise.', '["Show completed jobs","State callout fee","Give a completion date"]', '["cover","work"]', 120, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'));

INSERT INTO locations (id, slug, name, state, areas_json, sort, created_at, updated_at) VALUES
  ('loc_lagos', 'lagos',          'Lagos',          'Lagos',         '["Ikeja","Lekki","Yaba","Surulere","Ajah"]', 10, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('loc_abuja', 'abuja',          'Abuja (FCT)',    'Abuja',         '["Wuse","Garki","Gwarinpa","Lugbe"]', 20, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('loc_ph',    'port-harcourt',  'Port Harcourt',  'Rivers',        '["GRA","D-Line","Rumuokoro"]', 30, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('loc_ibadan','ibadan',         'Ibadan',         'Oyo',           '["Bodija","Ring Road","Challenge"]', 40, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('loc_kano',  'kano',           'Kano',           'Kano',          '["Nassarawa GRA","Sabon Gari"]', 50, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days')),
  ('loc_enugu', 'enugu',          'Enugu',          'Enugu',         '["Independence Layout","New Haven"]', 60, strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-400 days'));

-- ------------------------------------------------------------------ users ----
-- Demo password for every seeded account is `Gainhub123!`. It is a PBKDF2-SHA256
-- (210k rounds) hash, exactly the format the Worker verifies — so "sign in as the
-- demo owner" is a real login, not a bypass.

INSERT INTO users (id, email, email_normalized, phone, password_hash, display_name, role, status, email_verified_at, marketing_opt_in, session_version, created_at, updated_at) VALUES
  ('usr_admin',   'ada@gainhub.dev',    'ada@gainhub.dev',    '+2348031110001', 'pbkdf2-sha256$210000$ydydlVglqBN6zukjC1HAKg==$bOubQCmrxvTEGmJtJYaY2HWiIvSHCk24gIJmP+h5gD0=', 'Ada (GainHub staff)', 'admin',  'active', strftime('%Y-%m-%dT%H:%M:%SZ','now','-380 days'), 0, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now','-380 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('usr_owner1',  'hello@lumea.ng',     'hello@lumea.ng',     '+2348031110002', 'pbkdf2-sha256$210000$iwaFbk6m3sonFbqhI9nMfA==$43srYi6lOR1nIVbOf+gBCb4k5Vw4hNhrxpX5fQ84Fks=', 'Chidi Okonkwo',  'owner',  'active', strftime('%Y-%m-%dT%H:%M:%SZ','now','-300 days'), 1, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now','-300 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('usr_owner2',  'kunle@autoplug.ng',  'kunle@autoplug.ng',  '+2348031110003', 'pbkdf2-sha256$210000$/hayFeRGnjYsTOrZqWZClQ==$DAAFC0aazkMjMENp9tlOR46LoQnh6TlLBtqdl8+sP1I=', 'Kunle Adeyemi',  'owner',  'active', NULL, 1, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now','-120 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 days')),
  ('usr_staff1',  'amina@swiftfix.ng',  'amina@swiftfix.ng',  '+2348031110004', 'pbkdf2-sha256$210000$ydydlVglqBN6zukjC1HAKg==$bOubQCmrxvTEGmJtJYaY2HWiIvSHCk24gIJmP+h5gD0=', 'Amina Bello',    'staff',  'active', strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'), 0, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 hours')),
  ('usr_consumer1','ngozi@example.com', 'ngozi@example.com', '+2348031110005', 'pbkdf2-sha256$210000$ydydlVglqBN6zukjC1HAKg==$bOubQCmrxvTEGmJtJYaY2HWiIvSHCk24gIJmP+h5gD0=', 'Ngozi Uche',     'consumer','active', strftime('%Y-%m-%dT%H:%M:%SZ','now','-90 days'), 1, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now','-90 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-12 days')),
  ('usr_consumer2','tunde@example.com',  'tunde@example.com',  '+2348031110006', 'pbkdf2-sha256$210000$ydydlVglqBN6zukjC1HAKg==$bOubQCmrxvTEGmJtJYaY2HWiIvSHCk24gIJmP+h5gD0=', 'Tunde Bakare',   'consumer','active', NULL, 0, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now','-40 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days')),
  ('usr_consumer3','seun@example.com',   'seun@example.com',   '+2348031110007', 'pbkdf2-sha256$210000$ydydlVglqBN6zukjC1HAKg==$bOubQCmrxvTEGmJtJYaY2HWiIvSHCk24gIJmP+h5gD0=', 'Seun Adewale',   'consumer','active', NULL, 0, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'));

-- ------------------------------------------------------------ businesses ----
-- `profile_complete` is left at 0 and recomputed by the API — run
-- `npm run dev` and open the console to see it move as fields are filled.

-- `profile_complete` is left at 0 and recomputed by the API — run `npm run dev` and open the
-- console to see it move as fields are filled. Phone and WhatsApp are fictional 0803 numbers.
INSERT INTO businesses (id, slug, owner_user_id, name, tagline, about, category_id, location_id, city, area, state, address,
        phone, whatsapp, website, socials_json, amenities_json, service_areas_json, verified_level, plan, status,
        response_minutes, contacts_gained, view_count, saved_count, enquiry_count, is_featured, published_at, created_at, updated_at) VALUES
  ('biz_swiftfix','swiftfix-gadgets','usr_owner1','SwiftFix Gadgets','Phone & laptop repair in 45 minutes','SwiftFix has fixed more than 30,000 devices from our Ikeja workshop. Screen, battery, charging port and board-level work, quoted before we open the phone, with a 30-day written warranty on parts we supply.','cat_phone','loc_lagos','Ikeja','Computer Village','Lagos','12 Adekunle Close, Computer Village, Ikeja','+2348030000001','+2348030000001','https://swiftfix.ng','[{"label":"Instagram","handle":"@swiftfixgadgets","url":"https://instagram.com/swiftfixgadgets"},{"label":"TikTok","handle":"@swiftfixng","url":null}]','["Parking","Card payment","Transfer accepted","Warranty in writing"]','["Lagos Mainland","Nationwide courier"]','premium','pro','published',9,0,0,0,0,1,strftime('%Y-%m-%dT%H:%M:%SZ','now','-300 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-300 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days')),
  ('biz_mamaope','mama-ope-kitchen','usr_owner1','Mama Ope Kitchen','Home-style jollof, swallow & small chops','Family kitchen in Surulere cooking to order: jollof, fried rice, pounded yam, egusi and small chops for parties. Orders close at 8pm for same-day delivery inside Surulere and Ikoyi.','cat_food','loc_lagos','Surulere','Aguda','Lagos','4 Ogunl drive, Aguda, Surulere','+2348030000002','+2348030000002',null,'[{"label":"Instagram","handle":"@mamaopekitchen","url":null}]','["Delivery","Card payment","Transfer accepted","Halal"]','["Surulere","Ikoyi","Victoria Island"]','documents','growth','published',17,0,0,0,0,1,strftime('%Y-%m-%dT%H:%M:%SZ','now','-290 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-290 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('biz_adire','adire-atelier','usr_owner1','Adire Atelier','Bespoke agbada, kaftan & aso-oke','An atelier in Yaba cutting adire, aso-oke and kaftans for weddings and corporate wear. Two fittings included; rush work available when the diary allows.','cat_fashion','loc_lagos','Yaba','Sabo','Lagos','7 Sabo Close off Herbert Macaulay Way, Yaba','+2348030000003','+2348030000003',null,'[{"label":"Instagram","handle":"@adireatelier","url":null},{"label":"Pinterest","handle":"adireatelier","url":null}]','["By appointment","Card payment","Fitting room"]','["Lagos Island","Abuja by courier"]','premium','growth','published',41,0,0,0,0,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-270 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-270 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days')),
  ('biz_glow','glow-by-tola','usr_owner1','Glow by Tola','Hair, nails, lashes & home-service spa','Braiding, wig installs, gel nails and lash lifts in Lekki, plus a home-service crew for events and brides. Book a slot or send a reference picture first.','cat_beauty','loc_lagos','Lekki','Ikate','Lagos','2B Ikate Elegushi, Lekki Phase 1','+2348030000004','+2348030000004','https://glowbytola.example','[{"label":"Instagram","handle":"@glowbytola","url":null},{"label":"TikTok","handle":"@glowbytola","url":null}]','["Parking","Card payment","Home service","Wheelchair access"]','["Lekki","Ikoyi","Ikeja GRA"]','documents','growth','published',24,0,0,0,0,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-250 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-250 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('biz_keyhomes','keyhomes-realty','usr_owner1','KeyHomes Realty','Verified shortlets, rentals & land in FCT','Shortlets and family flats in Gwarinpa, Maitama and Lugbe. Every listing is physically inspected by an agent before it is published, and the inspection note is attached.','cat_realestate','loc_abuja','Gwarinpa','Phase 3','Abuja','14 Ahmadu Bello Way, Gwarinpa Phase 3, Abuja','+2348030000005','+2348030000005','https://keyhomes.example','[]','["Inspection report","Transfer accepted","Security gate"]','["Abuja","Loko","Kubwa"]','documents','pro','published',63,0,0,0,0,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-240 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-240 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days')),
  ('biz_rapid','rapid-dispatch-ng','usr_owner1','Rapid Dispatch NG','Same-day bike & van dispatch','Bikes for parcels and vans for furniture, inside Abuja and to Kaduna, Loko and Keppe. Live photo proof of delivery on every job.','cat_logistics','loc_abuja','Wuse II','Central Area','Abuja','Plot 90A, Wuse II, Abuja','+2348030000006','+2348030000006',null,'[]','["Live tracking","Proof of delivery","Insured"]','["Abuja","Kaduna","Loko"]','phone','free','published',12,0,0,0,0,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-210 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-210 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('biz_crown','crown-events','usr_owner1','Crown Events & Rentals','Canopies, chairs, décor & MC services','Party rentals in Port Harcourt: canopies, chiavari chairs, naples décor, smoke machine and an MC who actually reads the room.','cat_events','loc_ph','GRA','Phase 2','Rivers','22 Aba Road, GRA Phase 2, Port Harcourt','+2348030000007','+2348030000007',null,'[{"label":"Instagram","handle":"@crowneventsph","url":null}]','["Delivery","Setup crew","Deposit required"]','["Port Harcourt","Obio-Akpor","Aluu"]','phone','free','hidden',88,0,0,0,0,0,null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-190 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-21 days')),
  ('biz_autoplug','autoplug-mechanics','usr_owner2','AutoPlug Mechanics','Mobile mechanic & diagnostics','Diagnostics-first mobile mechanic on Ring Road. We scan before we touch, send you the fault code and quote in writing on WhatsApp.','cat_auto','loc_ibadan','Ring Road','Iwo Road','Oyo','18 Ring Road, near Iwo Road Gate, Ibadan','+2348030000008','+2348030000008',null,'[]','["OBD diagnostics","Breakdown response","Parts sourcing"]','["Ibadan","Iwo Road","Moniya"]','unverified','free','published',null,0,0,0,0,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-170 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-170 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days')),
  ('biz_wellcare','wellcare-pharmacy','usr_owner2','WellCare Pharmacy','Registered pharmacy with delivery','A registered pharmacy in New Haven with a pharmacist on the counter from 8am. Prescription delivery inside Enugu before 6pm.','cat_health','loc_enugu','New Haven','Independence Layout','Enugu','3 Ogui Road, New Haven, Enugu','+2348030000009','+2348030000009',null,'[]','["Licensed","Delivery","Insurance accepted"]','["Enugu","Nsukka","Udi"]','documents','growth','published',33,0,0,0,0,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-160 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-160 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days')),
  ('biz_brightpath','brightpath-tutors','usr_owner2','BrightPath Tutors','WAEC, JAMB & IELTS coaching','Small-group classes and one-to-one tutoring in Bodija, with a free diagnostic test before you pay for anything.','cat_education','loc_ibadan','Bodija','Awoyaya','Oyo','6 Awoyaya Avenue, Bodija, Ibadan','+2348030000010','+2348030000010',null,'[{"label":"WhatsApp channel","handle":"BrightPath Ibadan","url":null}]','["Free trial class","Online classes","Small groups"]','["Ibadan","University of Ibadan campus"]','phone','free','draft',null,0,0,0,0,0,null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-40 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('biz_okoro','okoro-associates','usr_owner2','Okoro & Associates','Property law, contracts & CAC filings','Solicitors handling tenancy agreements, deed of assignment, CAC registration and estate disputes in Port Harcourt.','cat_pro','loc_ph','D-Line','Peter Odili Road','Rivers','5 Peter Odili Road, D-Line, Port Harcourt','+2348030000011','+2348030000011','https://okoro-associates.example','[]','["By appointment","Written engagement letter"]','["Port Harcourt","Rivers State"]','documents','growth','published',140,0,0,0,0,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-150 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-150 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-60 days')),
  ('biz_fixit','fixit-home-services','usr_owner2','FixIt Home Services','Plumbing, POP, electrical & cleaning','A crew of nine handling leaks, POP ceilings, rewiring and end-of-tenancy cleaning, with a callback promise inside 30 minutes.','cat_home','loc_lagos','Ajah','Lekki-Epe Expressway','Lagos','Shop 4, Ajah Motors Plaza, Lekki-Epe Expressway','+2348030000012','+2348030000012',null,'[]','["Same-day callout","Card payment","Team insured"]','["Ajah","Lekki","Ikorodu"]','email','free','published',52,0,0,0,0,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-110 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-110 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-11 days'));

-- Every listing gets the standard Monday–Saturday week, Sunday closed, except the
-- kitchen (late finish) and the pharmacy (opens early, closes late).
WITH RECURSIVE weekdays(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM weekdays WHERE n < 5)
INSERT INTO business_hours (business_id, day_of_week, opens, closes, closed)
SELECT b.id, d.n, '08:00', '18:00', 0 FROM businesses b, weekdays d;
INSERT INTO business_hours (business_id, day_of_week, opens, closes, closed) SELECT id, 6, '09:00', '16:00', 0 FROM businesses;
INSERT INTO business_hours (business_id, day_of_week, opens, closes, closed) SELECT id, 0, NULL, NULL, 1 FROM businesses;
UPDATE business_hours SET opens = '07:00', closes = '21:00' WHERE business_id = 'biz_wellcare';
UPDATE business_hours SET opens = '09:00', closes = '20:00' WHERE business_id = 'biz_mamaope' AND day_of_week BETWEEN 1 AND 5;
UPDATE business_hours SET closed = 1, opens = NULL, closes = NULL WHERE business_id = 'biz_autoplug' AND day_of_week = 6;

INSERT INTO services (id, business_id, name, price_minor, note, active, position, created_at, updated_at)
SELECT 'srv_' || b.id || '_' || t.n, b.id, t.name, t.price, t.note, 1, t.n,
       strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-20 days')
  FROM businesses b
  JOIN (SELECT 1 AS n, 'Standard service' AS name, 1500000 AS price, 'Same-day where possible' AS note) t
  UNION ALL
SELECT 'srv_' || b.id || '_2', b.id, 'Premium service', 4500000, 'Priority handling, written warranty', 1, 2,
       strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-20 days') FROM businesses b
  UNION ALL
SELECT 'srv_' || b.id || '_3', b.id, 'Consultation', 0, 'On WhatsApp, no obligation', 1, 3,
       strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-20 days') FROM businesses b;

INSERT INTO products (id, business_id, name, price_minor, tag, active, position, created_at, updated_at)
SELECT 'prd_' || b.id || '_1', b.id, 'Starter package', 2500000, 'Popular', 1, 1,
       strftime('%Y-%m-%dT%H:%M:%SZ','now','-190 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') FROM businesses b
  UNION ALL
SELECT 'prd_' || b.id || '_2', b.id, 'Bundle offer', 6000000, 'Offer', 1, 2,
       strftime('%Y-%m-%dT%H:%M:%SZ','now','-190 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') FROM businesses b
  UNION ALL
SELECT 'prd_' || b.id || '_3', b.id, 'Enterprise / bulk', NULL, 'Request quote', 1, 3,
       strftime('%Y-%m-%dT%H:%M:%SZ','now','-190 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days') FROM businesses b;

INSERT INTO business_settings (business_id, enquiry_form_enabled, enquiry_require_phone, autoack_message, hide_phone, notify_new_enquiry, notify_new_review, notify_lead_stale, weekly_digest, updated_at)
SELECT id, 1, 1, 'Thank you for contacting us. We reply on WhatsApp within working hours with a written quote.', 0, 1, 1, 1, 1, strftime('%Y-%m-%dT%H:%M:%SZ','now','-20 days') FROM businesses;

-- ---------------------------------------------------------------- reviews ----

INSERT INTO reviews (id, business_id, author_user_id, rating, body, visit_date, status, source, owner_reply, owner_reply_at, reported_count, created_at, updated_at) VALUES
  ('rev_1','biz_swiftfix','usr_consumer1',5,'Dropped my iPhone at 10am, picked it up at 11am with the same-day warranty written on the receipt. They sent photos of the old panel before closing it up.',date('now','-13 days'),'published','directory',null,null,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-12 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-12 days')),
  ('rev_2','biz_swiftfix','usr_consumer2',4,'Repair was clean and the price matched the WhatsApp quote exactly. The shop is rammed on Saturdays, so book a slot instead of queueing.',date('now','-14 days'),'published','directory','Thanks Tunde — Saturday slots are now limited to six, which should help.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 days'),0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-13 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 days')),
  ('rev_3','biz_mamaope','usr_consumer1',5,'Ordered party jollof for 40 guests at short notice. Arrived hot, enough portions, and the small chops were still crisp in the box.',date('now','-21 days'),'published','directory',null,null,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-20 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-20 days')),
  ('rev_4','biz_mamaope','usr_consumer3',4,'Food was excellent; the rider was 50 minutes behind the promised window. They called to tell me rather than going quiet.',date('now','-34 days'),'published','directory',null,null,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-33 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-33 days')),
  ('rev_5','biz_adire','usr_consumer1',5,'Two fittings, and the aso-oke matched my wife''s iro and buba exactly. Delivered two days before the wedding as promised.',date('now','-46 days'),'published','directory',null,null,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-45 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-45 days')),
  ('rev_6','biz_glow','usr_consumer2',4,'Knotless took four hours but came out clean. Do not be late for your slot — they hold it for 15 minutes only.',date('now','-9 days'),'published','directory','Noted — we now send an SMS reminder two hours ahead.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 days'),0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-8 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-8 days')),
  ('rev_7','biz_keyhomes','usr_consumer1',3,'The shortlet existed and matched the photos, which is more than I can say for the other agency. The refund process took eight days.',date('now','-26 days'),'published','directory','Refund cleared on Friday. We have since moved deposits to a single sign-off.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-25 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('rev_8','biz_rapid','usr_consumer2',5,'Photo of the parcel on the desk with a timestamp. My client could not deny receipt.',date('now','-19 days'),'published','directory','Glad it helped — we are adding the same proof to van jobs this month.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-17 days'),0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-18 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-18 days')),
  ('rev_9','biz_wellcare','usr_consumer1',5,'Sent a prescription at 7:40am, it was delivered by 10am and the pharmacist rang to check for a drug interaction. Rare.',date('now','-7 days'),'published','directory',null,null,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days')),
  -- Held for moderation: a fraudulent payment request in the name of a real shop. The
  -- listing owner has replied, and an admin has to decide whether the review stays.
  ('rev_10','biz_swiftfix','usr_consumer3',1,'Sent my money a fake tracking link. I paid for a courier pickup and the tracking number was dead.',date('now','-1 days'),'pending','directory','This is not us — someone is impersonating SwiftFix on WhatsApp. We have reported the number and will not reply to prepayment requests from unverified chats.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),1,strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'));

-- ----------------------------------------------------- workspace CRM content ----

INSERT INTO memberships (user_id, business_id, role, status, invited_at, joined_at)
SELECT 'usr_owner1', id, 'owner', 'active', strftime('%Y-%m-%dT%H:%M:%SZ','now','-300 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-300 days')
  FROM businesses WHERE owner_user_id = 'usr_owner1';
INSERT INTO memberships (user_id, business_id, role, status, invited_at, joined_at)
SELECT 'usr_owner2', id, 'owner', 'active', strftime('%Y-%m-%dT%H:%M:%SZ','now','-170 days'), strftime('%Y-%m-%dT%H:%M:%SZ','now','-170 days')
  FROM businesses WHERE owner_user_id = 'usr_owner2';
INSERT INTO memberships (user_id, business_id, role, status, invited_by, invited_at, joined_at) VALUES
  ('usr_staff1','biz_swiftfix','manager','active','usr_owner1',strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days')),
  ('usr_admin','biz_swiftfix','owner','active',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-290 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-290 days'));

INSERT INTO campaigns (id, business_id, name, channel, status, budget_minor, spend_minor, starts_at, ends_at, created_at, updated_at) VALUES
  ('cmp_swiftfix_ramadan','biz_swiftfix','Computer Village flyer drop','qr','live',2500000,1800000,strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days'),null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-31 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('cmp_swiftfix_ig','biz_swiftfix','Instagram story link','campaign_link','live',900000,900000,strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days'),null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('cmp_mamaope_church','biz_mamaope','Sunday bulletin QR','qr','paused',300000,300000,strftime('%Y-%m-%dT%H:%M:%SZ','now','-60 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-45 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-61 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-44 days'));

INSERT INTO links (id, code, business_id, campaign_id, label, kind, target_url, whatsapp_message, scans, clicks, chats_started, leads_created, active, created_by, created_at, updated_at) VALUES
  ('lnk_swiftfix_flyer','SF7KQ2','biz_swiftfix','cmp_swiftfix_ramadan','Counter flyer QR','qr','https://gainhub.ng/business/swiftfix-gadgets','Hi SwiftFix, I scanned your flyer — I need a quote.',412,268,190,96,1,'usr_owner1',strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hours')),
  ('lnk_swiftfix_ig','SF9PLM','biz_swiftfix','cmp_swiftfix_ig','IG story: screen deal','campaign','https://gainhub.ng/business/swiftfix-gadgets','I saw your story about the screen deal.',118,96,71,40,1,'usr_staff1',strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 hours')),
  ('lnk_mamaope','MO3XRT','biz_mamaope','cmp_mamaope_church','Bulletin QR','qr','https://gainhub.ng/business/mama-ope-kitchen','Hello! I would like to order jollof for 20 guests.',87,54,38,21,1,'usr_owner1',strftime('%Y-%m-%dT%H:%M:%SZ','now','-60 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-45 days'));

WITH RECURSIVE days(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM days WHERE n < 28)
INSERT INTO link_events (id, link_id, business_id, kind, day, created_at)
SELECT 'lx_' || l.id || '_' || d.n, l.id, l.business_id,
       CASE (d.n % 3) WHEN 0 THEN 'scan' WHEN 1 THEN 'click' ELSE 'chat' END,
       date('now', '-' || (d.n % 28) || ' days'),
       date('now', '-' || (d.n % 28) || ' days') || 'T10:00:00Z'
  FROM links l, days d;

INSERT INTO contacts (id, business_id, name, phone, email, whatsapp, tags_json, notes, source, owner_user_id, message_count, last_contacted_at, created_at, updated_at) VALUES
  ('con_1','biz_swiftfix','Bola Aluko','+2348111000101','bola@example.com','+2348111000101','["repeat","iphone"]','Screen replaced twice in 18 months.','directory_profile','usr_staff1',7,strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-120 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('con_2','biz_swiftfix','Emeka Nwosu','+2348111000102',null,'+2348111000102','["laptop","corporate"]','Fixes three office laptops every quarter.','qr_code','usr_staff1',4,strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-70 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days')),
  ('con_3','biz_mamaope','Funke Ade','+2348111000103','funke@example.com','+2348111000103','["party"]','Ordered for two weddings.','campaign_link','usr_owner1',5,strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-33 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days')),
  ('con_9','biz_autoplug','Segun Ige','+2348111000109',null,'+2348111000109','["repeat","mobile job"]','Prefers the mechanic to come to the office car park.','directory_profile','usr_owner2',3,strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-70 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'));

INSERT INTO enquiries (id, business_id, sender_user_id, contact_id, name, phone, email, need, service_id, budget_minor, preferred_date, status, source, link_id, campaign_id, idempotency_key, owner_reply, reply_count, last_message_at, created_at, updated_at) VALUES
  ('enq_1','biz_swiftfix','usr_consumer1','con_1','Bola Aluko','+2348111000101','bola@example.com','iPhone 13 screen is cracked, touch still works. What is the price and how long?','srv_biz_swiftfix_1',4000000,date('now','+1 day'),'replied','directory_profile','lnk_swiftfix_ig',null,'seed-enq-1','Screen for the 13 is ₦68,000 with a 30-day warranty. You can come tomorrow at 10am.',1,strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('enq_2','biz_swiftfix',null,'con_2','Emeka Nwosu','+2348111000102',null,'Three Dell laptops need battery replacements for our office.','srv_biz_swiftfix_2',null,null,'read','qr_code','lnk_swiftfix_flyer','cmp_swiftfix_ramadan','seed-enq-2',null,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days')),
  ('enq_3','biz_mamaope','usr_consumer2','con_3','Funke Ade','+2348111000103','funke@example.com','Jollof and small chops for 60 guests on Saturday.','srv_biz_mamaope_3',12000000,date('now','+3 days'),'new','campaign_link','lnk_mamaope','cmp_mamaope_church','seed-enq-3',null,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('enq_4','biz_autoplug',null,'con_9','Segun Ige','+2348111000109',null,'Car is smoking on cold start, need a diagnosis at my office.','srv_biz_autoplug_1',null,null,'new','directory_profile',null,null,'seed-enq-4',null,0,strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'));

INSERT INTO enquiry_messages (id, enquiry_id, author_user_id, from_business, body, created_at) VALUES
  ('msg_1','enq_1','usr_consumer1',0,'How much for an iPhone 13 screen, and can it be done while I wait?',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('msg_2','enq_1','usr_staff1',1,'Screen for the 13 is ₦68,000 with a 30-day warranty. You can come tomorrow at 10am.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('msg_3','enq_3','usr_consumer2',0,'We need it delivered to Ikoyi by 1pm. Is that possible?',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'));

-- Leads created *from* enquiries (the pipeline the product exists for).
INSERT INTO leads (id, code, business_id, contact_id, enquiry_id, name, phone, email, stage, score, value_minor, source, priority, assignee_user_id, note, last_activity_at, won_at, closed_at, created_at, updated_at) VALUES
  ('led_1','LD-1001','biz_swiftfix','con_1','enq_1','Bola Aluko','+2348111000101','bola@example.com','quoted',82,6800000,'directory_profile','high','usr_staff1','Confirmed tomorrow 10am; bring the phone box for the warranty slip.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),null,null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('led_2','LD-1002','biz_swiftfix','con_2','enq_2','Emeka Nwosu','+2348111000102',null,'qualified',64,1950000,'qr_code','medium','usr_staff1','Corporate account — asked for a printed quote for approval.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days'),null,null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days')),
  ('led_3','LD-1003','biz_swiftfix',null,null,'Chidi (walk-in)','+2348111000111',null,'won',70,4500000,'manual','low','usr_owner1','Repeat customer from Computer Village, paid on pickup.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-8 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days')),
  ('led_4','LD-1004','biz_mamaope','con_3','enq_3','Funke Ade','+2348111000103','funke@example.com','new',58,12000000,'campaign_link','high',null,'Party for 60; needs delivery to Ikoyi by 1pm.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),null,null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('led_5','LD-1005','biz_mamaope',null,null,'Ikeja Hotel (event)','+2348111000112',null,'lost',30,8000000,'referral','medium','usr_owner1','Went with a cheaper caterer; asked us to quote for December.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-19 days'),null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-19 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-24 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-19 days'));

UPDATE leads SET lost_reason = 'Price, and a 3-day lead time we could not match.' WHERE id = 'led_5';

INSERT INTO lead_events (id, lead_id, from_stage, to_stage, actor_user_id, actor_label, note, created_at) VALUES
  ('lev_1','led_1',null,'new','usr_staff1','Amina Bello','Imported from enquiry enq_1.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('lev_2','led_1','new','qualified','usr_staff1','Amina Bello','Confirmed it is a cracked outer panel, digitiser works.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('lev_3','led_1','qualified','quoted','usr_staff1','Amina Bello','₦68,000 with warranty.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('lev_4','led_2',null,'new','usr_owner1','Chidi Okonkwo','Imported from enquiry enq_2.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days')),
  ('lev_5','led_2','new','qualified','usr_staff1','Amina Bello','Needs a printed quote for the office.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days')),
  ('lev_6','led_3','follow_up','won','usr_owner1','Chidi Okonkwo','Paid on pickup.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days')),
  ('lev_7','led_5','quoted','lost','usr_owner1','Chidi Okonkwo','Lost on price and lead time.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-19 days'));

INSERT INTO tasks (id, business_id, lead_id, title, due_at, priority, status, assignee_user_id, created_by, completed_at, created_at, updated_at) VALUES
  ('tsk_1','biz_swiftfix','led_2','Send the printed quote for the three Dell batteries',strftime('%Y-%m-%dT%H:%M:%SZ','now','+1 days'),'high','open','usr_staff1','usr_owner1',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days')),
  ('tsk_2','biz_swiftfix',null,'Print new counter QR (the flyer one is scuffed)',strftime('%Y-%m-%dT%H:%M:%SZ','now','+4 days'),'low','open','usr_owner1','usr_owner1',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 days')),
  ('tsk_3','biz_swiftfix','led_3','Add the warranty slip photo to the job record',null,'medium','done','usr_staff1','usr_staff1',strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days')),
  ('tsk_4','biz_mamaope','led_4','Confirm the Ikoyi delivery window for 60 guests',strftime('%Y-%m-%dT%H:%M:%SZ','now','+0 days'),'high','open',null,'usr_owner1',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'));

INSERT INTO automations (id, business_id, trigger_key, action, config_json, enabled, runs, last_run_at, created_at, updated_at) VALUES
  ('aut_1','biz_swiftfix','new_enquiry','create_task','{"title":"Reply to new enquiry","dueInHours":4,"priority":"high"}',1,96,strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hours'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 hours')),
  ('aut_2','biz_swiftfix','lead_stale','create_task','{"title":"Follow up {lead.code}","dueInHours":24,"priority":"medium"}',1,14,strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-180 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('aut_3','biz_swiftfix','review_published','notify_owner','{"onlyIfBelow":4}',1,7,strftime('%Y-%m-%dT%H:%M:%SZ','now','-8 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-150 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-8 days')),
  ('aut_4','biz_mamaope','new_enquiry','assign_round_robin','{"users":["usr_owner1"],"balanceBy":"open_leads"}',0,0,null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-60 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-60 days')),
  ('aut_5','biz_mamaope','listing_reported','tag_contact','{"tag":"risk-flagged"}',1,1,strftime('%Y-%m-%dT%H:%M:%SZ','now','-44 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-45 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-44 days'));

INSERT INTO saves (user_id, business_id, created_at) VALUES
  ('usr_consumer1','biz_adire',strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days')),
  ('usr_consumer1','biz_swiftfix',strftime('%Y-%m-%dT%H:%M:%SZ','now','-12 days')),
  ('usr_consumer2','biz_glow',strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 days'));

-- ------------------------------------------------------ contact-gain rooms ----

INSERT INTO rooms (id, slug, name, purpose, house_rule, state, verified_only, capacity, status, created_by_user_id, owned_by_business_id, created_at, updated_at) VALUES
  ('rm_lagos_vendors','lagos-vendors-hub','Lagos Vendors Hub','business','Save every contact you gain, post one status daily, no DM spam from new members.','Lagos',1,5000,'active','usr_owner1','biz_swiftfix',strftime('%Y-%m-%dT%H:%M:%SZ','now','-290 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('rm_abuja_dispatch','abuja-dispatch-network','Abuja Dispatch Network','logistics','Share live van and bike availability. No poaching another member''s rider mid-job.','Abuja',1,1200,'active','usr_owner1','biz_rapid',strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days')),
  ('rm_food_suppliers','lagos-food-suppliers','Lagos Food & Suppliers Circle','network','Bring one useful contact per week. Adapters, packaging, gas — real suppliers only.','Lagos',0,3000,'active','usr_owner1','biz_mamaope',strftime('%Y-%m-%dT%H:%M:%SZ','now','-180 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days')),
  ('rm_tailors','southwest-tailors','South-West Tailors Exchange','niche','Share fabric sources and overflow work. Reference photos must be your own work.','Oyo',1,900,'paused','usr_owner2',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-120 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-25 days')),
  ('rm_ph_events','ph-events-crew','Port Harcourt Events Crew','business','Deposit terms are published in the room, not negotiated privately.','Rivers',1,700,'pending','usr_owner1','biz_crown',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'));

INSERT INTO room_members (room_id, user_id, business_id, role, status, save_back_score, checks_passed, checks_failed, note, requested_at, joined_at, last_checkin_at) VALUES
  ('rm_lagos_vendors','usr_owner1','biz_swiftfix','owner','active',88,14,1,'Runs the counter at Computer Village.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-290 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-290 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('rm_lagos_vendors','usr_staff1','biz_swiftfix','moderator','active',74,9,2,'Handles bookings.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-9 days')),
  ('rm_lagos_vendors','usr_consumer1',null,'member','active',52,5,3,'Reseller, buys in bulk.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-150 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-149 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-21 days')),
  ('rm_lagos_vendors','usr_owner2',null,'member','queued',0,0,0,'I fix phones in Ibadan and want the supplier list.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),null,null),
  ('rm_abuja_dispatch','usr_owner1','biz_rapid','owner','active',91,20,0,null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-200 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('rm_food_suppliers','usr_owner1','biz_mamaope','owner','active',66,11,4,null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-180 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-180 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days')),
  ('rm_tailors','usr_consumer2',null,'member','removed',12,1,6,'Spamming fabric links.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-90 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-89 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-40 days'));

UPDATE room_members SET removed_at = strftime('%Y-%m-%dT%H:%M:%SZ','now','-12 days'), removed_reason = 'Posting supplier affiliate links daily' WHERE room_id = 'rm_tailors' AND user_id = 'usr_consumer2';

INSERT INTO room_activity (id, room_id, actor_user_id, kind, detail, created_at) VALUES
  ('rac_1','rm_lagos_vendors','usr_owner1','created','Room opened with a verified owner.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-290 days')),
  ('rac_2','rm_lagos_vendors','usr_consumer1','checkin','Ngozi Uche checked in with 6 saved contacts.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-21 days')),
  ('rac_3','rm_lagos_vendors','usr_owner2','request','Kunle Adeyemi asked to join.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('rac_4','rm_abuja_dispatch','usr_owner1','checkin','Checked in with 14 live rider slots.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('rac_5','rm_tailors','usr_owner2','remove','Removed a member for affiliate spam.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-12 days'));

-- -------------------------------------------------------- trust & safety ----

INSERT INTO reports (id, reporter_user_id, target_type, target_id, business_id, reason, detail, risk, status, resolution_note, created_at, updated_at) VALUES
  ('rep_1','usr_consumer2','business','biz_swiftfix','biz_swiftfix','impersonation','A WhatsApp account using their photos asked me for a prepayment deposit. The real shop says it is not them.','high','reviewing',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('rep_2','usr_consumer1','review','rev_4','biz_mamaope','spam','This looks like a competitor review, same text on two kitchens.','low','open',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days')),
  ('rep_3','usr_consumer2','room','rm_lagos_vendors',null,'other','New members are being DM''d a paid "boost" offer.','medium','open',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days')),
  ('rep_4','usr_consumer1','business','biz_crown','biz_crown','closed_or_wrong','Shop number is disconnected and the GRA address is a different business.','medium','actioned','Listing hidden until the owner re-verified the address.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-44 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-43 days'));

INSERT INTO moderation_items (id, item_type, target_id, business_id, reason, detail_json, risk, status, source, created_at, decided_at, decision_note) VALUES
  ('mod_1','review','rev_10','biz_swiftfix','One-star review mentioning payment fraud','{"flag":"impersonation","keyword":"fake tracking"}','high','pending','system',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),null,null),
  ('mod_2','listing','biz_autoplug','biz_autoplug','Unverified listing with a phone number but no reply in 14 days','{"unclaimed":true,"responseMinutes":null}','medium','pending','system',strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days'),null,null),
  ('mod_3','room','rm_ph_events','biz_crown','New room awaiting review','{"name":"Port Harcourt Events Crew","purpose":"business"}','medium','pending','automated',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),null,null),
  ('mod_4','listing','biz_crown','biz_crown','Admin actioned a report','{"report":"rep_4"}','high','removed','user_report',strftime('%Y-%m-%dT%H:%M:%SZ','now','-44 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-43 days'),'Hidden pending re-verification.'),
  ('mod_5','media','med_placeholder_1','biz_glow','AI flag on an uploaded image','{"model":"nsfw-v2","score":0.62}','low','approved','system',strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-30 days'),'Manual check: false positive, salon interior.');

INSERT INTO claims (id, business_id, claimant_user_id, role, note, status, review_note, submitted_at, decided_at) VALUES
  ('clm_1','biz_autoplug','usr_owner2','owner','I run this shop — here is my ID and a photo of the sign at Ring Road.','in_review',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 days'),null),
  ('clm_2','biz_swiftfix','usr_consumer2','manager','I am the WhatsApp line for SwiftFix, ask Chidi.','rejected','The owner already manages this listing and denied the request.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-40 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-38 days'));

INSERT INTO verification_requests (id, business_id, user_id, level_requested, note, status, review_note, submitted_at, decided_at) VALUES
  ('vrf_1','biz_mamaope','usr_owner1','documents','Kitchen permit and CAC certificate attached.','pending',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days'),null),
  ('vrf_2','biz_wellcare','usr_owner2','premium','Pharmacy board registration and the physican''s licence.','approved','Registered with the Pharmacy Council of Nigeria; premium badge granted.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-20 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-18 days')),
  ('vrf_3','biz_autoplug','usr_owner2','phone','Call me at the workshop between 9 and 5.','pending',null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days'),null);

UPDATE businesses SET verified_level = 'premium' WHERE id = 'biz_wellcare';

INSERT INTO tickets (id, code, user_id, business_id, subject, body, category, priority, status, created_at, updated_at, resolved_at) VALUES
  ('tkt_1','GH-1042','usr_owner2','biz_autoplug','I want to change my business name','The listing says "AutoPlug Mechanics" but we registered as "AutoPlug Auto Works Ltd".','account','medium','open',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days'),null),
  ('tkt_2','GH-1041','usr_owner1','biz_swiftfix','QR flyer reprint','Can you re-send the print-ready QR for the counter flyer? The old one is scuffed.','product','low','waiting',strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 days'),null),
  ('tkt_3','GH-1038','usr_consumer1',null,'Review I wrote is missing','I left a review for Adire Atelier two weeks ago and it is not on the profile.','safety','medium','resolved',strftime('%Y-%m-%dT%H:%M:%SZ','now','-15 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days'));

INSERT INTO ticket_messages (id, ticket_id, author_user_id, from_staff, body, created_at) VALUES
  ('tms_1','tkt_2','usr_admin',1,'Yes — we regenerated it with the same tracking code, so the stats below are preserved. Check your email for the print file.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-5 days')),
  ('tms_2','tkt_3','usr_admin',1,'It was held by the abuse filter because it mentioned a price. Approved now, and we have relaxed that rule.',strftime('%Y-%m-%dT%H:%M:%SZ','now','-14 days'));

-- ----------------------------------------------------------------- billing ----

INSERT INTO subscriptions (id, business_id, plan, status, billing_interval, current_period_start, current_period_end, provider, created_at, updated_at) VALUES
  ('sub_swiftfix','biz_swiftfix','pro','active','month',strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','+20 days'),'manual',strftime('%Y-%m-%dT%H:%M:%SZ','now','-290 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 days')),
  ('sub_mamaope','biz_mamaope','growth','active','month',strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','+26 days'),'manual',strftime('%Y-%m-%dT%H:%M:%SZ','now','-280 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days')),
  ('sub_keyhomes','biz_keyhomes','pro','past_due','month',strftime('%Y-%m-%dT%H:%M:%SZ','now','-33 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days'),'manual',strftime('%Y-%m-%dT%H:%M:%SZ','now','-230 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-3 days'));

INSERT INTO invoices (id, number, business_id, subscription_id, description, amount_minor, currency, status, period_start, period_end, issued_at, paid_at, created_at) VALUES
  ('inv_1','INV-20260909-SWIF','biz_swiftfix','sub_swiftfix','Pro plan — monthly',4500000,'NGN','paid',date('now','-10 days'),date('now','+20 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-10 days')),
  ('inv_2','INV-20260909-MAMA','biz_mamaope','sub_mamaope','Growth plan — monthly',2000000,'NGN','paid',date('now','-4 days'),date('now','+26 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days')),
  ('inv_3','INV-20260809-KEYH','biz_keyhomes','sub_keyhomes','Pro plan — monthly',4500000,'NGN','draft',date('now','-33 days'),date('now','-3 days'),strftime('%Y-%m-%dT%H:%M:%SZ','now','-33 days'),null,strftime('%Y-%m-%dT%H:%M:%SZ','now','-33 days'));

-- Daily rollups for the last 14 days so the analytics chart is real data, not a
-- decorative curve. Numbers are derived from the seeded events where possible.
WITH RECURSIVE days14(n) AS (SELECT 0 UNION ALL SELECT n + 1 FROM days14 WHERE n < 13)
INSERT INTO metrics_daily (business_id, day, views, enquiries, whatsapp_chats, leads, won_value_minor, signups, new_listings, updated_at)
SELECT b.id, date('now', '-' || d.n || ' days'),
       40 + ((abs(b.rowid * 31 + d.n * 17)) % 90),
       (SELECT COUNT(*) FROM enquiries e WHERE e.business_id = b.id AND date(e.created_at) = date('now', '-' || d.n || ' days')),
       (SELECT COUNT(*) FROM link_events le WHERE le.business_id = b.id AND le.kind = 'chat' AND le.day = date('now', '-' || d.n || ' days')),
       (SELECT COUNT(*) FROM leads l WHERE l.business_id = b.id AND date(l.created_at) = date('now', '-' || d.n || ' days')),
       (SELECT COALESCE(SUM(l.value_minor), 0) FROM leads l WHERE l.business_id = b.id AND l.stage = 'won' AND date(l.won_at) = date('now', '-' || d.n || ' days')),
       0, 0, strftime('%Y-%m-%dT%H:%M:%SZ','now')
  FROM businesses b, days14 d;

INSERT INTO notifications (id, user_id, business_id, type, title, body, href, created_at) VALUES
  ('ntf_1','usr_owner1','biz_swiftfix','new_enquiry','New enquiry from Bola Aluko','"iPhone 13 screen is cracked, touch still works. What is the price and how long?"','/app/inbox',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('ntf_2','usr_owner1','biz_mamaope','new_enquiry','New enquiry for a party of 60','Funke Ade wants jollof and small chops delivered to Ikoyi by 1pm Saturday.','/app/inbox',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('ntf_3','usr_owner1','biz_mamaope','lead_stale','LD-1004 has had no activity for a day','Unassigned enquiry for 60 guests — reply while the event date is still open.','/app/leads',strftime('%Y-%m-%dT%H:%M:%SZ','now','-1 days')),
  ('ntf_4','usr_owner2','biz_autoplug','claim_decision','Update on your listing claim','We are checking your documents. Nothing more is needed from you right now.','/app/leads',strftime('%Y-%m-%dT%H:%M:%SZ','now','-4 days')),
  ('ntf_5','usr_admin',null,'moderation_action','3 items in the queue','A fraud-flagged review, an unverified listing with no reply, and a new room.','/admin/moderation',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 hours'));

INSERT INTO audit_logs (id, business_id, actor_user_id, actor_label, actor_kind, action, resource_type, resource_id, metadata_json, created_at) VALUES
  ('aud_1','biz_swiftfix','usr_staff1','Amina Bello','user','enquiry.reply','enquiry','enq_1','{"characters":78}',strftime('%Y-%m-%dT%H:%M:%SZ','now','-2 days')),
  ('aud_2','biz_swiftfix','usr_owner1','Chidi Okonkwo','user','lead.stage','lead','led_3','{"from":"follow_up","to":"won"}',strftime('%Y-%m-%dT%H:%M:%SZ','now','-6 days')),
  ('aud_3','biz_mamaope','usr_owner1','Chidi Okonkwo','user','link.create','link','lnk_mamaope','{"code":"MO3XRT"}',strftime('%Y-%m-%dT%H:%M:%SZ','now','-60 days')),
  ('aud_4','biz_crown','usr_admin','Ada (GainHub staff)','admin','business.hide','business','biz_crown','{"reason":"report rep_4"}',strftime('%Y-%m-%dT%H:%M:%SZ','now','-43 days'));

-- Demo logins (password for all: Gainhub123!)
--   ada@gainhub.dev      → admin console
--   hello@lumea.ng       → SwiftFix / Mama Ope / Adire / Glow / KeyHomes / Rapid / Crown
--   kunle@autoplug.ng    → AutoPlug / WellCare / BrightPath (draft) / Okoro / FixIt

-- Denormalised counters that the API maintains on the write path. A seed inserts
-- rows directly, so the same definitions are applied here — otherwise the demo would
-- show zero saves/enquiries next to real review counts, which is exactly the kind of
-- inconsistency this project is meant to remove.
UPDATE businesses SET
  saved_count = (SELECT COUNT(*) FROM saves s WHERE s.business_id = businesses.id),
  enquiry_count = (SELECT COUNT(*) FROM enquiries e WHERE e.business_id = businesses.id);
UPDATE rooms SET avg_save_back = COALESCE((
  SELECT ROUND(AVG(save_back_score * 1.0)) FROM room_members m
   WHERE m.room_id = rooms.id AND m.status = 'active'), 0);
