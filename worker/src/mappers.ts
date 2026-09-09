import { json } from "./db.ts";
import type { MediaKind, VerificationLevel } from "../../shared/domain.ts";
import { VERIFICATION_RANK } from "../../shared/domain.ts";

/** Row shapes (subset of the columns each SELECT needs). */
export type BusinessRow = {
  id: string;
  slug: string;
  owner_user_id: string | null;
  name: string;
  tagline: string;
  about: string;
  category_id: string;
  category_slug: string;
  category_name: string;
  location_id: string | null;
  city: string;
  area: string | null;
  state: string;
  address: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  socials_json: string | null;
  amenities_json: string | null;
  service_areas_json: string | null;
  verified_level: VerificationLevel;
  plan: "free" | "growth" | "pro";
  status: string;
  response_minutes: number | null;
  rating_avg: number | null;
  rating_count: number | null;
  contacts_gained: number | null;
  view_count: number | null;
  saved_count: number | null;
  enquiry_count: number | null;
  profile_complete: number | null;
  is_featured: number | null;
  published_at: string | null;
  created_at: string;
};

export type HoursRow = {
  business_id: string;
  day_of_week: number;
  opens: string | null;
  closes: string | null;
  closed: number;
};
export type MediaRow = {
  id: string;
  kind: string;
  label: string | null;
  alt: string;
  content_type: string;
  moderation_status: string;
  is_primary: number;
  width: number | null;
  height: number | null;
  position: number;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Open-now is derived from `business_hours` in the caller's configured timezone
 * (Africa/Lagos for this product). Doing this in SQL would mean time-zone maths
 * SQLite cannot do reliably.
 */
export function isOpenNow(hours: HoursRow[] | undefined, at: Date = new Date()): boolean {
  // Africa/Lagos is UTC+1 year-round (no DST), so a fixed offset is exact here.
  const lagos = new Date(at.getTime() + 60 * 60 * 1000);
  const day = lagos.getUTCDay();
  const minutes = lagos.getUTCHours() * 60 + lagos.getUTCMinutes();
  const today = hours?.find((h) => h.day_of_week === day);
  if (!today || today.closed === 1 || !today.opens || !today.closes) return false;
  const open = toMinutes(today.opens);
  const close = toMinutes(today.closes);
  if (open == null || close == null) return false;
  return open <= minutes && minutes < (close <= open ? close + 24 * 60 : close);
}

function toMinutes(value: string | null): number | null {
  if (!value) return null;
  const parts = value.split(":");
  const h = Number.parseInt(parts[0] ?? "", 10);
  const m = Number.parseInt(parts[1] ?? "", 10);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

export function mapHours(hours: HoursRow[]) {
  const byDay = new Map(hours.map((h) => [h.day_of_week, h]));
  // Monday-first for display, matching the public profile layout.
  const order = [1, 2, 3, 4, 5, 6, 0];
  return order.map((day) => {
    const row = byDay.get(day);
    return {
      dayOfWeek: day,
      label: DAY_NAMES[day]!,
      opens: row?.opens ?? null,
      closes: row?.closes ?? null,
      closed: row ? row.closed === 1 || !row.opens : true,
    };
  });
}

export function mediaUrl(id: string, apiBase: string): string {
  return `${apiBase.replace(/\/$/, "")}/media/${id}`;
}

export function pickPrimary<T extends { kind: string; is_primary: number; position: number }>(
  media: T[],
  kind: MediaKind,
): T | undefined {
  return (
    media.find((m) => m.kind === kind && m.is_primary === 1) ?? media.find((m) => m.kind === kind)
  );
}

export function toSummary(
  row: BusinessRow,
  hours: HoursRow[] | undefined,
  apiBase: string,
  media: MediaRow[],
) {
  const approved = media.filter((m) => m.moderation_status === "approved");
  const logo = pickPrimary(approved, "logo");
  const cover = pickPrimary(approved, "cover");
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    categoryName: row.category_name,
    city: row.city,
    area: row.area,
    state: row.state,
    ratingAvg: Number(row.rating_avg ?? 0),
    ratingCount: Number(row.rating_count ?? 0),
    verifiedLevel: row.verified_level,
    plan: row.plan,
    openNow: isOpenNow(hours),
    contactsGained: Number(row.contacts_gained ?? 0),
    savedCount: Number(row.saved_count ?? 0),
    logoMediaId: logo?.id ?? null,
    coverMediaId: cover?.id ?? null,
    amenities: json<string[]>(row.amenities_json, []),
    whatsapp: row.whatsapp,
    responseMinutes: row.response_minutes,
  };
}

export function detailExtras(row: BusinessRow) {
  return {
    about: row.about,
    phone: row.phone,
    website: row.website,
    socials: json<{ label: string; handle: string; url: string | null }[]>(row.socials_json, []),
    address: row.address,
    serviceAreas: json<string[]>(row.service_areas_json, []),
  };
}

/** Ranking used for `sort=relevance`: quality, proof of demand and paid placement. */
export function relevanceScore(row: BusinessRow): number {
  const proof = (Number(row.rating_count ?? 0) / (Number(row.rating_count ?? 0) + 20)) * 20;
  return (
    Number(row.rating_avg ?? 0) * 4 +
    proof +
    Math.min(10, Number(row.contacts_gained ?? 0) / 200) +
    VERIFICATION_RANK[row.verified_level] * 3 +
    (row.is_featured === 1 ? 25 : 0)
  );
}
