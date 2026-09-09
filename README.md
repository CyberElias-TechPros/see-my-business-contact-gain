# GainHub NG

A Nigerian business directory, contact-gain rooms and SMB CRM. Consumers find a verified
trader, make contact through WhatsApp or an enquiry form, and the *source* of that contact is
recorded — so the business can see which flyer, QR code, campaign link or room produced the
lead. That attribution loop is the product; the directory is how it starts.

Three surfaces share one data layer:

| Surface       | Audience            | Routes                                    |
| ------------- | ------------------- | ----------------------------------------- |
| Discovery     | Consumers           | `/`, `/search`, `/business/:slug`, `/category/:slug`, `/locations/:slug`, `/compare` |
| Console       | Business owners     | `/app/*` — profile, catalogue, media, leads, enquiries, links, rooms, analytics, team, billing |
| Moderation    | GainHub staff       | `/admin/*` — listings, reports, claims, verification, users, flags, jobs, audit log |

## Architecture

```
Browser ──► Vercel (TanStack Start, SSR + JSON-LD + sitemap)
               │  /api/v1/* proxy (same-origin session cookie)
               ▼
        Cloudflare Worker  gainhub-api
          ├── D1        relational store, derived state in triggers
          ├── KV          cache · config · flags · rate limits · view counters
          ├── R2          media bytes (private, served through the Worker)
          ├── Queues      transactional email + notifications
          └── Cron        view flush, daily/weekly aggregates, moderation SLA, retention
```

One Worker, one D1 database, no server, no Durable Objects
([why](docs/adr/0001-cloudflare-workers-without-durable-objects.md)). Every write path is
authorised from the session plus the `memberships` table — never from a client-supplied
business id, header or hint. Shared contracts live in `shared/` (zod inputs + DTOs) and are
imported by both sides, so a field rename is a compile error rather than a runtime surprise.

## Working on it

```sh
npm i --no-audit --no-fund --legacy-peer-deps

npm run worker:dev      # API on http://localhost:8787 (wrangler dev, local D1/KV/R2)
npm run dev             # frontend on http://localhost:5173 (proxies /api/v1)
```

A fresh clone has no local database yet:

```sh
npm run db:migrate:local && npm run db:seed:local   # demo dataset, password: Gainhub123!
```

Then sign in as `ada@gainhub.dev` (admin), `hello@lumea.ng` (owner of a published listing) or
`ngozi@example.com` (consumer). Full loop, fixtures and the three test suites are in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Verification

| Command              | What it proves                                                      |
| -------------------- | ------------------------------------------------------------------- |
| `npm run typecheck`  | frontend **and** Worker under the strict root config                 |
| `npm run lint`       | eslint + prettier (0 errors is the bar)                              |
| `npm run check:sql`  | every SQL literal in the Worker prepared against the real schema, plus parameter arity |
| `npm run check:deploy` | wrangler config: real resource ids, https URLs, no committed secrets |
| `npm test`           | 44 tests in workerd — domain rules, auth, authorisation, triggers, limits |
| `npm run smoke`      | 139 checks against a *running* API (`worker/dev/smoke.mjs`)         |
| `npm run build`      | production frontend build                                            |
| `npm run verify`     | all of the above except deploy/smoke                                 |

`check:sql` exists because a wrong table alias in a template string typechecks cleanly and
only fails when a customer hits the page; it has caught several of those, and one 500 that no
other suite reached.

## Deploying

[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) is the exact sequence — Cloudflare resources,
secrets, Vercel environment, rewrites, DNS, migrations, verification, rollback. The resource
ids checked into `worker/wrangler.jsonc` are **placeholders on purpose**: nobody has created
the real D1/KV/R2 for this project yet, so a remote deploy must fail until they exist, and
`npm run check:deploy` explains what to create.

## What is and is not real

Read this before demoing or extending:

* **Implemented and locally verified** — auth, sessions, CSRF, listing CRUD, catalogue, media
  upload tickets, reviews + owner replies, enquiries → attributed leads, CRM pipeline, rooms,
  links/QR + click tracking, analytics, admin moderation queue, rate limiting, cron jobs, the
  email queue (structured log when no provider key is configured).
* **Environment-dependent** — transactional email (needs `RESEND_API_KEY`), custom domains and
  the R2 bucket (need the Cloudflare resources), anything that reads `API_URL` in production.
* **Not implemented** — payment collection (billing is plan metadata only; no Paystack/Flutterwave
  integration), image transcoding (bytes are stored as uploaded; size and magic bytes are
  validated), mobile apps.
