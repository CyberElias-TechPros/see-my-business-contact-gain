/**
 * Domain vocabulary shared by the Cloudflare Worker API and the Vercel frontend.
 *
 * Every value here is persisted or transmitted, so these unions are the
 * contract: D1 CHECK constraints, zod schemas and UI labels all derive from them.
 */

// ---------------------------------------------------------------- roles ----

export const USER_ROLES = ["consumer", "owner", "staff", "admin"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const MEMBERSHIP_ROLES = ["owner", "manager", "agent", "marketing"] as const;
export type MembershipRole = (typeof MEMBERSHIP_ROLES)[number];

/** What a membership role is allowed to do inside a business workspace. */
export const WORKSPACE_PERMISSIONS = [
  "profile:read",
  "profile:write",
  "media:write",
  "catalog:write",
  "leads:read",
  "leads:write",
  "enquiries:read",
  "enquiries:reply",
  "tasks:write",
  "links:write",
  "campaigns:write",
  "automation:write",
  "team:manage",
  "billing:manage",
  "analytics:read",
  "audit:read",
] as const;
export type WorkspacePermission = (typeof WORKSPACE_PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<MembershipRole, readonly WorkspacePermission[]> = {
  owner: WORKSPACE_PERMISSIONS,
  manager: [
    "profile:read",
    "profile:write",
    "media:write",
    "catalog:write",
    "leads:read",
    "leads:write",
    "enquiries:read",
    "enquiries:reply",
    "tasks:write",
    "links:write",
    "campaigns:write",
    "automation:write",
    "analytics:read",
    "audit:read",
  ],
  agent: [
    "profile:read",
    "leads:read",
    "leads:write",
    "enquiries:read",
    "enquiries:reply",
    "tasks:write",
    "analytics:read",
  ],
  marketing: [
    "profile:read",
    "media:write",
    "catalog:write",
    "leads:read",
    "links:write",
    "campaigns:write",
    "analytics:read",
  ],
};

export function permissionsFor(role: MembershipRole): readonly WorkspacePermission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function can(
  role: MembershipRole | null | undefined,
  permission: WorkspacePermission,
): boolean {
  if (!role) return false;
  return permissionsFor(role).includes(permission);
}

// ------------------------------------------------------------ businesses ----

export const VERIFICATION_LEVELS = [
  "unverified",
  "email",
  "phone",
  "documents",
  "premium",
] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export const VERIFICATION_LABELS: Record<VerificationLevel, string> = {
  unverified: "Unverified",
  email: "Email verified",
  phone: "WhatsApp verified",
  documents: "Documents verified",
  premium: "Premium verified",
};

/** Higher number == more trust. Used for ranking and for gating premium rooms. */
export const VERIFICATION_RANK: Record<VerificationLevel, number> = {
  unverified: 0,
  email: 1,
  phone: 2,
  documents: 3,
  premium: 4,
};

export const BUSINESS_PLANS = ["free", "growth", "pro"] as const;
export type BusinessPlan = (typeof BUSINESS_PLANS)[number];

export const PLAN_PRICING_MINOR: Record<BusinessPlan, number> = {
  free: 0,
  growth: 1_250_000, // ₦12,500.00 stored in kobo
  pro: 3_500_000,
};

export const PLAN_LIMITS: Record<
  BusinessPlan,
  { media: number; teamSeats: number; links: number; automations: number; campaigns: number }
> = {
  free: { media: 3, teamSeats: 1, links: 1, automations: 0, campaigns: 0 },
  growth: { media: 60, teamSeats: 5, links: 50, automations: 12, campaigns: 20 },
  pro: { media: 400, teamSeats: 20, links: 500, automations: 60, campaigns: 200 },
};

export const BUSINESS_STATUSES = ["draft", "pending", "published", "suspended", "hidden"] as const;
export type BusinessStatus = (typeof BUSINESS_STATUSES)[number];

/** Only published businesses are publicly discoverable. */
export const PUBLIC_BUSINESS_STATUSES: readonly BusinessStatus[] = ["published"];

// ------------------------------------------------------------------ crm ----

export const LEAD_STAGES = ["new", "qualified", "quoted", "follow_up", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  new: "New",
  qualified: "Qualified",
  quoted: "Quoted",
  follow_up: "Follow up",
  won: "Won",
  lost: "Lost",
};

/**
 * Allowed stage transitions. The original prototype let the UI set any stage;
 * the server enforces this graph so reports stay trustworthy (a "won" lead that
 * never existed in another stage can't be faked by a stale tab).
 */
export const LEAD_TRANSITIONS: Record<LeadStage, readonly LeadStage[]> = {
  new: ["qualified", "lost"],
  qualified: ["quoted", "follow_up", "lost"],
  quoted: ["follow_up", "won", "lost"],
  follow_up: ["quoted", "won", "lost"],
  won: ["lost"],
  lost: ["new"],
};

export function canMoveStage(from: LeadStage, to: LeadStage): boolean {
  return LEAD_TRANSITIONS[from]?.includes(to) ?? false;
}

export const LEAD_PRIORITIES = ["low", "medium", "high"] as const;
export type LeadPriority = (typeof LEAD_PRIORITIES)[number];

export const TASK_PRIORITIES = LEAD_PRIORITIES;

export const ENQUIRY_STATUSES = ["new", "read", "replied", "closed"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const LEAD_SOURCES = [
  "directory_profile",
  "category_page",
  "location_page",
  "qr_code",
  "campaign_link",
  "contact_gain_room",
  "referral",
  "website_widget",
  "manual",
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  directory_profile: "Directory profile",
  category_page: "Category page",
  location_page: "Location page",
  qr_code: "QR code",
  campaign_link: "Campaign link",
  contact_gain_room: "Contact-gain room",
  referral: "Referral link",
  website_widget: "Website widget",
  manual: "Added by team",
};

// ------------------------------------------------------- contact-gain rooms ----

export const ROOM_STATUSES = ["pending", "active", "paused", "closed"] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_PURPOSES = ["business", "niche", "logistics", "network"] as const;
export type RoomPurpose = (typeof ROOM_PURPOSES)[number];

export const ROOM_MEMBERSHIP_STATUSES = ["queued", "active", "removed"] as const;
export type RoomMembershipStatus = (typeof ROOM_MEMBERSHIP_STATUSES)[number];

/** Save-back score below this loses room access (house rule enforced by cron). */
export const SAVE_BACK_MINIMUM = 60;

// ------------------------------------------------------------- moderation ----

export const REPORT_TARGETS = ["business", "review", "user", "room", "media", "listing"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];

export const REPORT_REASONS = [
  "scam",
  "impersonation",
  "fake_review",
  "inappropriate_media",
  "closed_or_wrong",
  "spam",
  "harassment",
  "other",
] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const REPORT_STATUSES = ["open", "reviewing", "actioned", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const RISK_LEVELS = ["low", "medium", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const MODERATION_STATUSES = ["pending", "approved", "rejected", "removed"] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

/** Deterministic first-pass risk scoring (replaces the prototype's hardcoded "High"). */
export function scoreReportRisk(reason: ReportReason, detail?: string): RiskLevel {
  const text = (detail ?? "").toLowerCase();
  if (reason === "scam" || reason === "impersonation") return "high";
  if (reason === "inappropriate_media") return "high";
  if (/(advance fee|pay before|transfer before|lottery|loan|urgent)/.test(text)) return "high";
  if (reason === "fake_review" || reason === "harassment") return "medium";
  if (/(wrong|closed|duplicate|address)/.test(text)) return "low";
  return "medium";
}

// ---------------------------------------------------------------- claims ----

export const CLAIM_STATUSES = [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "contested",
] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

// -------------------------------------------------------------- media ----

export const MEDIA_KINDS = [
  "logo",
  "cover",
  "shop",
  "interior",
  "team",
  "product",
  "work",
  "document",
] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

/** Public media is served through the API; documents are never public. */
export const PRIVATE_MEDIA_KINDS: readonly MediaKind[] = ["document"];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const ALLOWED_UPLOAD_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;
export type AllowedUploadType = (typeof ALLOWED_UPLOAD_TYPES)[number];

// -------------------------------------------------------------- helpers ----

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/**
 * Nigerian phone numbers arrive as "0803 000 0000", "+234 803 000 0000",
 * "8030000000". Normalise to E.164 so lookups, dedupe and wa.me links work.
 * Returns null when the input cannot be a Nigerian MSISDN.
 */
export function normalizeNigerianPhone(raw: string): string | null {
  const digits = raw
    .replace(/[^\d]/g, "")
    .replace(/^0*234/, "")
    .replace(/^0/, "");
  // Nigerian mobile numbers are 10 national digits starting with 7/8/9.
  if (!/^[789]\d{9}$/.test(digits)) return null;
  return `+234${digits}`;
}

/** Loose validity check for the "phone or WhatsApp" fields the directory stores. */
export function looksLikePhone(raw: string): boolean {
  return normalizeNigerianPhone(raw) !== null;
}

export function waLink(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

/** ₦ amounts are stored as integer kobo; render with thousands separators. */
export function formatNaira(minor: number | null | undefined): string {
  if (minor == null) return "Price on request";
  if (minor === 0) return "Free";
  const naira = minor / 100;
  return `₦${naira.toLocaleString("en-NG", { maximumFractionDigits: naira % 1 === 0 ? 0 : 2 })}`;
}

export function parseNairaToMinor(input: string): number | null {
  // Strip the decoration, but keep the sign: a price of "-100" is a typo, not ₦100, and
  // silently accepting it would put a positive number in the database that the user never
  // typed. `cleaned.replace(/[^\d.]/g, "")` alone would drop the minus.
  if (/^-|\(-\d+\)/.test(input.trim())) return null;
  const cleaned = input.replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const value = Number.parseFloat(cleaned);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/**
 * Lead score: deterministic, explainable and computed server-side so the
 * dashboard, the API and CSV export can never disagree.
 */
export function scoreLead(input: {
  source: LeadSource;
  stage: LeadStage;
  valueMinor?: number | null;
  hoursSinceActivity?: number | null;
  messageLength?: number | null;
}): number {
  const sourceWeight: Record<LeadSource, number> = {
    directory_profile: 18,
    category_page: 14,
    location_page: 12,
    qr_code: 16,
    campaign_link: 15,
    contact_gain_room: 10,
    referral: 17,
    website_widget: 13,
    manual: 8,
  };
  const stageWeight: Record<LeadStage, number> = {
    new: 12,
    qualified: 26,
    quoted: 34,
    follow_up: 22,
    won: 45,
    lost: 0,
  };
  let score = 20 + (sourceWeight[input.source] ?? 10) + (stageWeight[input.stage] ?? 0);
  if (input.valueMinor && input.valueMinor > 0) {
    score += Math.min(20, Math.round(input.valueMinor / 1_000_000)); // ₦10k -> 1pt, ₦200k -> 20pt
  }
  if (input.messageLength) score += Math.min(8, Math.round(input.messageLength / 30));
  if (input.hoursSinceActivity != null)
    score -= Math.min(25, Math.round(input.hoursSinceActivity / 6));
  return Math.max(1, Math.min(99, Math.round(score)));
}

export const BUSINESS_AMENITIES = [
  "Parking",
  "Card payment",
  "Bank transfer",
  "Delivery",
  "Home service",
  "Wheelchair access",
  "Warranty offered",
  "Same-day service",
  "Open on weekends",
  "Pay on completion",
] as const;
export type BusinessAmenity = (typeof BUSINESS_AMENITIES)[number];

export const NAV_CATEGORIES_MAX = 12;
