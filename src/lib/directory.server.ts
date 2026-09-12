import "@tanstack/react-start/server-only";
import type { ApiSuccess, DirectoryQuery, DirectoryResponse, PublicBusiness } from "./contracts";

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

async function publicApiGet<T>(path: string): Promise<T> {
  const origin = apiOrigin();
  if (!origin) throw new Error("CLOUDFLARE_API_URL is not configured");
  const response = await fetch(new URL(path, origin), {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error(`Directory API returned ${response.status}`);
  const payload = (await response.json()) as ApiSuccess<T>;
  return payload.data;
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
