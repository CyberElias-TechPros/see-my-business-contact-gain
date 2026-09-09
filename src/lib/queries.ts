/**
 * Typed reads over the GainHub API, shaped as TanStack Query options so a route loader can
 * `ensureQueryData(...)` on the server and the client reuses the same key on refetch.
 *
 * The response types come from `shared/api.ts`, which the Worker validates against; when a field
 * is renamed there, both sides fail to compile instead of one of them rendering `undefined`.
 */
import { queryOptions } from "@tanstack/react-query";
import type { DirectoryResponse, PageMeta, SessionResponse } from "../../shared/api.ts";

type PageMetaDto = PageMeta;
import {
  VERIFICATION_LEVELS,
  formatNaira,
  waLink,
  type VerificationLevel,
} from "../../shared/domain.ts";
import type { Business } from "@/data/mock";
import { coverClass, mediaSrc } from "./api-client.ts";
import { serverApiFetch, sessionProbe } from "./server-api.ts";

/**
 * `| undefined` is spelled out because the project compiles with `exactOptionalPropertyTypes`,
 * so `{ q: undefined }` would otherwise be a type error — and `toFilters` legitimately produces
 * absent-vs-undefined keys when it copies validated search params across.
 */
export type DirectoryFilters = {
  q?: string | undefined;
  category?: string | undefined;
  location?: string | undefined;
  area?: string | undefined;
  sort?: "relevance" | "rating" | "reviews" | "newest" | "response" | undefined;
  verified?: boolean | undefined;
  openNow?: boolean | undefined;
  minRating?: number | undefined;
  amenity?: string | undefined;
  page?: number | undefined;
  perPage?: number | undefined;
};

/** The shape a `/search`-style route hands over: `openNow`/`verified` are the URL's `"1"`, not booleans. */
export type SearchFilterInput = {
  q?: string | undefined;
  category?: string | undefined;
  location?: string | undefined;
  sort?: DirectoryFilters["sort"];
  minRating?: number | undefined;
  openNow?: string | undefined;
  verified?: string | undefined;
  amenity?: string | undefined;
  page?: number | undefined;
};

/**
 * Validated URL search params → an API query. Lives next to `directoryPath` (not in the route
 * file) so the route exports only components — a route module that exports a plain function
 * breaks React Fast Refresh for the file, and the filter mapping belongs with the query it feeds.
 * Absent keys are omitted rather than set to `undefined`, which `exactOptionalPropertyTypes`
 * rejects and the API would treat as an empty filter anyway.
 */
export function searchParamsToFilters(value: SearchFilterInput) {
  return {
    ...(value.q ? { q: value.q } : {}),
    ...(value.category ? { category: value.category } : {}),
    ...(value.location ? { location: value.location } : {}),
    ...(value.sort ? { sort: value.sort } : {}),
    ...(value.minRating ? { minRating: value.minRating } : {}),
    openNow: value.openNow === "1",
    verified: value.verified === "1",
    ...(value.amenity ? { amenity: value.amenity } : {}),
    page: typeof value.page === "number" ? value.page : 1,
    perPage: 12,
  } satisfies DirectoryFilters;
}

export function directoryPath(filters: DirectoryFilters): string {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.category) params.set("category", filters.category);
  if (filters.location) params.set("location", filters.location);
  if (filters.area) params.set("area", filters.area);
  if (filters.sort && filters.sort !== "relevance") params.set("sort", filters.sort);
  if (filters.verified) params.set("verified", "true");
  if (filters.openNow) params.set("openNow", "true");
  if (filters.minRating) params.set("minRating", String(filters.minRating));
  if (filters.amenity) params.set("amenity", filters.amenity);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return `/api/v1/search${query ? `?${query}` : ""}`;
}

export function directoryQuery(filters: DirectoryFilters) {
  return queryOptions({
    queryKey: ["directory", filters] as const,
    queryFn: () =>
      serverApiFetch({
        data: { path: directoryPath(filters) },
      }) as unknown as Promise<DirectoryResponse>,
    // Matches the API's own `max-age=30, s-maxage=120`: a category page should not re-hit D1 on
    // every navigation, but a listing published a minute ago should appear.
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------- session ----

/** The signed-in visitor, the workspaces they can open, and the token every mutation needs. */
export type Session = SessionResponse;

/**
 * The one query every authenticated surface depends on, and the reason `/app` can decide to
 * redirect before it paints: `memberships` is what tells us whether this account owns a listing
 * at all.
 *
 * It is a server function rather than a browser fetch so SSR and the client read it the same way
 * (see `sessionProbe`): SSR gets the visitor's cookie from the incoming request, the browser gets
 * it from its own jar, and both hit the same cache key — which is how the hydrated page avoids a
 * second round trip. `null` means "not signed in or not reachable", and both render the logged-out
 * shell; `GET /auth/session` answers 200 with `user: null` rather than 401, so nothing here
 * treats an unknown visitor as a failure.
 *
 * A minute of staleness is safe because the CSRF token is derived from the session id, not from
 * time: a stale copy still validates. Only sign-in and sign-out need to feel instant, and both
 * write the new payload into this key directly instead of waiting for a refetch.
 */
export function sessionQuery() {
  return queryOptions({
    queryKey: ["session"] as const,
    queryFn: () => sessionProbe() as unknown as Promise<Session | null>,
    staleTime: 60_000,
  });
}

/** Everything a route needs to answer "is this person signed in, and into which workspace?". */
export function currentWorkspace(session: Session | null | undefined) {
  const first = session?.memberships?.[0];
  return { signedIn: Boolean(session?.user), workspace: first ?? null };
}

// -------------------------------------------------------------- workspace ----

export type LeadListFilters = {
  stage?: string | undefined;
  q?: string | undefined;
  assignee?: "me" | "unassigned" | "all" | undefined;
  sort?: "recent" | "score" | "value" | undefined;
  page?: number | undefined;
};

export type WorkspaceSummary = import("../../shared/api.ts").WorkspaceSummary;
export type WorkspaceStats = import("../../shared/api.ts").WorkspaceStats;
export type LeadDto = import("../../shared/api.ts").LeadDto;
export type LeadStats = { stages: { stage: string; count: number; valueMinor: number }[] };
export type LeadPage = { items: LeadDto[]; meta: PageMetaDto };

/**
 * `businessId` is the workspace the visitor picked, and the API treats it as untrusted: every
 * handler re-checks membership (`accessFor`), so a hand-typed id answers 403 rather than leaking.
 * That is also why the frontend may put it in a URL (`/app?ws=`) at all.
 */
function workspacePath(businessId: string, suffix: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(businessId)}${suffix}`;
}

export function workspaceSummaryQuery(businessId: string) {
  return queryOptions({
    queryKey: ["workspace-summary", businessId] as const,
    queryFn: () =>
      serverApiFetch({
        data: { path: workspacePath(businessId, "/summary"), cache: false },
      }) as unknown as Promise<WorkspaceSummary>,
    // The metrics are derived from writes the owner makes in this very tab, so a long staleTime
    // would show a dashboard that disagrees with the table underneath it. Mutations invalidate
    // this key; the 15s is only for someone who leaves the tab open.
    staleTime: 15_000,
  });
}

export function workspaceLeadsQuery(businessId: string, filters: LeadListFilters = {}) {
  const params = new URLSearchParams();
  if (filters.stage) params.set("stage", filters.stage);
  if (filters.q) params.set("q", filters.q);
  if (filters.assignee && filters.assignee !== "all") params.set("assignee", filters.assignee);
  if (filters.sort && filters.sort !== "recent") params.set("sort", filters.sort);
  if (filters.page && filters.page > 1) params.set("page", String(filters.page));
  const query = params.toString();
  return queryOptions({
    queryKey: ["workspace-leads", businessId, filters] as const,
    queryFn: () =>
      serverApiFetch({
        data: {
          path: workspacePath(businessId, `/leads${query ? `?${query}` : ""}`),
          cache: false,
        },
      }) as unknown as Promise<LeadPage>,
    staleTime: 10_000,
  });
}

export function workspaceLeadStatsQuery(businessId: string) {
  return queryOptions({
    queryKey: ["workspace-lead-stats", businessId] as const,
    queryFn: () =>
      serverApiFetch({
        data: { path: workspacePath(businessId, "/leads/stats"), cache: false },
      }) as unknown as Promise<LeadStats>,
    staleTime: 10_000,
  });
}

export function workspaceAnalyticsQuery(businessId: string, days = 30) {
  return queryOptions({
    queryKey: ["workspace-analytics", businessId, days] as const,
    queryFn: () =>
      serverApiFetch({
        data: { path: `${workspacePath(businessId, "/analytics")}?days=${days}`, cache: false },
      }) as unknown as Promise<WorkspaceStats>,
    staleTime: 60_000,
  });
}

export type CategoryTile = {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  count: number;
  checklist: string[];
  requiredMedia: string[];
};

export type LocationTile = {
  id: string;
  slug: string;
  name: string;
  state: string;
  areas: string[];
  count: number;
};

export type Taxonomy = { categories: CategoryTile[]; locations: LocationTile[] };

export function taxonomyQuery() {
  return queryOptions({
    queryKey: ["taxonomy"] as const,
    queryFn: async () => {
      const [categories, locations] = await Promise.all([
        serverApiFetch({ data: { path: "/api/v1/categories" } }) as unknown as Promise<{
          items: CategoryTile[];
        }>,
        serverApiFetch({ data: { path: "/api/v1/locations" } }) as unknown as Promise<{
          items: LocationTile[];
        }>,
      ]);
      // `count` is the Worker's published-listing count for that facet, computed in the same
      // query — which is why the homepage and the category page can never disagree.
      return {
        categories: categories.items ?? [],
        locations: locations.items ?? [],
      } satisfies Taxonomy;
    },
    staleTime: 300_000,
  });
}

/** The `/businesses/:idOrSlug` payload, field-for-field as the Worker shapes it. */
export type ListingDto = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  city: string;
  area: string | null;
  state: string;
  ratingAvg: number;
  ratingCount: number;
  verifiedLevel: "unverified" | "email" | "phone" | "documents" | "premium";
  plan: "free" | "growth" | "pro";
  openNow: boolean;
  contactsGained: number;
  savedCount: number;
  logoMediaId: string | null;
  coverMediaId: string | null;
  amenities: string[];
  whatsapp: string | null;
  responseMinutes: number | null;
  ownerId: string | null;
  about: string;
  phone: string | null;
  website: string | null;
  socials: { label: string; handle: string; url: string }[];
  address: string | null;
  serviceAreas: string[];
  hours: {
    dayOfWeek: number;
    label: string;
    opens: string | null;
    closes: string | null;
    closed: boolean;
  }[];
  services: { id: string; name: string; priceMinor: number | null; note: string | null }[];
  products: { id: string; name: string; priceMinor: number | null; tag: string | null }[];
  media: {
    id: string;
    kind: string;
    label: string | null;
    alt: string;
    url: string;
    width: number | null;
    height: number | null;
  }[];
  team: { id: string; name: string; role: string }[];
  claims: { total: number; avg: number; byStar: Record<string, number> };
  publishedAt: string | null;
  savedByViewer: boolean;
};

export type ListingPayload = {
  business: ListingDto;
  viewer: { canManage: boolean; role: string | null };
};

export function listingQuery(idOrSlug: string) {
  return queryOptions({
    queryKey: ["listing", idOrSlug] as const,
    queryFn: () =>
      serverApiFetch({
        data: { path: `/api/v1/businesses/${encodeURIComponent(idOrSlug)}` },
      }) as unknown as Promise<ListingPayload>,
    // A listing changes when its owner edits it, and the "open now" flag changes on the hour.
    staleTime: 15_000,
  });
}

export function similarQuery(idOrSlug: string) {
  return queryOptions({
    queryKey: ["listing-similar", idOrSlug] as const,
    queryFn: () =>
      serverApiFetch({
        data: { path: `/api/v1/businesses/${encodeURIComponent(idOrSlug)}/similar` },
      }) as unknown as Promise<SimilarPage>,
    staleTime: 300_000,
  });
}

export function listingReviewsQuery(idOrSlug: string, page = 1) {
  return queryOptions({
    queryKey: ["listing-reviews", idOrSlug, page] as const,
    queryFn: () =>
      serverApiFetch({
        data: { path: `/api/v1/businesses/${encodeURIComponent(idOrSlug)}/reviews?page=${page}` },
      }) as unknown as Promise<ReviewPage>,
    staleTime: 30_000,
  });
}

/** `/api/v1/sitemap` payload: what the Worker considers indexable, as site-relative paths. */
export type RoomTile = {
  id: string;
  slug: string;
  name: string;
  purpose: string;
  houseRule: string;
  state: string;
  verifiedOnly: boolean;
  capacity: number;
  memberCount: number;
  slotsLeft: number;
  avgSaveBack: number;
  membership: string;
};

export function roomsQuery(
  filters: { state?: string | undefined; purpose?: string | undefined } = {},
) {
  const params = new URLSearchParams();
  if (filters.state) params.set("state", filters.state);
  if (filters.purpose) params.set("purpose", filters.purpose);
  const query = params.toString();
  return queryOptions({
    queryKey: ["rooms", filters] as const,
    queryFn: () =>
      serverApiFetch({
        data: { path: `/api/v1/rooms${query ? `?${query}` : ""}`, cache: false },
      }) as unknown as Promise<{ items: RoomTile[]; total: number }>,
    // Membership depends on the visitor, so this one must not be cached across users and the
    // room fills up during the day: always revalidate, and never let the CDN answer it.
    staleTime: 0,
  });
}

export type SitemapPayload = {
  businesses: { path: string; lastmod: string }[];
  categories: { path: string }[];
  locations: { path: string }[];
  rooms: { path: string }[];
  generatedAt: string;
};

/** The `/businesses/:idOrSlug/reviews` page, exactly as `listReviews` in the Worker shapes it. */
export type ReviewItem = {
  id: string;
  rating: number;
  body: string;
  author: string;
  createdAt: string;
  ownerReply: string | null;
  ownerReplyAt: string | null;
};

export type ReviewPage = { items: ReviewItem[]; meta: PageMetaDto };
export type SimilarPage = { items: DirectoryResponse["items"] };

export function sitemapQuery() {
  return queryOptions({
    queryKey: ["sitemap"] as const,
    queryFn: () =>
      serverApiFetch({ data: { path: "/api/v1/sitemap" } }) as unknown as Promise<SitemapPayload>,
    staleTime: 600_000,
  });
}

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function asLevel(value: unknown): VerificationLevel {
  return (VERIFICATION_LEVELS as readonly string[]).includes(String(value))
    ? (String(value) as VerificationLevel)
    : "unverified";
}

/**
 * The card view model. Components were built against a richer mock record; rather than rewrite
 * six of them in one commit, a listing is adapted into that shape and every value is either read
 * from the API or derived from something that was. Nothing here invents a number.
 */
export function toCardBusiness(source: {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  categoryName: string;
  categorySlug: string;
  city: string;
  state: string;
  ratingAvg: number;
  ratingCount: number;
  verifiedLevel: string;
  openNow: boolean;
  whatsapp: string | null;
  amenities: string[];
  coverMediaId: string | null;
  contactsGained: number;
  savedCount: number;
  plan: "free" | "growth" | "pro";
}): Business {
  return {
    id: source.slug, // the route accepts the API's id-or-slug, and a slug is the shareable one
    name: source.name,
    tagline: source.tagline,
    about: "",
    category: source.categoryName,
    categorySlug: source.categorySlug,
    city: source.city,
    state: source.state,
    address: "",
    rating: source.ratingAvg,
    reviews: source.ratingCount,
    verified: asLevel(source.verifiedLevel),
    openNow: source.openNow,
    hours: [],
    whatsapp: source.whatsapp ?? "",
    phone: "",
    website: "",
    socials: [],
    services: [],
    products: [],
    amenities: source.amenities ?? [],
    serviceAreas: [],
    gallery: [],
    team: [],
    plan: source.plan === "pro" ? "Pro" : source.plan === "growth" ? "Growth" : "Free",
    contactsGained: source.contactsGained,
    savedBy: source.savedCount,
    cover: coverClass(source.slug),
    coverUrl: mediaSrc(source.coverMediaId) ?? undefined,
    whatsappUrl: source.whatsapp ? waLink(source.whatsapp) : undefined,
  };
}

export { DAY_NAMES, formatNaira };
