# Working on GainHub locally

Everything here runs on your machine: the API in `wrangler dev` against local D1/KV/R2 files, the
frontend on Vite, and three independent test layers. No Cloudflare account, no Vercel account and
no network access are required for any of it.

## Setup

```sh
node --version          # >= 22 (node:sqlite is used by scripts/check-sql.mjs)
bun install             # what CI and Vercel use — updates the committed bun.lock
npm i --no-audit --no-fund --legacy-peer-deps   # fine for local work, see the note below
cp worker/.dev.vars.example worker/.dev.vars
```

Either installer works for development. **`bun.lock` is the only committed lockfile**: Vercel
installs it with `bun install --frozen-lockfile`, and `bunfig.toml` adds a 24-hour
supply-chain guard (`minimumReleaseAge`) with explicit exclusions for the `@lovable.dev/*`
packages. So after changing `package.json`, run `bun install` and commit the lockfile —
`npm run check:lock` fails the rest of us out of that mistake. Other lockfiles
(`package-lock.json`, `yarn.lock`, `pnpm-lock.yaml`) are gitignored on purpose: a second lock
would make the package manager Vercel picks ambiguous, which is how the first Vercel build broke.

When the dev server is reachable through a preview URL, a tunnel or any host name that is not
`localhost`, start it with `VITE_ALLOWED_HOSTS` — Vite 8 answers `403 Blocked request` for hosts
it does not recognise, and the app looks dead rather than misconfigured:

```sh
VITE_ALLOWED_HOSTS=.e2b.app npx vite --host 0.0.0.0 --port 3000   # subdomains of e2b.app
VITE_ALLOWED_HOSTS=all npm run dev                                # throwaway sandbox only
```

`--host 0.0.0.0` binds the interface; `VITE_ALLOWED_HOSTS` decides which `Host` headers are
served. Leave both unset on a laptop: the host check is a DNS-rebinding protection, not decoration.

`--legacy-peer-deps` is needed because the shadcn/Radix tree and `@lovable.dev/vite-tanstack-config`
disagree with npm's strict peer resolution; it is what npm users need, so do not "clean it up".
Without it `npm i` fails on peer conflicts and people reach for `--force`, which resolves them
differently than bun does.

## The loop

```sh
npm run worker:dev   # http://localhost:8787  (persisted in worker/.wrangler/state)
npm run dev          # http://localhost:5173  (proxies /api/v1, /media, /go)
```

Both commands are long-running; start the API first. `worker:dev` writes local D1/KV/R2 state
under `worker/.wrangler/state`, so data survives a restart — which is also why it must be wiped
when a run leaves half-finished state behind (see "Resetting" below).

First run needs a database:

```sh
npm run db:migrate:local
npm run db:seed:local      # optional, but the UI is empty without it
```

`db:migrate:local` applies `worker/migrations/*.sql` in filename order and records the tags in
D1's `d1_migrations` table. `dev/seed.sql` is idempotent (it deletes its own rows first), so
re-running it is always safe. Passwords in the seed are `Gainhub123!`.

Seeded identities worth knowing:

| Account                                                      | Role                               | Why it matters                                                                                           |
| ------------------------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `ada@gainhub.dev`                                            | admin                              | moderation queue, flags, config, audit log                                                               |
| `hello@lumea.ng`                                             | owner of `biz_swiftfix` (pro plan) | premium workspace: links, automations, team, billing, QR code `SF7KQ2`                                   |
| `kunle@autoplug.ng`                                          | owner of `biz_autoplug`            | the second membership used to prove authorisation                                                        |
| `amina@swiftfix.ng`                                          | staff on `biz_swiftfix`            | the "role is not owner" case: no billing, no team writes                                                 |
| `ngozi@example.com`, `tunde@example.com`, `seun@example.com` | consumers                          | reviews, reports, room joins, enquiries                                                                  |
| `biz_crown`                                                  | listing                            | deliberately `hidden`, with moderation item `mod_4` — the "what does a hidden listing look like" fixture |
| `rev_10`                                                     | review                             | deliberately `pending` (`mod_1`) — the moderation-queue fixture                                          |

`GET /api/v1/health` is the fastest way to confirm bindings and schema; it runs a real `SELECT 1`.

## The three test layers

| Layer              | Command             | Runs against                                                                            | Use it for                                                                    |
| ------------------ | ------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Domain + HTTP unit | `npm test`          | workerd (vitest + `@cloudflare/vitest-plugin`), D1/KV/R2 built from the real migrations | rules, authorisation, triggers, limits — fast, isolated, no dev server needed |
| Contract smoke     | `npm run smoke`     | a **running** API                                                                       | the product journey end to end, against whatever is deployed                  |
| Static SQL         | `npm run check:sql` | an in-memory SQLite built from the migrations                                           | a typo or arity mistake in any SQL literal                                    |

```sh
npm run test            # 47 tests, ~6s
npm run smoke           # needs worker:dev; 139 checks
SMOKE_BASE_URL=https://staging-api.example.com npm run smoke
SMOKE_RATE_LIMIT=1 npm run smoke   # additionally proves the abuse limits fire
npm run check:sql
npm run check:sql -- --verbose      # what was skipped and why
npm run check:lock                  # bun.lock matches package.json (see below)
npm run format:check                # prettier over every shipped file
```

`npm run verify` = lint + `format:check` + typecheck (frontend **and** Worker) + `check:sql` +
`check:lock` + tests + build — i.e. everything that must be true before a push, in one command.

`check:lock` exists because Vercel installs with `bun install --frozen-lockfile` (there is no
`installCommand` in `vercel.json`, and Bun wins the package-manager election because `bun.lock` is
committed). A dependency added to `package.json` without regenerating the lock therefore builds
locally and fails the deploy's install step — which is exactly what happened once. Regenerate with
the bun version Vercel pins (1.2.x today) and re-run `bun install --frozen-lockfile` yourself
before pushing:

```sh
bun install && bun install --frozen-lockfile   # second command must print "no changes"
```

Two rules that make the suites worth having:

- **Never weaken an assertion to make it pass.** Both suites encode behaviour the product must
  keep (409 on a duplicate review, 403 for a non-member, 429 after four sign-ups). When one
  fails, the interesting question is "which is wrong: the code or the expectation?" — and the
  answer has to be written in the commit message.
- **A check that silently disappears is a check that never existed.** Both suites print counts; if
  the number goes down between runs, either a precondition stopped being met (usually stale
  state — reset it) or a section became conditional. The smoke suite builds its own fixtures for
  exactly this reason.

## Conventions this codebase follows

- **SQL lives in handlers as template strings**, and every statement goes through
  `worker/src/db-access.ts` (`DB.all/first/count/run/scalar/write/quiet`). That module is the
  only place D1 is touched, which is what makes `check:sql` feasible.
- **Derived columns are never written by hand**
  ([ADR 0004](adr/0004-derived-counts-in-d1-triggers.md)). If a handler needs
  `rating_avg` to change, it changes a review.
- **Every input is zod-validated in `shared/api.ts`**, the same schema the frontend imports. A
  new field on a form is a schema change first and a component change second.
- **Authorisation is server-side, always**: `requireUser`, `requireAdmin`, `requireAccess(c, ref,
permission)`. A handler that mutates tenant data without one of those three is a bug report,
  not a style nit (this is how the review-reply IDOR was found).
- **`shared/` is imported by both sides** and must not import from `worker/` or `src/`.
- **Comments explain why**, and name the failure they prevent. If you delete a guard, delete its
  comment too — a comment describing code that no longer exists is worse than none.
- Migrations are append-only, additive, and every one is listed under `migrations` in
  `wrangler.jsonc` (`check:deploy` verifies the list covers the directory).

## Resetting local state

A crashed run, a poisoned rate-limit bucket or a half-applied migration is normally fixed by a
reset rather than by adjusting a test:

```sh
npm run db:reset:local     # deletes local D1 state, re-applies migrations, re-seeds
```

**Stop `npm run worker:dev` first, or restart it afterwards.** The reset deletes the SQLite files
under `worker/.wrangler/state` while the running worker still has them open; every request then
fails with `SQLITE_CANTOPEN` / `no such table: businesses` until the process reopens the
directory. That looks exactly like a broken migration, and it is not one.

Rate-limit counters live in local KV, not D1. To clear only those:

```sh
cd worker
npx wrangler kv key list --binding KV --local | tr -d '"' | grep '^rl:' | while read -r k; do
  npx wrangler kv key delete --binding KV --local "$k"; done
```

(`rl:*` buckets expire on their own — an hour for registration, five minutes for login — so this
is only worth doing when you want to re-run immediately.)

## Editing the schema

1. Add `worker/migrations/000N_name.sql`. One statement per block, separated by
   `--> statement-breakpoint` — the test suite and `wrangler d1 migrations apply` both split on it,
   and trigger bodies contain semicolons that must not be split.
2. If a column is `NOT NULL`, give it a `DEFAULT` or backfill it in the same migration: existing
   rows are the reason a "small" change usually fails at 3am.
3. Put any CHECK constraint you intend to rely on in the migration; the handlers assume the
   database is the last line of defence (and vice versa).
4. `npm run check:sql && npm run db:migrate:local && npm run db:seed:local && npm test && npm run smoke`.
   `check:sql` prepares every statement in the Worker against the new schema, so a renamed column
   is caught before a route is.
