# Deploying GainHub NG

The app is split exactly as intended:

| Piece | Host | Notes |
| --- | --- | --- |
| Frontend (TanStack Start + Nitro) | **Vercel** | `vercel.json` pins the Nitro **vercel** preset |
| Backend API (Hono Worker) | **Cloudflare Workers** | `backend/` — D1 (SQLite) + KV |
| Canonical dataset seed | Cloudflare D1 | `backend/schema.sql` + `backend/seed.sql` |

The frontend talks to the Worker with a typed API client (`src/lib/api.ts`). If
`VITE_API_URL` is not set (or the Worker is unreachable) the whole app still
works against an in-browser **demo backend** seeded from
`src/data/dataset.json` — so previews never break.

---

## 1. Backend → Cloudflare Workers

```bash
cd backend
npm install
```

### 1.1 Create the resources

```bash
npx wrangler d1 create gainhub
# → copy the database_id into wrangler.jsonc → d1_databases[0].database_id

npx wrangler kv namespace create CACHE
# → copy the id into wrangler.jsonc → kv_namespaces[0].id
```

### 1.2 Migrate + seed the database

```bash
npx wrangler d1 migrations apply gainhub --remote   # or: apply schema.sql manually
npx wrangler d1 execute gainhub --remote --file=./schema.sql
npx wrangler d1 execute gainhub --remote --file=./seed.sql
```

### 1.3 Point CORS at your frontend

Edit `backend/wrangler.jsonc` → `vars`:

```jsonc
"vars": {
  "ALLOWED_ORIGINS": "https://your-app.vercel.app,https://your-custom-domain",
  "APP_URL": "https://your-app.vercel.app"
}
```

`ALLOWED_ORIGINS` controls which origins may call the API with credentials
(session cookies are `SameSite=None; Secure` for cross-origin deployments).

### 1.4 Deploy

```bash
npx wrangler deploy
# → https://gainhub-api.<your-subdomain>.workers.dev
```

Sanity check: `curl https://<worker-url>/api/health` → `{"ok":true,...}`.

Seeded accounts (change the passwords before going live — see below):

- Owner: `chidi@swiftfix.ng` / `demo1234`
- Admin: `admin@gainhub.ng` / `admin1234`

---

## 2. Frontend → Vercel

1. Import the repo into Vercel (framework preset **Nitro** — `vercel.json` pins
   it, along with `LOVABLE_NITRO_PRESET=vercel` so the build targets Vercel's
   serverless runtime instead of the local default Cloudflare preset).
2. Set the project environment variable:

   | Name | Value | Environments |
   | --- | --- | --- |
   | `VITE_API_URL` | `https://gainhub-api.<your-subdomain>.workers.dev` | Production + Preview |

   > Leave `VITE_API_URL` unset on throwaway branches to demo in fallback mode.

3. Deploy. The dashboard, business pages, contact-gain, workspace and admin
   console will all hit the live Worker.

Because cookies are sent cross-origin (`credentials: "include"`), the Worker
must list your Vercel origin(s) in `ALLOWED_ORIGINS` (step 1.3) — otherwise
sign-in will look successful but the session cookie will be dropped.

---

## 3. Local development (full stack)

```bash
cd backend && npx wrangler dev --port 8787   # D1+KV emulated locally
npm run dev                                   # in repo root → http://localhost:8080
```

With no `VITE_API_URL`, the frontend probes `/api/health` on its own origin and
falls back to the demo store — the Worker then isn't required. To develop
against the live local Worker, add a Vite proxy or set
`VITE_API_URL=http://127.0.0.1:8787` before `npm run dev`.

## 4. Production hardening checklist

- [ ] Change/remove the seeded demo passwords in D1 (`users` table).
- [ ] Set a restrictive `ALLOWED_ORIGINS` (prod + preview URLs only).
- [ ] Point both `APP_URL` (Worker) and your custom domain at the same site.
- [ ] Enable Cloudflare Analytics / Vercel Analytics as needed.
- [ ] The repo-root build writes `.wrangler/` and `.output/` — both are
      gitignored; never commit them.
