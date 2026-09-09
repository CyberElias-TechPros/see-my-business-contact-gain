/**
 * Typed reads over the GainHub API, shaped as TanStack Query options so a route loader can
 * `ensureQueryData(...)` on the server and the client reuses the same key on refetch.
 *
 * The response types come from `shared/api.ts`, which the Worker validates against; when a field
 * is renamed there, both sides fail to compile instead of one of them rendering `undefined`.
 */
import { queryOptions } from "@tanstack/react-query";
import type { DirectoryResponse, PageMeta } from "../../shared/api.ts";

type PageMetaDto = PageMeta;
import {
  VERIFICATION_LEVELS,
  formatNaira,
  waLink,
  type VerificationLevel,
} from "../../shared/domain.ts";
import type { Business } from "@/data/mock";
import { coverClass, mediaSrc } from "./api-client.ts";
import { serverApiFetch } from "./server-api.ts";

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
