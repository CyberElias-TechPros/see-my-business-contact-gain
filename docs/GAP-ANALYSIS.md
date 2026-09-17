# GainHub NG — gap analysis (pre-reconstruction)

Repo state at audit: `typecheck`, `lint`, `vitest`, `test:integration` (54 HTTP checks)
and the same-origin proxy all pass. The product is _architecturally_ sound and unusually
well documented. The gaps below are **product-completeness** gaps, not build failures.

---

## Resolution status (post-reconstruction)

This section records what was actually built. Each row links the gap to the change that
closed it. Anything not marked **Done** is still open — nothing here is claimed as
finished without a passing check behind it.

| #   | Gap                                    | Status             | Resolution                                                                                                                                                                                                                                                                                                                                                           |
| --- | -------------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Public reviews unreadable              | **Done**           | `GET /v1/businesses/:id/reviews` returns published reviews, a rating distribution and the aggregate. The profile page renders them with a per-star histogram; `GET /v1/businesses/:id/related` adds internal linking from the same data.                                                                                                                             |
| C2  | Contact-gain analytics missing         | **Done**           | `GET /v1/workspace/insights` returns totals, per-channel split, per-day series, per-business roll-up and recent contacts. Surfaced on `/app/businesses` and `/app/businesses/$id`.                                                                                                                                                                                   |
| C3  | "Open now" is frozen                   | **Done**           | Migration `0005` adds `business_hours`. Open state is derived per request in Africa/Lagos (`lagosNow`/`timeToMinutes`/`isOpenAt`), so the `openNow` filter is computed from real hours rather than a stored boolean.                                                                                                                                                 |
| C4  | Home / categories / locations are mock | **Done**           | `@/data/mock` deleted. Every public page now loads through `src/lib/directory.server.ts` + `src/lib/directory.functions.ts`, which return an explicit `available` flag instead of throwing into the router.                                                                                                                                                          |
| C5  | No password reset                      | **Done**           | `password_resets` table; `POST /v1/auth/forgot-password`, `GET /v1/auth/reset-password/:token`, `POST /v1/auth/reset-password`. Single-use, expires, revokes all sessions, and answers identically for unknown identities so it cannot be used for enumeration. Non-email by design (outbox + dev link), consistent with the documented no-automated-email boundary. |
| C6  | No notifications                       | **Done**           | `notifications` table + `GET /v1/notifications` and `POST /v1/notifications/read`. Emitted on approval, rejection, claim decision, enquiry, review moderation and password reset. Shown as a header bell and a full panel on `/account`.                                                                                                                             |
| C7  | Owners cannot edit a listing           | **Done**           | `GET`/`PATCH /v1/workspace/businesses/:id` (hours, services, amenities, service areas, socials, profile fields) plus `PATCH /v1/workspace/enquiries/:id` for status. UI in `/app/businesses/$id` with per-section saving and optimistic status changes that roll back on failure.                                                                                    |
| C8  | Live profiles thinner than previews    | **Done**           | `PublicBusiness` now carries hours, amenities, service areas, socials, price range, year established and team size. No photography pipeline exists, so each listing gets a deterministic generative cover derived from its id.                                                                                                                                       |
| C9  | No account settings                    | **Done**           | `PATCH /v1/me` for name/email/phone, `POST /v1/auth/change-password`, and a notification centre. All wired into `/account`.                                                                                                                                                                                                                                          |
| H1  | No search autocomplete                 | **Done**           | `GET /v1/suggest` (businesses, categories, locations, services) with a keyboard-navigable combobox on `/search`.                                                                                                                                                                                                                                                     |
| H2  | No related businesses                  | **Done**           | `GET /v1/businesses/:id/related`; rendered on every profile.                                                                                                                                                                                                                                                                                                         |
| H3  | Sitemap built from mock                | **Done**           | `sitemap[.]xml.ts` uses the live taxonomy and the Worker's `/v1/sitemap` feed, degrading to static URLs on an API incident rather than failing.                                                                                                                                                                                                                      |
| H4  | Fabricated seed aggregates             | **Done**           | `seed.local.sql` inserts real review rows; ratings are derived by a trailing `UPDATE`, never hand-written.                                                                                                                                                                                                                                                           |
| H5  | No "my circles"/leave a circle         | **Open**           | `GET /v1/workspace/rooms` exists, but there is no leave action and no owner-facing circle management screen.                                                                                                                                                                                                                                                         |
| H6  | Reviews are write-only                 | **Partially done** | The duplicate case now returns an explicit message, but reviews still cannot be edited after submission.                                                                                                                                                                                                                                                             |
| H7  | Compare has no discovery picker        | **Open**           | `/compare` still takes ids only; it does not offer a picker fed by live search results.                                                                                                                                                                                                                                                                              |

### Verification behind the status column

| Check                             | Result                         |
| --------------------------------- | ------------------------------ |
| `npx tsc --noEmit` (app + worker) | clean                          |
| `npx eslint .`                    | 0 errors                       |
| `npm test` (vitest)               | 11 passed                      |
| `npm run test:integration`        | **78** HTTP checks (was 54)    |
| `npm run test:frontend`           | **39** HTTP checks             |
| Route render sweep (30 routes)    | 200, `/nonexistent-page` → 404 |

`test:integration` and `test:frontend` now reset → migrate → seed D1 first, so both are
deterministic from a clean state.

### Deliberately not built

These stay out of scope because the README defines them as boundaries, not oversights:
payments, ads and sponsored ranking; automated email/SMS delivery and verification;
automatic data-request fulfilment; self-service verification upgrades and ownership
transfers. Where a boundary limits the UI (password reset, for example) the interface
says so rather than implying an email arrived.

### Not visually verified

There is no headless browser in this environment, so the cinematic/immersive quality of
the result was reviewed by code inspection and server-rendered HTML only — not by
screenshot. Motion is gated behind `prefers-reduced-motion`, and every animated element
renders its end state without JavaScript.

---

## Critical — core value is broken or absent

| #   | Gap                                                                                                                                                                                                     | Evidence                                                                                                      | Impact                                                                                                         |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| C1  | **Public reviews are never readable.** `POST /v1/reviews` + moderation exist and recalculate `rating_average`/`review_count`, but there is no read endpoint and the profile page renders no reviews.    | `worker/index.ts:879` insert, `:1588` moderation; no `GET` reviews route; `business.$id.tsx:403` is form-only | Profiles advertise "4.8 (24 reviews)" with zero reviews to read. Trust-breaking for a review-driven directory. |
| C2  | **Contact-gain analytics missing.** The product is named _contact gain_. `contact_events` records whatsapp/phone/website/directions clicks, but `workspaceSummary` returns only businesses + enquiries. | `worker/index.ts:1359` writes events, `:1406` summary ignores them                                            | The owner's single core metric is collected and then thrown away.                                              |
| C3  | **"Open now" is a frozen boolean.** `businesses.is_open_now` is set at publish time and never recomputed; no opening-hours table exists.                                                                | migration `0001`, `businesses.is_open_now`; no `hours` anywhere in `worker/`                                  | The `openNow` search filter is factually wrong.                                                                |
| C4  | **Home / categories / locations pages are hardcoded mock, not API-backed.**                                                                                                                             | `src/routes/index.tsx`, `categories.tsx`, `locations*.tsx` import `@/data/mock`                               | Publish a real business and the homepage does not change. Frontend is not seamlessly connected to the backend. |
| C5  | **No password reset / account recovery.** No reset tokens, no recovery route.                                                                                                                           | no `password_resets` table; README lists it as a "deliberate boundary"                                        | A forgotten password is a permanent lockout — not a happy path.                                                |
| C6  | **No notifications of any kind.** Owners are never told about enquiries; users are never told their listing was approved, their claim decided, their room application accepted.                         | no `notifications` table                                                                                      | Every asynchronous workflow dead-ends silently.                                                                |
| C7  | **Owners cannot edit a listing after approval.** No update path for tagline, about, contacts, hours, services.                                                                                          | no `PATCH` on businesses                                                                                      | Owners are stuck with whatever they typed in the application.                                                  |
| C8  | **Live profiles are thinner than the fictional previews.** Mock `Business` has hours, amenities, service areas, socials, products, team; `PublicBusiness` has none of them.                             | `src/data/mock.ts` vs `src/lib/contracts.ts:PublicBusiness`                                                   | The "demo" profiles look better than real ones.                                                                |
| C9  | **No account settings.** No change-password, no profile edit, no session visibility.                                                                                                                    | `account.tsx` shows name + saved list + sign out only                                                         | Users cannot maintain their own account.                                                                       |

## High

| #   | Gap                                                                                                                                                   | Evidence                                 |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| H1  | No search autocomplete / suggestions. `search.tsx` is filter-only.                                                                                    |                                          |
| H2  | No related/"more like this" businesses → weak internal linking, orphan profiles.                                                                      |                                          |
| H3  | `sitemap.xml` builds category/location URLs from `mock`, not the live taxonomy.                                                                       | `sitemap[.]xml.ts` imports `@/data/mock` |
| H4  | Seed businesses advertise `rating_average` 4.8/4.6/4.9 with `review_count` 24/18/31 but the DB contains **zero** review rows — fabricated aggregates. | `worker/seed.local.sql`                  |
| H5  | No "my contact circles" view; no way to leave a circle.                                                                                               | `contact-gain.*`                         |
| H6  | Reviews are write-only: no edit, and duplicates are rejected with an opaque error.                                                                    | `UNIQUE (business_id, author_user_id)`   |
| H7  | Compare page only compares live businesses by id; no discovery picker from live results.                                                              | `compare.tsx`                            |

## Design (as briefed)

Current state: competent Tailwind v4 + OKLCH token system, a few bespoke SVG/keyframe
moments (`SignalMap`, ticker, network stage). It reads as "well-built product site", not
"world-class creative-agency digital experience". Missing: scroll-choreographed reveals,
page transitions, pointer-responsive interaction, generative art direction per listing,
cinematic hero depth, custom cursor, real micro-interaction system, motion tokens.
