import "@tanstack/react-start/server-only";
import type {
  ApiSuccess,
  DirectoryQuery,
  DirectoryResponse,
  PublicBusiness,
  ReviewListResponse,
  SearchSuggestion,
} from "./contracts";

export type TaxonomyCategory = {
  slug: string;
  name: string;
  description: string;
  businessCount: number;
};

export type TaxonomyLocation = {
  slug: string;
  name: string;
  state: string;
  areas: string[];
  businessCount: number;
};

export type DirectoryTaxonomy = {
  categories: TaxonomyCategory[];
  locations: TaxonomyLocation[];
};

export type SitemapFeed = {
  businesses: Array<{ slug: string; updated_at: string }>;
  rooms: Array<{ id: string; updated_at: string }>;
};

/**
 * Server-only origin for the Cloudflare Worker.
 *
 * In production this must be configured explicitly — silently falling back to a
 * guessed origin is how a deployment ends up serving an empty directory while
 * every health check looks fine.
 */
function apiOrigin(): URL | null {
  const configured = process.env["CLOUDFLARE_API_URL"]?.trim();
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      return null;
    }
  }
  return process.env["NODE_ENV"] === "production" ? null : new URL("http://127.0.0.1:8787");
}

/** Thrown when the Worker is unreachable or misconfigured. Callers render a truthful state. */
export class DirectoryUnavailableError extends Error {
  constructor(message = "The directory service is unavailable") {
    super(message);
    this.name = "DirectoryUnavailableError";
  }
}

async function publicApiGet<T>(path: string): Promise<T> {
  const origin = apiOrigin();
  if (!origin) throw new DirectoryUnavailableError("CLOUDFLARE_API_URL is not configured");
  let response: Response;
  try {
    response = await fetch(new URL(path, origin), {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(5_000),
    });
  } catch {
    throw new DirectoryUnavailableError();
  }
  if (!response.ok)
    throw new DirectoryUnavailableError(`Directory API returned ${response.status}`);
  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
}

async function maybePublicApiGet<T>(path: string): Promise<T | null> {
  try {
    return await publicApiGet<T>(path);
  } catch {
    return null;
  }
}

export async function queryDirectory(query: DirectoryQuery): Promise<DirectoryResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.location) params.set("location", query.location);
  if (query.verified) params.set("verified", "true");
  if (query.openNow) params.set("openNow", "true");
  if (query.minRating) params.set("minRating", String(query.minRating));
  params.set("sort", query.sort);
  params.set("page", String(query.page));
  params.set("pageSize", String(query.pageSize));
  return publicApiGet<DirectoryResponse>(`/v1/businesses?${params.toString()}`);
}

export async function queryBusiness(slug: string): Promise<PublicBusiness | null> {
  try {
    return await publicApiGet<PublicBusiness>(`/v1/businesses/${encodeURIComponent(slug)}`);
  } catch (error) {
    if (error instanceof Error && error.message.includes("returned 404")) return null;
    throw error;
  }
}

export async function queryTaxonomy(): Promise<DirectoryTaxonomy> {
  const [categories, locations] = await Promise.all([
    publicApiGet<TaxonomyCategory[]>("/v1/categories"),
    publicApiGet<TaxonomyLocation[]>("/v1/locations"),
  ]);
  return { categories, locations };
}

export async function queryBusinessReviews(slug: string): Promise<ReviewListResponse | null> {
  return maybePublicApiGet<ReviewListResponse>(
    `/v1/businesses/${encodeURIComponent(slug)}/reviews`,
  );
}

export async function queryRelatedBusinesses(slug: string): Promise<PublicBusiness[]> {
  return (
    (await maybePublicApiGet<PublicBusiness[]>(
      `/v1/businesses/${encodeURIComponent(slug)}/related`,
    )) ?? []
  );
}

export async function querySuggestions(term: string): Promise<SearchSuggestion[]> {
  const trimmed = term.trim();
  if (trimmed.length < 2) return [];
  const result = await maybePublicApiGet<{ items: SearchSuggestion[] }>(
    `/v1/suggest?q=${encodeURIComponent(trimmed)}`,
  );
  return result?.items ?? [];
}

export async function querySitemapFeed(): Promise<SitemapFeed> {
  return publicApiGet<SitemapFeed>("/v1/sitemap");
}
