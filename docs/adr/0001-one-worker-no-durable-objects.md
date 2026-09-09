# One Worker, no Durable Objects

**Status:** accepted (2026-09-09)

## Context

The prototype was a Lovable-generated frontend with `src/data/mock.ts` as its only "data
layer". Reconstructing it as a real product needs persistence, background work and scheduled
jobs on Cloudflare. The reflexive Workers answer is a Durable Object per aggregate (one per
business, one per room), which buys local transactions and in-memory state.

What the product actually does:

- Reads are list-shaped and cacheable: directory search, one listing, an owner's lead table.
- Writes are small and rare per tenant: a profile field, a review, a stage move, a check-in.
- The only thing that looks "live" is a contact-gain room, and its live behaviour is a queue of
  join requests plus a member list — no presence, no chat, no sub-second updates.
- Counters that many products put in a DO (rating average, contacts gained, room member count)
  are per-business aggregates that a browser can tolerate being one trigger-beat old, because
  they are written by the same transaction that changes them.

## Decision

One stateless Worker (`gainhub-api`) over D1 (relational truth), KV (cache, flags, config, rate
limits, view counters), R2 (media bytes), one Queue (notifications/email) and two crons. No
Durable Objects. Concurrency-sensitive operations are made safe with the primitives the platform
already gives us:

- Derived counts are computed by D1 triggers on the rows that change them (see
  `0004-derived-counts-in-d1-triggers.md`), so there is no counter to keep in sync.
- Idempotency is a client key plus a `UNIQUE` index (`enquiries.idempotency_key`), not a lock.
- Rate limits are fixed-window KV keys bucketed per window
  (`rl:<name>:<identity>:<window-index>`), which respects KV's one-write-per-key-per-second rule
  without needing an object to serialise increments.
- Room check-in scoring is an `UPDATE … WHERE id = ? AND …` conditional write; a lost race
  returns the current state rather than double-counting.
- View counting is fire-and-forget into a KV key per listing, flushed by cron into
  `businesses.view_count` — the one place a DO would have been defensible, and the flush design
  exists precisely to avoid it.

## Consequences

- **Gained:** no object lifecycle to reason about, no migration of DO state, no cold-start
  latency for the second request to a cold room, no per-DO storage limits, and the whole API is
  testable with one `env` in a test worker. Every handler is a pure function of
  `(request, bindings)`, which is what makes `worker/test/api.test.ts` possible.
- **Cost:** no cross-request in-memory cache and no strongly consistent counters — two requests
  racing on the same aggregate are serialised by D1, not by us. If a feature later needs real
  presence (typing, live seat maps), that feature gets a DO; it should not be retrofitted into
  the directory.
- **Risk:** D1 write contention on a single hot listing. Mitigated by the KV read cache
  (`public, max-age=30, s-maxage=120` for directory reads) and by the fact that writes to one
  listing come from one owner.

## Alternatives considered

- **DO per business (ledger of writes)** — rejected: it duplicates D1 as the source of truth and
  creates a second consistency domain (DO storage vs D1) with no reconciler.
- **Queues for the view counter only, no KV** — rejected: a queue message per page view is 10–100×
  the write volume of one KV key per listing per flush, and the value would still need dedupe.
- **Workers with D1 + a separate Postgres/Supabase** — rejected: two databases, two migration
  systems and a network hop in front of every read, for a product whose data fits one SQLite file.
