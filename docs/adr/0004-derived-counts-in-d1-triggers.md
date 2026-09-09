# Derived counts are maintained by D1 triggers, never by application code

**Status:** accepted (2026-09-09)

## Context

The UI shows `rating_avg`, `rating_count`, `contacts_gained`, `saved_count`, `enquiry_count`,
`view_count`, room `member_count` / `avg_save_back`, and a search haystack per listing. Every one
of them is a function of other rows.

The prototype computed them in the client from mock arrays, which is free — and impossible to keep
honest once the same numbers are written by five endpoints, a moderation queue, a cron retention
job and a seed script. In `INSERT INTO reviews … ; UPDATE businesses SET rating_avg = …` form, any
path that forgets the second statement — or fails between them, because D1 has no transactions —
leaves a listing whose stars disagree with its reviews. For a product whose entire pitch is
"verified, trustworthy traders", a wrong average is a trust defect, not a rounding error.

## Decision

Compute the derived values in the database, in triggers attached to the rows that change them:

| Trigger                                                           | Effect                                                                                |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `reviews_recalc_after_insert` / `_after_update` / `_after_delete` | recompute `businesses.rating_avg`, `rating_count` from `status = 'published'` reviews |
| `leads_contacts_gained_after_insert` / `_after_delete`            | `businesses.contacts_gained` from distinct non-lost leads                             |
| `room_members_recount_after_insert` / `_after_update`             | `rooms.member_count` from `status = 'active'` memberships                             |
| `room_members_score_after_update`                                 | `rooms.avg_save_back` from members' scores                                            |
| `businesses_search_after_insert` / `_after_update`                | rebuild `business_search_index.search_text`                                           |

`business_search_index.business_id` is `ON DELETE CASCADE`, so the haystack needs no delete
trigger. Application code **reads** these columns and never writes them; `UPDATE businesses SET
rating_avg = …` is banned by convention and by the review tests in `worker/test/api.test.ts`,
which assert the average after raw SQL inserts (a test that would fail the moment the trigger is
removed or an application write starts fighting it).

Only `view_count` is not trigger-maintained: it is incremented in KV and flushed by cron, because
one D1 write per page view is the wrong tool for that volume
([0001](0001-one-worker-no-durable-objects.md)).

## Consequences

- **Gained:** the numbers cannot drift, whatever writes the table — including a hand-run
  `wrangler d1 execute`, a future import script, or a bug in a handler nobody reviewed. Seed
  data gets correct aggregates for free (the seed inserts rows and lets the triggers do the math,
  which is how we noticed the seed needed no aggregate statements at all).
- **Cost:** trigger bodies are invisible to `tsc` and to the frontend; a mistake shows up only at
  runtime. Mitigated by `npm run check:sql`, which builds a real SQLite database from
  `worker/migrations/*.sql`, executes `dev/seed.sql` end to end, and prepares every statement in
  `worker/src/**` against that schema — so a trigger referencing a renamed column fails the check
  rather than the listing page.
- **Cost:** recalculation is a `SELECT … FROM reviews WHERE business_id = ?` per review write.
  Bounded by one review per author per business, and trivially fast at this scale.
- **Rollback:** triggers live in migration files; dropping one is a new migration, and the
  columns they write can be rebuilt from source rows at any time by re-running the same aggregate
  (the recalculation is a full recompute per business, not an increment — deliberately, so
  `UPDATE businesses SET rating_avg = (SELECT …)` is always a valid repair).
