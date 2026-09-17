# GainHub NG — gap analysis (pre-reconstruction)

Repo state at audit: `typecheck`, `lint`, `vitest`, `test:integration` (54 HTTP checks)
and the same-origin proxy all pass. The product is _architecturally_ sound and unusually
well documented. The gaps below are **product-completeness** gaps, not build failures.

---

## Resolution status (post-reconstruction)

This section records what was actually built. Each row links the gap to the change that
closed it. Anything not marked **Done** is still open — nothing here is claimed as
finished without a passing check behind it.

| #   | Gap                                    | Status   | Resolution                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| --- | -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | Public reviews unreadable              | **Done** | `GET /v1/businesses/:id/reviews` returns published reviews, a rating distribution and the aggregate. The profile page renders them with a per-star histogram; `GET /v1/businesses/:id/related` adds internal linking from the same data.                                                                                                                                                                                                                                                                                  |
| C2  | Contact-gain analytics missing         | **Done** | `GET /v1/workspace/insights` returns totals, per-channel split, per-day series, per-business roll-up and recent contacts. Surfaced on `/app/businesses` and `/app/businesses/$id`.                                                                                                                                                                                                                                                                                                                                        |
| C3  | "Open now" is frozen                   | **Done** | Migration `0005` adds `business_hours`. Open state is derived per request in Africa/Lagos (`lagosNow`/`timeToMinutes`/`isOpenAt`), so the `openNow` filter is computed from real hours rather than a stored boolean.                                                                                                                                                                                                                                                                                                      |
| C4  | Home / categories / locations are mock | **Done** | `@/data/mock` deleted. Every public page now loads through `src/lib/directory.server.ts` + `src/lib/directory.functions.ts`, which return an explicit `available` flag instead of throwing into the router.                                                                                                                                                                                                                                                                                                               |
| C5  | No password reset                      | **Done** | `password_resets` table; `POST /v1/auth/forgot-password`, `GET /v1/auth/reset-password/:token`, `POST /v1/auth/reset-password`. Single-use, expires, revokes all sessions, and answers identically for unknown identities so it cannot be used for enumeration. Non-email by design (outbox + dev link), consistent with the documented no-automated-email boundary.                                                                                                                                                      |
| C6  | No notifications                       | **Done** | `notifications` table + `GET /v1/notifications` and `POST /v1/notifications/read`. Emitted on approval, rejection, claim decision, enquiry, review moderation and password reset. Shown as a header bell and a full panel on `/account`.                                                                                                                                                                                                                                                                                  |
| C7  | Owners cannot edit a listing           | **Done** | `GET`/`PATCH /v1/workspace/businesses/:id` (hours, services, amenities, service areas, socials, profile fields) plus `PATCH /v1/workspace/enquiries/:id` for status. UI in `/app/businesses/$id` with per-section saving and optimistic status changes that roll back on failure.                                                                                                                                                                                                                                         |
| C8  | Live profiles thinner than previews    | **Done** | `PublicBusiness` now carries hours, amenities, service areas, socials, price range, year established and team size. No photography pipeline exists, so each listing gets a deterministic generative cover derived from its id.                                                                                                                                                                                                                                                                                            |
| C9  | No account settings                    | **Done** | `PATCH /v1/me` for name/email/phone, `POST /v1/auth/change-password`, and a notification centre. All wired into `/account`.                                                                                                                                                                                                                                                                                                                                                                                               |
| H1  | No search autocomplete                 | **Done** | `GET /v1/suggest` (businesses, categories, locations, services) with a keyboard-navigable combobox on `/search`.                                                                                                                                                                                                                                                                                                                                                                                                          |
| H2  | No related businesses                  | **Done** | `GET /v1/businesses/:id/related`; rendered on every profile.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| H3  | Sitemap built from mock                | **Done** | `sitemap[.]xml.ts` uses the live taxonomy and the Worker's `/v1/sitemap` feed, degrading to static URLs on an API incident rather than failing.                                                                                                                                                                                                                                                                                                                                                                           |
| H4  | Fabricated seed aggregates             | **Done** | `seed.local.sql` inserts real review rows; ratings are derived by a trailing `UPDATE`, never hand-written.                                                                                                                                                                                                                                                                                                                                                                                                                |
| H5  | No "my circles"/leave a circle         | **Done** | `POST /v1/rooms/:id/leave` releases every approved row the caller holds (multi-business safe), notifies the owner and keeps the history. `GET /v1/workspace/rooms` now returns a `queue` of join requests, and `POST /v1/workspace/rooms/:roomId/applications/:applicationId` lets the **owner** admit or decline — previously only a platform admin could, which made every circle unmanageable. New `/app/circles` screen covers circles you run, requests waiting on you, circles you are in, and closed applications. |
| H6  | Reviews are write-only                 | **Done** | `PATCH /v1/reviews/:id` + `reviewUpdateSchema` + migration `0006_review_editing.sql` (`edited_at`). `GET /v1/businesses/:id/reviews` returns `mine` — the reader's own review in any moderation state — so "not reviewed yet" is distinguishable from "still pending". Editing a **published** review re-queues it and rewinds the aggregate, which the UI warns about before submitting; `disputed` reviews are locked.                                                                                                  |
| H7  | Compare has no discovery picker        | **Done** | The old control was a bare `?q=` form needing a full page reload, and it only worked if you already knew the name to type. `/compare` now has a debounced, keyboard-navigable combobox fed by the live directory (`role="combobox"`, arrow keys, Enter to add, Escape to close), removable chips for the current selection, and a "Highest rated right now" rail so discovery does not depend on knowing a name. The field stays a real `GET` form, so it still works with JavaScript off.                                |

### Verification behind the status column

| Check                             | Result                         |
| --------------------------------- | ------------------------------ |
| `npx tsc --noEmit` (app + worker) | clean                          |
| `npx eslint .`                    | 0 errors                       |
| `npm test` (vitest)               | 11 passed                      |
| `npm run test:integration`        | **98** HTTP checks (was 78)    |
| `npm run test:frontend`           | **41** HTTP checks (was 39)    |
| Route render sweep (30 routes)    | 200, `/nonexistent-page` → 404 |

`test:integration` and `test:frontend` now reset → migrate → seed D1 first, so both are
deterministic from a clean state.

### Fixed while closing the gaps

Two things were not listed as gaps but were wrong, and closing H5/H6 exposed them:

- **Rate limits were IP-only.** Every write bucket was keyed on a hash of the source
  address. For an audience that is mostly on mobile carrier NAT that means one person
  writing reviews drains the budget of every other subscriber behind the same address,
  and there is nothing they can do about it. Signed-in writes (review, review-edit,
  claim, room-proposal, room-application, data-request) now bucket on the user id —
  harder to evade by rotating IPs, impossible to collide with a stranger. Anonymous
  endpoints keep the IP bucket because that is the only handle we have on the caller.
  Editing also got its own `review-edit` bucket (10/hour) rather than sharing the 5/hour
  write budget, since an edit only ever touches one row the caller already owns.
- **A room application could never be re-opened by a non-admin.** The UNIQUE constraint
  on `(room_id, business_id)` was being answered with a dead 409, so leaving a circle
  was permanent. `applyToRoom` now reopens a row in a terminal state (`left`,
  `rejected`, `removed`) and audits the reopen.

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

| #   | Gap                                                                                                                                                                                               | Evidence                                 |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| H1  | No search autocomplete / suggestions. `search.tsx` is filter-only.                                                                                                                                |                                          |
| H2  | No related/"more like this" businesses → weak internal linking, orphan profiles.                                                                                                                  |                                          |
| H3  | `sitemap.xml` builds category/location URLs from `mock`, not the live taxonomy.                                                                                                                   | `sitemap[.]xml.ts` imports `@/data/mock` |
| H4  | Seed businesses advertise `rating_average` 4.8/4.6/4.9 with `review_count` 24/18/31 but the DB contains **zero** review rows — fabricated aggregates.                                             | `worker/seed.local.sql`                  |
| H5  | ~~No "my contact circles" view; no way to leave a circle.~~ — closed by `/app/circles`, `POST /v1/rooms/:id/leave` and owner-side `POST /v1/workspace/rooms/:roomId/applications/:applicationId`. | `contact-gain.*`                         |
| H6  | ~~Reviews are write-only: no edit, and duplicates are rejected with an opaque error.~~ — closed by `PATCH /v1/reviews/:id` and the `mine` field on the reviews read.                              | `UNIQUE (business_id, author_user_id)`   |
| H7  | ~~Compare page only compares live businesses by id; no discovery picker from live results.~~ — closed by the live combobox, the selection chips and the top-rated discovery rail.                 | `compare.tsx`                            |

## Design (as briefed)

Current state: competent Tailwind v4 + OKLCH token system, a few bespoke SVG/keyframe
moments (`SignalMap`, ticker, network stage). It reads as "well-built product site", not
"world-class creative-agency digital experience". Missing: scroll-choreographed reveals,
page transitions, pointer-responsive interaction, generative art direction per listing,
cinematic hero depth, custom cursor, real micro-interaction system, motion tokens.
