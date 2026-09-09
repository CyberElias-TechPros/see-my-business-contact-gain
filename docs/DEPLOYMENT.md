# Deploying GainHub NG

Two deployments, one repository:

| Piece        | Platform            | Artifact                                   |
| ------------ | ------------------- | ------------------------------------------ |
| Frontend     | Vercel              | TanStack Start (SSR + static assets)        |
| API          | Cloudflare Workers  | `worker/` — D1, KV, R2, Queues, Cron        |

The split is deliberate: pages need a Node-capable renderer and edge caching for HTML, the API
needs D1/KV/R2 and a request path that never waits for a container to boot. Follow the steps in
order; each one ends with something you can check.

The ids in `worker/wrangler.jsonc` are **format-valid placeholders invented for local
development**. `npm run check:deploy` fails until they are replaced, which is the intended
state for a repository that has never had Cloudflare resources created for it.

---

## 1. Cloudflare resources

Requires the `wrangler` in this repo (`npx wrangler …`) and an account you have logged into:

```sh
npm i --no-audit --no-fund --legacy-peer-deps   # if node_modules is empty
npx wrangler login
npx wrangler accounts list                       # copy the 32-char account id
```

Create the resources. Names matter: they are what appears in the Cloudflare dashboard.

```sh
npx wrangler d1 create gainhub                                   # production
npx wrangler d1 create gainhub-staging                          # staging
npx wrangler kv namespace create GAINHUB_KV                       # production
npx wrangler kv namespace create GAINHUB_KV_STAGING               # staging
npx wrangler r2 bucket create gainhub-media                       # production
npx wrangler r2 bucket create gainhub-staging-media               # staging
npx wrangler queues create gainhub-notifications                  # production queue
npx wrangler queues create gainhub-notifications-staging          # staging queue
```

Each `create` prints an id. Paste them into `worker/wrangler.jsonc`:

| Config key                                        | From the output of            |
| ------------------------------------------------- | ----------------------------- |
| `account_id`                                       | `wrangler accounts list`      |
| `d1_databases[0].database_id`                      | `d1 create gainhub`           |
| `kv_namespaces[0].id`                              | `kv namespace create GAINHUB_KV` |
| `r2_buckets[0].bucket_name`                        | already correct unless you renamed it |
| `queues.producers[0].queue` / `consumers[0].queue` | `queues create gainhub-notifications` |
| `env.staging.*`                                    | the `-staging` equivalents    |

`database_name` must stay in sync with the D1 you created; `binding` names must not change
(`DB`, `KV`, `MEDIA`, `EMAIL_QUEUE`) — they are the property names in `worker/env.d.ts` and in
every handler.

Then prove the config is coherent:

```sh
npm run check:deploy
```

It checks resource-id shape, `APP_ENV` per environment, that no secret appears in `vars`, that
`PUBLIC_URL`/`API_URL` are https and not localhost, that staging does not share a namespace or
bucket with production, that every migration file is listed under `migrations`, and that every
binding has a type in `worker/env.d.ts`.

## 2. Migrations, then secrets

Migrations first — a Worker that starts against an empty database answers 500 for every request:

```sh
npx wrangler d1 migrations apply gainhub --remote
npm run db:migrate:remote          # same command, kept as the project-level alias
```

`worker/migrations/*.sql` are append-only and additive. Never edit an applied file: D1 tracks
them by tag in `d1_migrations`, so an edited migration is skipped silently on other
environments and the two databases drift. If a column must change, add a migration that
backfills it with a default and leave the old rows valid; that is what makes a rollback to the
previous Worker version possible.

Secrets go to the Workers secret store, never into `wrangler.jsonc`:

```sh
npx wrangler secret put SECRET_KEY        # production
npx wrangler secret put RESEND_API_KEY
npx wrangler secret put MAIL_FROM
npx wrangler secret put SECRET_KEY --env staging   # a different value
npx wrangler secret put RESEND_API_KEY --env staging
```

`SECRET_KEY` signs session cookies, the derived CSRF token and media upload tickets
(`HMAC(SECRET_KEY, …)`). Rotating it logs every user out and invalidates outstanding upload
tickets and reset links — treat it as a break-glass operation, not routine hygiene. Generate one
with `openssl rand -hex 32`. `MAIL_FROM` must be an address on a domain whose SPF/DKIM you
control, or verification mail lands in spam and users conclude the product is broken.

## 3. Deploy the Worker

```sh
npm run worker:deploy                # runs check:deploy first, then injects version vars
npm run worker:deploy:staging        # staging env of the same config
```

The deploy scripts append `--var APP_VERSION:<package version> --var GIT_SHA:<short sha>` so
`GET /api/v1/version` reports what is actually running — without them the endpoint would print
`unknown` and an incident would start with "which build is this?".

Deploy without a custom domain first and check it:

```sh
curl -s https://<worker-subdomain>.workers.dev/api/v1/health
curl -s https://<worker-subdomain>.workers.dev/api/v1/version
```

`health` performs a real `SELECT 1` against D1, so it proves the bindings and the schema in one
request. Then:

```sh
npx wrangler tail --format json     # structured request logs; watch for level:"error"
```

## 4. DNS and routes

Add the zones to Cloudflare and uncomment/fill `routes` in `worker/wrangler.jsonc`:

```jsonc
"routes": [
  { "custom_domain": { "name": "api.gainhub.ng" } },
  { "custom_domain": { "name": "staging-api.gainhub.ng" } }   // env.staging.routes
]
```

Custom domains on a Worker are provisioned by Cloudflare (DNS-only record, `proximal` orange
cloud, automatic TLS). `allow_beta` is not needed. Wait for the route to report `initialized`
in `npx wrangler deployments status` before pointing the frontend at it.

## 5. Vercel

Import the repository, framework preset **Vite**, build command `npm run build`. Vercel picks
**bun** as the package manager because `bun.lock` is committed, and runs
`bun install --frozen-lockfile` — meaning a `package.json` change that was never installed with
bun fails the deploy in seconds ("lockfile had changes, but lockfile is frozen"). `npm run
check:lock` is the local equivalent, and it names the package; run `bun install` and commit the
lockfile when it complains. Do not commit `package-lock.json` alongside it (it is gitignored):
Vercel's package-manager detection would then prefer npm, whose strict peer resolution this tree
does not satisfy. Do not set an
output directory: the Lovable Vite config runs nitro with `cloudflare-module` as its *default*,
and nitro's own platform detection overrides that during a Vercel build (`NITRO_PRESET` /
`.vercel` detection), which is what emits `.vercel/output`. Locally `npm run build` writes
`.output/` — that difference is expected, not a misconfiguration. Only pin
`nitro: { preset: "vercel" }` in `vite.config.ts` if you build outside Vercel and want a Vercel
artifact anyway.

Environment variables — per environment (Production, Preview, Development):

| Name              | Production                                | Staging                        |
| ----------------- | ----------------------------------------- | ------------------------------ |
| `PUBLIC_URL`      | `https://gainhub.ng`                       | `https://staging.gainhub.ng`   |
| `API_URL`         | `https://api.gainhub.ng`                   | `https://staging-api.gainhub.ng` |
| `API_INTERNAL_URL`| `https://api.gainhub.ng`                   | `https://staging-api.gainhub.ng` |
| `COOKIE_STRATEGY` | `same-origin-proxy`                        | same                            |

`API_URL` is what the browser talks to (absolute media URLs, WhatsApp links);
`API_INTERNAL_URL` is what **server rendering** uses, so SSR data fetching never pays a
round-trip through the browser's network path and can be given a longer timeout. On Vercel both
point at the API host; if you later move to a private network path, only this variable changes.

Rewrites in `vercel.json` (already present in the repo root) keep the session cookie
same-origin for client-side calls:

```json
{
  "rewrites": [
    { "source": "/api/v1/:path*", "destination": "https://api.gainhub.ng/api/v1/:path*" },
    { "source": "/media/:path*", "destination": "https://api.gainhub.ng/media/:path*" },
    { "source": "/go/:code", "destination": "https://api.gainhub.ng/go/:code" }
  ]
}
```

Why the proxy and not direct CORS: the session cookie is `SameSite=Lax; Secure; HttpOnly` and
scoped to the **frontend** host. A cross-origin `fetch` from `gainhub.ng` to `api.gainhub.ng`
would be a cross-site request and the cookie would not travel, so login would appear to succeed
and then every subsequent call would be anonymous. Same-origin calls through a proxy are the
only shape that works without loosening the cookie, and loosening it is what makes CSRF attacks
possible. This is also why the API derives its CSRF token from the session id instead of setting
a second cookie.

`/media/*` and `/go/*` are rewritten for the same reason in reverse: `mediaUrl()` returns an
absolute `${API_URL}/media/<id>` so images can be served straight from the edge, while `/go/<code>`
short links are printed on flyers and must resolve on the marketing domain.

`ALLOWED_ORIGINS` on the Worker only needs the frontend origins for tooling that calls the API
cross-origin on purpose (the smoke suite, a future mobile app). Set it with
`npx wrangler secret`-style `vars` in the config: it is not a secret.

## 6. Smoke-test the deployment

```sh
SMOKE_BASE_URL=https://api.gainhub.ng SMOKE_PASSWORD='Gainhub123!' npm run smoke
```

**Against staging only.** The suite creates real rows (businesses named `smoke-*`, reviews,
rooms, leads) and expects the demo seed to be present, which is exactly what
`npm run db:seed:remote` puts in staging. Never run it against production data you care about,
and never seed production: the seed contains fictional traders and fabricated review text, and
publishing it would poison the directory the product exists to keep clean.

Then the human checks: sign up, verify the email, create a listing, upload a photo, publish,
search for it, submit an enquiry from another browser, see the lead appear in the console with
the right source.

## 7. After the first deploy

* `GET /api/v1/admin/jobs` shows the last run of every cron job (`flush_view_counters`,
  `aggregate_daily`, `moderation_sla`, `stale_leads`, `purge_*`, `weekly_digest`). A job that has
  not run in a day is a red flag long before users mention stale analytics.
* Cron is declared in `wrangler.jsonc` (`*/15 * * * *` and `17 3 * * *` UTC ≈ 2:17am Lagos).
  To rehearse a run: `npx wrangler trigger deploy` is not a thing — call the Worker's scheduled
  handler from `wrangler dev` (`curl -X POST http://localhost:8787/cdn-cgi/local/scheduled`) or
  use the dashboard's "Test" button on the cron trigger.
* Set the Workers analytics/alarm thresholds you care about (error rate, CPU, D1 read rows) —
  D1's free tier is 5M reads/day, which this API's caching layer exists to protect.
* Back up before destructive work: `npx wrangler d1 export gainhub --remote --file=backup.sql`,
  or the dashboard's point-in-time restore (7 days).

## 8. Rollback

* **Worker**: `npx wrangler deployments list` → `npx wrangler rollback <version-id>`. Bindings,
  vars and cron/queue triggers are part of a version, so a rollback also reverts config.
* **Frontend**: Vercel → Deployments → "Promote to Production" on the previous deployment.
* **Database**: migrations are additive precisely so that rollback does not require a schema
  revert. If a migration must be undone, write a *new* migration that restores the old shape
  (copy values into a shadow table first); do not edit history.

## Notes on limits that shaped the code

* `limits.cpu_ms = 200`. Password hashing is PBKDF2-SHA256 at 210,000 iterations, which costs
  tens of milliseconds of CPU; at Workers' default budget every sign-in would abort on a CPU
  exception that never reproduces locally. If you must run on the free plan (30ms CPU per
  invocation, 10ms per request by default there), lower `PBKDF2_ITERATIONS` **and** rehash on
  login — `needsRehash()` in `worker/src/crypto.ts` already rewrites hashes at the old cost when
  a user signs in, so the transition is automatic for anyone who logs in.
* KV allows one write per key per second. That is why the rate limiter uses a bucket suffix
  (`rl:<name>:<identity>:<window-index>`) instead of incrementing one key, and why view counters
  are batched in KV and flushed by cron instead of written per request.
* D1 has no transactions and no `RETURNING`; multi-statement writes go through `DB.write`
  (`batch`), and derived counters come from triggers, so a partial write cannot leave a listing
  with an average that disagrees with its reviews.
* Queue consumers receive at most 50 messages per batch; `max_batch_size = 25` keeps the email
  sender inside the provider's request body limits, with `max_retries = 3` and
  `retry_delay = 30s`. Malformed messages are acknowledged (a retry would not fix them);
  provider 5xx throws, so the message is retried.
