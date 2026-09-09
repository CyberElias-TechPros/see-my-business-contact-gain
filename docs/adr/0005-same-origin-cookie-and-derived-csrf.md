# Same-origin session cookie through a proxy, with a derived CSRF token

**Status:** accepted (2026-09-09)

## Context

The frontend lives on Vercel (`gainhub.ng`) and the API on Cloudflare (`api.gainhub.ng`).
Sessions must survive a page reload, work for SSR-rendered pages, and be unforgeable. Two
families of solutions:

1. **Cross-site cookie** on the API host with `SameSite=None; Secure` (plus a CSRF token), or a
   `Authorization: Bearer` token kept in `localStorage`.
2. **Same-origin cookie**: the browser only ever calls `gainhub.ng/api/v1/*`, and Vercel (in
   production) or Vite's dev proxy (locally) forwards to the Worker.

`localStorage` is the worst option here: readable by any XSS, sent on every request to the wrong
place otherwise, and it cannot be seen by the SSR renderer at all — which would make every
logged-in page render as logged-out on first paint.

A `SameSite=None` cookie is sent on *any* cross-site subresource request, needs `Secure`
everywhere including local http, and turns every state-changing endpoint into a CSRF target
unless a double-submit token is layered on top.

## Decision

**Same-origin proxy, first-party `Lax` cookie, derived CSRF token.**

* The API sets `gh_session` (HttpOnly, Secure, SameSite=Lax, `Domain` only outside development —
  see `buildCookie`) with a value of `<sessionId>.<random token>`; the session row stores
  `SHA-256(token)` and `session_version`, so a password change or a ban revokes every session by
  bumping the version rather than by hunting cookies.
* `X-CSRF-Token` is required on every unsafe method **whenever a session cookie resolved**. The
  token is not stored anywhere new: it is `HMAC(SECRET_KEY, "csrf:" + sessionId)[0..32]`,
  returned in the login/session responses and re-derived server-side per request. A cross-site
  page cannot read it (no `SameSite=None`, no CORS `Allow-Origin` for it, and it lives in the
  JSON body, not a second cookie), and there is no token column to keep in sync — `sessions.csrf_hash`
  is retained only as a forensic copy of what was last issued, never as the check.
* `CSRF_EXEMPT_PATHS` covers only the endpoints a browser cannot attach a session to anyway
  (register, login, password reset, email verification, `/go/:code`, media upload tickets).
* The proxy rules live in `vercel.json` (`/api/v1/*`, `/media/*`, `/go/*`) and mirror-exactly in
  `vite.config.ts`'s dev proxy, so "works locally" and "works in production" are the same
  request shape. Both point at `${API_URL}`; server-side rendering may instead use
  `API_INTERNAL_URL` to skip the public hop.

## Consequences

* **Gained:** no cookie partitioning surprises (Safari's ITP, Chrome's phase-out), no CORS
  preflight on the critical path, `Lax` semantics that already block the common CSRF shapes, and
  SSR that can read the same cookie the browser sent — which is how `/app/*` pages render
  populated on first paint instead of flashing a skeleton.
* **Cost:** the frontend deployment is now load-bearing for the API's reachability (a broken
  rewrite looks exactly like an API outage). Documented in `docs/DEPLOYMENT.md` §5, and
  `GET /api/v1/health` on the API host is the first thing to curl when that happens.
* **Cost:** `SECRET_KEY` rotation invalidates outstanding CSRF tokens as well as sessions —
  accepted, they are minutes-lived values and users re-fetch the session on reload.
* **Rejected alternative:** a `csrf_token` cookie + matching header (double submit). It works,
  but needs a second cookie, a second `Set-Cookie` on every response and its own expiry story,
  and buys nothing over an HMAC of the session id that the client already has.
