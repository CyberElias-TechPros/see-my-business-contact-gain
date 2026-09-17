# GainHub NG

GainHub NG is a conversation-first Nigerian business directory. Customers can search reviewed listings, compare useful public facts, and move into WhatsApp or a structured enquiry. Business representatives can apply for a listing, prove ownership, see authorised enquiries, and participate in opt-in contact circles. Platform administrators moderate every publication and trust workflow.

This repository contains two deployable applications:

- a server-rendered **TanStack Start** web application targeting **Vercel**; and
- a standalone **Cloudflare Worker** API backed by **D1** and private **R2** storage.

The product does **not** currently sell subscriptions, advertising, paid placement, or verification. Pages discussing those areas state that no checkout or entitlement exists.

## Product surface

### Public discovery

- server-rendered home, search, category, location, and business-profile routes;
- search by business text or active service, with category, location, rating, verification, and opening-hours filters;
- a type-ahead combobox that suggests businesses, categories, locations and services as you type;
- URL-based comparison of up to three current published businesses, with a type-ahead picker fed by live directory results and a "highest rated" rail so discovery does not depend on already knowing a name;
- published ratings **and readable published reviews**, with a per-star distribution and a moderated review form;
- **editable reviews** — an author can revise their own review, and editing a published one returns it to moderation and drops it from the aggregate until it is re-approved;
- opening hours stored per weekday and evaluated in Africa/Lagos, so "open now" is derived rather than stored;
- related-business links on every profile, derived from category and city;
- services, amenities, service areas, socials, price range and deterministic generative cover art per listing;
- contact details, narrowly described verification states, and outbound-link safeguards;
- WhatsApp, phone, website, and directions contact-event recording using a salted visitor hash;
- runtime `robots.txt`, an XML sitemap built from the live taxonomy and current published profile/circle URLs, canonical links, Open Graph metadata, and JSON-LD.

No fictional preview profiles are shipped. Every public page reads the live API, and each
loader returns an explicit availability flag, so an API incident degrades to an honest
message instead of substituted data.

### Customer and business workflows

- email or Nigerian-phone registration and sign-in;
- **password recovery** with single-use, expiring tokens that revoke existing sessions on use;
- saved businesses;
- consented enquiries and moderated reviews;
- free listing applications with supported taxonomy validation;
- authenticated ownership claims with private PDF/PNG/JPEG/WebP evidence;
- an owner workspace limited to authorised businesses and their enquiries;
- **owner editing of published listings** — hours, services, amenities, service areas, socials and profile fields, each section saving independently;
- owner-controlled enquiry transitions (`new`, `contacted`, `qualified`, `closed`, or `spam`);
- **contact-gain insights** — contacts by channel, unique visitors, enquiries and recent activity, derived only from recorded events;
- **in-app notifications** when a listing is approved or rejected, a claim is decided, an enquiry arrives, a review is moderated, or a password is reset;
- account settings for name, email, phone and password changes;
- opt-in contact-circle proposals and capacity-safe business applications;
- **`/app/circles`** — circles you run (with the join requests waiting on you, which you admit or decline yourself), circles your businesses belong to, the ability to leave one, and a history of closed applications;
- factual suggestions, safety reports, and tracked personal-data requests.

### Administration

`/admin` exposes eight live moderation queues:

1. listing applications;
2. ownership claims and private evidence;
3. safety reports;
4. reviews;
5. contact-circle proposals;
6. contact-circle applications;
7. directory suggestions; and
8. personal-data requests.

Every route is role-checked again in the Worker. Consequential decisions require a browser confirmation, specified decisions require a meaningful note, and moderation actions are audited. Listing approval publishes a real business row; claim approval grants authorised workspace access; review approval recalculates rating aggregates; and circle admission checks capacity atomically.

## Architecture

```text
Browser
  |
  | HTTPS, same-origin pages and /api/*
  v
Vercel: TanStack Start + Nitro (Node.js 22)
  |-- SSR/server loaders -----------+
  |-- fixed-origin /api/* proxy ----|----> Cloudflare Worker
                                    |        |-- D1: relational source of truth
                                    |        |-- R2: private claim evidence only
                                    |        `-- Cron: expiry and retention cleanup
                                    |
                                    `---- no browser call to a separate API origin
```

The same-origin proxy keeps the secure host-only session cookie on the web domain and avoids exposing a mutable upstream URL to browser code. Server-side discovery calls the configured Worker origin directly. The proxy has a 15-second timeout and returns a structured `503` response when the API is unavailable.

D1 is used because the product has relational ownership, membership, moderation, uniqueness, and audit constraints. R2 is used only for private claim files. No KV namespace, Durable Object, Queue, payment service, or additional cloud has been introduced without a demonstrated requirement.

## Repository map

| Path                                  | Purpose                                                             |
| ------------------------------------- | ------------------------------------------------------------------- |
| `src/routes/`                         | TanStack file routes, including the same-origin API proxy           |
| `src/lib/contracts.ts`                | Shared Zod input contracts and public TypeScript types              |
| `src/lib/directory.server.ts`         | Server-only calls from SSR loaders to the Worker                    |
| `src/lib/worker-proxy.server.ts`      | Fixed-origin Vercel-to-Worker proxy                                 |
| `worker/index.ts`                     | Cloudflare Worker routing, auth, domain logic, moderation, and cron |
| `worker/migrations/`                  | Ordered, forward-only D1 migrations                                 |
| `worker/seed.local.sql`               | Idempotent local demo fixtures; never a production seed             |
| `scripts/worker-smoke.mjs`            | End-to-end Worker workflow test                                     |
| `scripts/frontend-smoke.mjs`          | Vercel-output SSR and same-origin proxy test                        |
| `scripts/serve-vercel-output.mjs`     | Test-only Node harness for Vercel Build Output API artifacts        |
| `scripts/validate-production-env.mjs` | Fail-fast production configuration validation                       |
| `wrangler.jsonc`                      | Local, preview, and production Worker resource bindings             |
| `vercel.json`                         | Production build command, security headers, and asset caching       |

`src/routeTree.gen.ts` is generated by TanStack Router. Do not edit it manually.

## Prerequisites

- Node.js **22 or newer**;
- npm;
- a Cloudflare account and Wrangler authentication only when creating or deploying remote resources;
- a Vercel account only when deploying the web application.

The compatible Nitro beta is intentionally pinned exactly in `package.json`. Upgrade it only after re-running the complete validation suite.

## Local development

### 1. Install

```bash
npm ci
cp .dev.vars.example .dev.vars
```

Generate a development-only hash salt and replace the placeholder in `.dev.vars`:

```bash
openssl rand -base64 32
```

Do not commit `.dev.vars`.

The public/legal variables in `.env.example` are optional during local development. Leaving them unset causes truthful configuration notices instead of fabricated operator details. The frontend defaults to `http://127.0.0.1:8787` for its local Worker connection.

### 2. Create the local database and fixtures

```bash
npm run worker:migrate
npm run worker:seed
```

The seed is intentionally local-only. Its three business records include “demo” in their names. Never run `worker/seed.local.sql` against preview or production.

### 3. Start both applications

Terminal one:

```bash
npm run worker:dev
```

Terminal two:

```bash
npm run dev
```

Open the URL printed by Vite. Browser API calls use `/api/*`; do not configure client code to call `localhost` directly.

### Local administrator bootstrap

Register a normal local account first, stop the Worker if necessary, and update that one account in local D1:

```bash
npx wrangler d1 execute gainhub-development \
  --local \
  --config wrangler.jsonc \
  --command "UPDATE users SET role = 'platform_admin' WHERE email = 'your-local-email@example.test'"
```

Refresh the session or reload `/admin`. This is a local bootstrap operation, not an HTTP backdoor; there is no production promotion endpoint.

## Configuration

### Vercel environment

Set all eight variables for the production build:

| Variable                   | Visibility  | Meaning                                                 |
| -------------------------- | ----------- | ------------------------------------------------------- |
| `CLOUDFLARE_API_URL`       | server only | Exact HTTPS origin of the deployed Worker               |
| `CLOUDFLARE_PROXY_SECRET`  | server only | Random 32+ character value matching the Worker secret   |
| `VITE_SITE_URL`            | public      | Exact canonical HTTPS origin of the web application     |
| `VITE_LEGAL_OPERATOR_NAME` | public      | Actual registered operator name                         |
| `VITE_PRIVACY_EMAIL`       | public      | Monitored privacy-rights inbox                          |
| `VITE_SUPPORT_EMAIL`       | public      | Monitored support/safety inbox                          |
| `VITE_GOVERNING_LAW`       | public      | Jurisdiction-specific wording approved for the operator |
| `VITE_DISPUTE_FORUM`       | public      | Reviewed court or dispute-resolution forum wording      |

`npm run build:production` rejects missing values, HTTP URLs, reserved placeholder origins, malformed/placeholder inboxes, and placeholder legal wording. `npm run build:vercel` applies that gate when Vercel declares `VERCEL_ENV=production`; preview builds remain inspectable with truthful unconfigured/unavailable states. Public values are compiled into pages and metadata, so changing them requires a new frontend build.

### Cloudflare Worker configuration

`wrangler.jsonc` contains explicit placeholders. Replace all preview/production resource IDs, names, origins, and example domains before deployment.

- `APP_ENV`: `development`, `preview`, or `production`;
- `ALLOWED_ORIGINS`: comma-separated, exact Vercel origins allowed to make browser requests;
- `DB`: D1 binding;
- `EVIDENCE`: private R2 binding;
- `IP_HASH_SALT`: secret used for rate-limit and contact-event pseudonymous hashes;
- `PROXY_SHARED_SECRET`: secret that authenticates Vercel's forwarded client-IP header.

Set both with Wrangler secrets for each remote environment; never place them in `vars` or Git:

```bash
npx wrangler secret put IP_HASH_SALT --env preview --config wrangler.jsonc
npx wrangler secret put PROXY_SHARED_SECRET --env preview --config wrangler.jsonc
npx wrangler secret put IP_HASH_SALT --env production --config wrangler.jsonc
npx wrangler secret put PROXY_SHARED_SECRET --env production --config wrangler.jsonc
```

The `PROXY_SHARED_SECRET` entered for an environment must exactly match that frontend environment's `CLOUDFLARE_PROXY_SECRET`. Use different random values in preview and production, and rotate both proxy copies together. Rotating `IP_HASH_SALT` intentionally breaks correlation with old visitor hashes and resets identity continuity for IP-based rate-limit keys.

## Validation

Run the complete local gate with free ports `8810` and `4180`:

```bash
npm run check
```

It runs, in order:

1. Prettier verification;
2. frontend and Worker TypeScript checks;
3. ESLint;
4. Vitest contract/security tests;
5. local D1 migrations, seed, and the full Worker workflow smoke test;
6. a Vercel-target production build plus SSR, metadata, route crawl, static-asset, cookie, proxy, and outage smoke tests;
7. a Wrangler deployment dry run; and
8. full and production-only npm vulnerability audits.

Useful individual commands:

```bash
npm run format:check
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run test:frontend
npm run worker:build
npm run audit
```

`npm run test:integration` mutates only the local Wrangler state. `npm run test:frontend` builds with explicit smoke-test legal values and starts short-lived local processes. The generated `.vercel`, `.worker-build`, and `.wrangler` state are ignored by Git.

To confirm that the production guard fails closed when legal/deployment identity is absent:

```bash
npm run validate:production-env
```

That command is expected to exit non-zero unless every real production value has been supplied.

## Security model

- Passwords use PBKDF2-SHA256 with random salts and 310,000 iterations.
- Session tokens are 32 random bytes; only SHA-256 token hashes are stored.
- The 30-day `__Host-gh_session` cookie is `Secure`, `HttpOnly`, `SameSite=Lax`, host-only, and path-wide.
- Browser mutations require an allowed `Origin` when present and the non-simple `X-GainHub-Intent` header.
- Worker CORS reflects only configured exact origins and permits credentials only for those origins.
- A shared server-only credential authenticates Vercel's client-IP forwarding; spoofed proxy headers are rejected in constant time.
- Authorisation is enforced in D1-backed Worker handlers, not inferred from frontend navigation.
- Input is bounded with shared Zod schemas; JSON bodies are capped; SQL values are bound; search wildcards are escaped.
- Claim uploads are limited to 8 MB and require both an allowed MIME type and matching PDF/PNG/JPEG/WebP magic bytes.
- R2 evidence has no public route. Admin retrieval is authenticated, audited, sent as an attachment, and marked `no-store`.
- D1-backed rate limits cover auth and submission surfaces.
- Request IDs are returned on success and failure and shown as support references in form errors.
- Vercel applies CSP, HSTS, anti-framing, MIME-sniffing, referrer, and permissions headers.
- Production dependency audit is part of the validation gate.

A verification label is deliberately not a warranty, ranking purchase, or performance guarantee. Ownership evidence proves control only to the extent established by the operator's review procedure.

## Data lifecycle

The daily Worker cron runs at `03:17 UTC` and performs bounded evidence cleanup plus relational expiry:

- sessions are removed after expiry (sessions last no more than 30 days);
- expired rate-limit buckets are removed;
- raw contact-channel events are deleted after 180 days;
- private files for approved or rejected claims are deleted after 180 days, while the decision record remains;
- audit events and completed/rejected listing, suggestion, report, review, and personal-data-request records are deleted after 400 days;
- active, processing, or contested workflows are preserved.

Claim-file deletion is tracked in D1, and the R2 delete is safe to retry. The code and public privacy notice use the same periods. A legal hold or active dispute may require documented preservation outside the ordinary schedule.

New registrations store the accepted terms version and timestamp. Existing pre-migration accounts remain null rather than being falsely backfilled with consent.

## Deployment

Do not deploy the checked-in placeholder configuration.

### 1. Resolve launch inputs

Before creating a production deployment, obtain:

- the actual legal operator name;
- reviewed governing-law and dispute-forum language;
- monitored privacy and support inboxes;
- final frontend and API domains;
- a Vercel project;
- separate Cloudflare preview and production D1 databases and R2 buckets; and
- random preview and production `IP_HASH_SALT` and shared-proxy secrets.

### 2. Create Cloudflare resources

Create separate resources, then replace the placeholder IDs/names in `wrangler.jsonc`:

```bash
npx wrangler d1 create gainhub-preview
npx wrangler d1 create gainhub-production
npx wrangler r2 bucket create gainhub-evidence-preview
npx wrangler r2 bucket create gainhub-evidence-production
```

Set exact `ALLOWED_ORIGINS` values for the intended Vercel domains. Keep preview and production data isolated.

### 3. Back up, migrate, and deploy the Worker

For an existing database, take and verify a D1 backup/export before applying migrations. Then run:

```bash
npx wrangler d1 migrations apply gainhub-preview \
  --remote --env preview --config wrangler.jsonc
npx wrangler deploy --env preview --config wrangler.jsonc
```

Exercise the preview workflows before production. For production:

```bash
npx wrangler d1 migrations apply gainhub-production \
  --remote --env production --config wrangler.jsonc
npx wrangler deploy --env production --config wrangler.jsonc
```

Check the deployed `/health`, a public directory query, one authorised workflow, and the scheduled handler in the intended environment. Do not run the local seed remotely.

### 4. Deploy the frontend to Vercel

Import this repository into Vercel and set the eight production variables above. `vercel.json` runs the environment-aware command:

```bash
npm run build:vercel
```

For a local production preflight, run `npm run build:production`; it always applies the fail-closed validator. `vite.config.ts` emits Vercel Build Output API artifacts using the Node.js 22 Nitro preset. After deployment, verify:

- canonical and social URLs use the final domain;
- `/robots.txt` points to the final `/sitemap.xml`;
- the sitemap includes current published profiles;
- `/api/health` reaches the Worker through the same-origin proxy;
- registration sets the secure host-only cookie;
- `/account`, `/app`, and `/admin` remain no-indexed and role protected; and
- the Worker accepts only the exact final Vercel origins.

### 5. Bootstrap the first production administrator

Register a dedicated operator account through the normal web flow. Verify control of its email/phone first. In the authenticated Cloudflare D1 console, confirm that the lookup identifies exactly one active account, then run the promotion and record who authorised it:

```sql
SELECT id, full_name, email, phone, role, status
  FROM users
 WHERE lower(email) = lower('real-operator-address@your-domain.tld');

UPDATE users
   SET role = 'platform_admin', updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
 WHERE lower(email) = lower('real-operator-address@your-domain.tld')
   AND status = 'active';
```

Reload `/admin` and verify access; session roles are refreshed from D1. Do not create a public promotion endpoint or reuse a shared administrator identity.

For higher-risk operations, place additional access controls around operator accounts and establish an administrator offboarding procedure before adding staff.

## Operations

Monitor both providers:

- **Cloudflare:** Worker errors, 5xx rate, CPU/subrequest limits, D1 failures/latency, R2 errors, cron outcomes, and unusual `401`/`403`/`429` volume;
- **Vercel:** function errors, latency, deployment health, proxy `503` responses, and asset/build failures;
- **application support:** correlate incidents with the returned `x-request-id`/support reference without asking users for passwords or evidence files over email.

Recommended launch alerts include sustained `/health` failure, elevated API 5xx, repeated cron failure, a rise in proxy `API_UNAVAILABLE`, and moderation queue growth. Review audit access and administrator membership periodically. Test restoration and a complete claim-file deletion cycle before launch, then on a scheduled basis.

### Rollback

- Roll back the Vercel frontend to a previously verified deployment when the defect is frontend-only.
- Use Cloudflare Worker version rollback for Worker-code regressions.
- Database migrations are forward-only and are **not** undone by a code rollback. Back up before migration and prefer a corrective migration. Restore from a verified backup only under the incident plan.
- Never delete an R2 bucket as a rollback mechanism. Preserve private evidence and its D1 references.
- After any rollback, re-run health, public-read, session, authorisation, and moderation checks against the restored versions.

## Deliberate boundaries

The current repository does not pretend to provide:

- live payment, subscription, invoicing, advertising, or sponsored-ranking infrastructure;
- automated email/SMS verification, or automated delivery of password-reset links (a reset can be
  requested and completed, but the link is surfaced through the operator's outbox — and, in local
  development, returned directly — rather than emailed);
- automatic execution of data access/deletion requests (administrators track identity checks and manual fulfilment);
- a self-service verification upgrade or ownership-transfer workflow;
- guaranteed review times, business performance, directory coverage, or search ranking; or
- completed Vercel/Cloudflare resources, domains, legal identity, or credentials.

Those require real operator decisions, external resources, and in some cases legal review. They must not be represented as complete until implemented and validated in the deployed environment.

## Licence

No licence file is present. Treat the code as all rights reserved until the repository owner selects and adds a licence.
