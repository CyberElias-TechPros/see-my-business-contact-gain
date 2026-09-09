# Frontend architecture

The frontend is TanStack Start (React 19, Vite, Tailwind v4, shadcn-style primitives in
`src/components/ui`). It is a **client of the Worker API** — the same `/api/v1` contract any
third party gets. Nothing in `src/` queries D1 directly, and no page owns business data of its
own.

```
browser ──(same origin)──► TanStack Start (SSR + SPA)
                              │
        loaders ──► src/lib/server-api.ts   (createServerFn, forwards the visitor's cookie)
        actions ──► src/lib/api-client.ts   (relative fetch + X-CSRF-Token)
                              │
                              ▼
                    Cloudflare Worker `/api/v1/*`  ──► D1 / KV / R2 / Queues
```

## Two data paths, on purpose

| Need | Use | Why |
| --- | --- | --- |
| Data that must exist in the first HTML (SEO, shareable URLs, loaders) | `serverApiFetch` from `src/lib/server-api.ts`, wrapped in `queryOptions` in `src/lib/queries.ts` | A loader runs on the server, where a relative URL has no origin. The server function also carries the visitor's `Cookie` header to the API, so SSR renders logged-in state instead of flashing it in afterwards. |
| Mutations the visitor triggers (enquiry, review, save, workspace forms) | `apiFetch` from `src/lib/api-client.ts` | Browser-only. It calls the **same origin** (`/api/v1/...`), which is what makes the `SameSite=Lax` session cookie first-party, and it attaches `X-CSRF-Token` from the cached session payload. |

Do not import `@tanstack/react-start/server` from a module reachable by the client bundle; only
`*.server.ts`-style helpers and `createServerFn` handlers run server-side (the client build stubs
`*.server.ts`, and a stray import produces a bundle that builds and then throws at runtime).

### `serverApiFetch` allow-list

The server function takes a `path` string, so it is validated against `ALLOWED_PATHS` in
`src/lib/server-api.ts`: a server function is callable by anyone who can reach the URL, and
without the check the handler is an authenticated proxy onto an attacker-chosen host and path.
**When a page needs a new endpoint, add its route shape there** — deliberately not a
"allow anything under `/api/v1`" rule, which would let a caller walk into `/api/v1/admin/*` with
an admin's cookie.

## Queries, view models, adapters

`src/lib/queries.ts` holds every read as `queryOptions` (key + `staleTime` matched to the API's own
caching) plus the DTO types. API DTOs come from `shared/api.ts`, the same module the Worker
validates against: a renamed field fails `npm run typecheck` on both sides instead of rendering
`undefined`.

`toCardBusiness()` adapts a `BusinessSummary` into the shape `BusinessCard` in
`src/components/kit.tsx` expects. That view model still lives in `src/data/mock.ts` while routes are
being converted; it is the last thing mock.ts is used for. Its two "presentation" fields are
derived, not invented:

- `cover` — a deterministic gradient chosen from a hash of the slug (no R2 media is seeded in
  development, and stock photography would misrepresent a real trader).
- `coverUrl` — the same-origin `/media/<id>` URL when the listing has an approved cover.

Never render fabricated photography, fabricated counts, or a "demo" feed on a public page.

## TypeScript traps that cost hours

1. **`head` + `loader` in one route breaks inference.** `head`'s context type mentions the loader's
   return type; left to inference, TypeScript gives up on `TLoaderFn` and every
   `Route.useLoaderData()` in the file becomes `undefined` — while `tsc` reports errors only at the
   call sites, hundreds of lines away. Annotate `head`'s parameter explicitly:
   `head: ({ params, loaderData }: { params: { slug: string }; loaderData?: unknown }) => …`, then
   cast `loaderData as LoaderData | undefined` inside. Annotating with a type that *mentions*
   `LoaderData` re-creates the cycle, so `unknown` + cast is the working form.
2. **`validateSearch` schemas must be optional in and out.** A `.default()` turns the parsed object
   into one that *requires* `sort`/`page`, so every `<Link to="/search">` suddenly needs a `search`
   prop and canonical URLs fill with `?page=1&sort=relevance`. Put defaults in a `toFilters()`
   helper instead.
3. **`exactOptionalPropertyTypes`** forbids `{ coverUrl: undefined }`. Either omit the key
   (`...(value ? { key: value } : {})`) or type the field `?: T | undefined`.
4. **Route file renames matter for nesting.** `locations.tsx` + `locations.$slug.tsx` makes the
   detail page a *child* of the index page; because the index has no `<Outlet/>`, `/locations/lagos`
   rendered the index and dropped the detail component. A segment that has children needs
   `locations.index.tsx` for its index route. `npm run build` (or the dev server) regenerates
   `src/routeTree.gen.ts`; `tsc` alone will not.

## Rendering rules (SEO and honesty)

- **Real 404s.** Unknown slugs throw `notFound()` from the loader; the API's own 404 additionally
  sets the HTTP status inside `serverApiFetch`, so a delisted listing leaves the index instead of
  serving cached or fallback content under a live URL.
- **Canonical + `robots` on every public route.** Canonicals use the *slug*, so the same listing
  reached by id (`/business/biz_swiftfix`) self-canonicalises to `/business/swiftfix-gadgets`.
  Pagination beyond page 1 is `noindex,follow`; `/app` and `/admin` are `noindex,nofollow,noarchive`
  via their layout routes, and `src/server.ts` puts the same instruction in an `X-Robots-Tag`
  header for those prefixes (a header cannot be forgotten when a route is added).
- **`server.ts` also sets `Referrer-Policy: same-origin`.** Listing pages link out to `wa.me` and
  Google Maps; a full URL referrer would leak paths (and, on a claim flow, ids) to those hosts.
- **Structured data comes from listing fields only**: `LocalBusiness` with `PostalAddress`,
  `openingHoursSpecification`, `areaServed`, `sameAs`; `aggregateRating` **only when
  `ratingCount > 0`**; `hasOfferCatalog` from published services. `/` carries
  `WebSite` + `SearchAction` so Google may render a sitelinks search box.
- **Pagination is crawlable.** `<a href="/category/food-restaurants?page=2">` (see
  `src/components/site/Pagination.tsx`), never a button that only mutates client state — and a
  route that emits such links must parse `page` in `validateSearch` and honour it in its loader, or
  the link is a lie.
- **Facets are links, not dropdowns** (`FacetGroup` in `src/routes/search.tsx`), with the counts
  the API computed in the same query. Sort order stays a `<select>`: nobody needs to crawl it.
- **Forms** post through `apiFetch`, render `error.fields` per input (the API returns
  field-keyed messages for validation failures), keep the hidden `honeypot` field the API expects,
  and surface `429 retryAfterSeconds` in words.

## Running it

```bash
npm run worker:dev   # API on :8787 (D1/KV/R2 emulated from worker/.wrangler/state)
npm run dev          # Start app on :3000, proxies /api/v1, /media, /go to the worker
```

`vite.config.ts` reads `VITE_API_ORIGIN` for that proxy; `API_INTERNAL_URL` (else `API_URL`) is
what `serverApiFetch` uses when it calls the API from the server. Keep both pointed at the same
origin locally, or hydration and SSR disagree and the console fills with mismatch warnings.

Smoke-test a converted page without a browser:

```bash
curl -s localhost:3000/business/swiftfix-gadgets | grep -o 'rel="canonical"[^>]*'
curl -s localhost:3000/business/does-not-exist -o /dev/null -w '%{http_code}\n'   # 404
curl -sI localhost:3000/app/leads | grep -i x-robots-tag
```

## Conversion status

Done (real data, no mock): `/`, `/search`, `/categories`, `/category/$slug`, `/locations`,
`/locations/$slug`, `/business/$id`.

Still on `src/data/mock.ts`: `/contact-gain*`, `/compare`, `/claim`, `/report`,
`/suggest-business`, `/pricing`, `/advertise`, `/auth`, `/account`, `/help`, `/about`,
`/trust-safety`, `/legal.*`, everything under `/app` and `/admin`. Each conversion follows the
same recipe:

1. Add the read to `src/lib/queries.ts` (`queryOptions` + DTO type) and its path to
   `ALLOWED_PATHS`.
2. Move the page's data into a `loader` with an explicit `Promise<T>` return annotation.
3. Delete the mock import; if a value has no API field, remove the UI element or say it is missing.
4. Give the route `head` (title, description, canonical, robots) using the annotated-parameter
   form.
5. `npx tsc --noEmit && npx vite build`, then the `curl` checks above.
