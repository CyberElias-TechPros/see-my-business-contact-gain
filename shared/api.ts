/**
 * Request/response contract for the GainHub API.
 *
 * The Worker validates every inbound payload with these schemas and the
 * frontend infers its form state from them, which is the only thing keeping a
 * hand-written client and a hand-written server from drifting apart.
 */
import { z } from "zod";

import {
  ALLOWED_UPLOAD_TYPES,
  BUSINESS_PLANS,
  ENQUIRY_STATUSES,
  LEAD_PRIORITIES,
  LEAD_SOURCES,
  LEAD_STAGES,
  MAX_UPLOAD_BYTES,
  MEMBERSHIP_ROLES,
  MEDIA_KINDS,
  REPORT_REASONS,
  REPORT_TARGETS,
  ROOM_PURPOSES,
  USER_ROLES,
  VERIFICATION_LEVELS,
  normalizeNigerianPhone,
  slugify,
} from "./domain";

// ------------------------------------------------------------------ ids ----

export const idSchema = z.string().regex(/^[A-Za-z0-9_-]{1,40}$/, "Invalid id");
export const slugSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes only");

export const phoneSchema = z
  .string()
  .min(10)
  .max(20)
  .refine(
    (value) => normalizeNigerianPhone(value) !== null,
    "Use a valid Nigerian number, e.g. 0803 000 0000",
  );

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i, "Enter a valid email address");

export const passwordSchema = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(200)
  .refine((v) => /[a-z]/.test(v) && /[A-Z0-9]/.test(v), "Mix upper and lower case or add a digit");

export const priceMinorSchema = z
  .number()
  .int("Prices are stored in kobo")
  .min(0)
  .max(500_000_000_00, "Price looks unrealistic");

export const nameSchema = z.string().trim().min(2).max(120);
export const shortTextSchema = z.string().trim().min(1).max(200);
export const longTextSchema = (max = 4000) => z.string().trim().max(max);

// ------------------------------------------------------------- envelope ----

export const API_ERROR_CODES = [
  "validation_error",
  "unauthenticated",
  "forbidden",
  "not_found",
  "conflict",
  "rate_limited",
  "payload_too_large",
  "unsupported_media_type",
  "domain_rule",
  "internal_error",
  "dependency_failure",
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
    /** Field-level messages keyed by form path, e.g. `business.name`. */
    fields?: Record<string, string> | undefined;
    requestId?: string | undefined;
    retryAfterSeconds?: number | undefined;
  };
};

export const errorSchema: z.ZodType<ApiError> = z.object({
  error: z.object({
    code: z.enum(API_ERROR_CODES),
    message: z.string(),
    fields: z.record(z.string()).optional(),
    requestId: z.string().optional(),
    retryAfterSeconds: z.number().optional(),
  }),
});

export type PageMeta = { page: number; perPage: number; total: number; totalPages: number };

// ---------------------------------------------------------------- auth ----

export const registerInput = z.object({
  displayName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  role: z.enum(USER_ROLES).extract(["consumer", "owner"]).default("consumer"),
  /** Set when the account is created mid-onboarding so we can skip the marketing opt-in. */
  acceptedTerms: z.boolean().default(false),
  /** Hidden field. Any value is accepted here and answered with a fake success by the
   * handler — rejecting it would tell the bot the control exists. */
  honeypot: z.string().max(200).optional(),
});
export type RegisterInput = z.infer<typeof registerInput>;

export const loginInput = z.object({
  identifier: z.string().trim().min(3).max(254),
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginInput>;

export const requestPasswordResetInput = z.object({ email: emailSchema });
export const resetPasswordInput = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export const verifyEmailInput = z.object({ token: z.string().min(20).max(200) });

export type SessionUser = {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  role: (typeof USER_ROLES)[number];
  emailVerified: boolean;
  status: "active" | "suspended" | "banned";
  createdAt: string;
};

export type SessionResponse = {
  user: SessionUser | null;
  /** Business workspaces the user can open, with their membership role. */
  memberships: {
    businessId: string;
    businessName: string;
    businessSlug: string;
    role: (typeof MEMBERSHIP_ROLES)[number];
    plan: (typeof BUSINESS_PLANS)[number];
    status: string;
  }[];
  csrfToken: string;
};

export const changePasswordInput = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: passwordSchema,
});
export const profileSettingsInput = z.object({
  displayName: nameSchema,
  phone: phoneSchema,
  marketingOptIn: z.boolean().default(false),
  showNameOnReviews: z.boolean().default(true),
  allowBusinessMessaging: z.boolean().default(true),
});
export type ProfileSettingsInput = z.infer<typeof profileSettingsInput>;

// ------------------------------------------------------------ directory ----

export const SORT_OPTIONS = ["relevance", "rating", "reviews", "newest", "response"] as const;
export type DirectorySort = (typeof SORT_OPTIONS)[number];

export const directoryQuery = z.object({
  q: z.string().trim().max(120).optional().or(z.literal("")),
  category: slugSchema.optional(),
  location: slugSchema.optional(),
  area: z.string().trim().max(60).optional(),
  sort: z.enum(SORT_OPTIONS).default("relevance"),
  verified: z.coerce.boolean().optional(),
  openNow: z.coerce.boolean().optional(),
  minRating: z.coerce.number().min(0).max(5).multipleOf(0.5).optional(),
  amenity: z.string().trim().max(40).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  perPage: z.coerce.number().int().min(6).max(48).default(12),
});
export type DirectoryQuery = z.infer<typeof directoryQuery>;

export type BusinessSummary = {
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
  verifiedLevel: (typeof VERIFICATION_LEVELS)[number];
  plan: (typeof BUSINESS_PLANS)[number];
  openNow: boolean;
  contactsGained: number;
  savedCount: number;
  logoMediaId: string | null;
  coverMediaId: string | null;
  amenities: string[];
  whatsapp: string | null;
  responseMinutes: number | null;
};

export type BusinessDetail = BusinessSummary & {
  ownerId: string | null;
  about: string;
  phone: string | null;
  website: string | null;
  socials: { label: string; handle: string; url: string | null }[];
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
    moderation: string;
  }[];
  team: { id: string; name: string; role: string }[];
  claims: { total: number; avg: number; byStar: Record<string, number> };
  publishedAt: string | null;
  savedByViewer: boolean;
};

export type DirectoryResponse = {
  items: BusinessSummary[];
  meta: PageMeta;
  facets: {
    categories: { slug: string; name: string; count: number }[];
    locations: { slug: string; name: string; count: number }[];
    applied: Partial<DirectoryQuery>;
  };
  /** true when the free-text query was too short/unsupported to filter on. */
  ambiguousQuery: boolean;
};

// ---------------------------------------------------------- public forms ----

export const enquiryInput = z.object({
  businessId: idSchema,
  name: nameSchema,
  phone: phoneSchema,
  email: emailSchema.optional().or(z.literal("")),
  need: z.string().trim().min(10).max(2000),
  serviceId: idSchema.optional(),
  budgetMinor: priceMinorSchema.optional(),
  preferredDate: z.string().max(40).optional(),
  /** Hidden field. Any value is accepted here and answered with a fake success by the
   * handler — rejecting it would tell the bot the control exists. */
  honeypot: z.string().max(200).optional(),
  /** Attribution from the entry point (link code, campaign, utm). */
  linkCode: z.string().max(40).optional(),
  source: z.enum(LEAD_SOURCES).default("directory_profile"),
  /** Client-generated per submission so a double click cannot create two leads. */
  idempotencyKey: z.string().min(8).max(64),
});
export type EnquiryInput = z.infer<typeof enquiryInput>;

export const reviewInput = z.object({
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().min(20).max(2000),
  visitDate: z.string().max(40).optional(),
});
export type ReviewInput = z.infer<typeof reviewInput>;

export const reviewReplyInput = z.object({ body: z.string().trim().min(4).max(1200) });

export const reportInput = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: idSchema,
  reason: z.enum(REPORT_REASONS),
  detail: z.string().trim().min(10).max(2000),
  contact: emailSchema.optional().or(z.literal("")),
  /** Hidden field. Any value is accepted here and answered with a fake success by the
   * handler — rejecting it would tell the bot the control exists. */
  honeypot: z.string().max(200).optional(),
});
export type ReportInput = z.infer<typeof reportInput>;

export const suggestBusinessInput = z.object({
  kind: z.enum(["new", "correction", "closed", "duplicate"]),
  businessName: nameSchema,
  categorySlug: slugSchema.optional(),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  address: z.string().trim().min(3).max(300),
  details: z.string().trim().min(10).max(2000),
  listingId: idSchema.optional(),
  contact: emailSchema.optional().or(z.literal("")),
  /** Hidden field. Any value is accepted here and answered with a fake success by the
   * handler — rejecting it would tell the bot the control exists. */
  honeypot: z.string().max(200).optional(),
});
export type SuggestBusinessInput = z.infer<typeof suggestBusinessInput>;

export const claimInput = z.object({
  businessId: idSchema,
  role: z.enum(["owner", "manager", "agent"]),
  note: z.string().trim().min(10).max(2000),
  evidenceMediaType: z.enum(ALLOWED_UPLOAD_TYPES),
  evidenceFileName: z.string().trim().min(1).max(120),
  evidenceSizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
});
export type ClaimInput = z.infer<typeof claimInput>;

export const joinInput = z.object({
  displayName: nameSchema,
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema,
  businessName: nameSchema,
  categorySlug: slugSchema,
  city: shortTextSchema,
  state: shortTextSchema,
});
export type JoinInput = z.infer<typeof joinInput>;

// -------------------------------------------------------------- contact-gain ----

export const roomSummarySchema = {
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  purpose: z.enum(ROOM_PURPOSES),
  houseRule: z.string(),
  state: z.string(),
  verifiedOnly: z.boolean(),
  capacity: z.number(),
  memberCount: z.number(),
  slotsLeft: z.number(),
  status: z.string(),
  avgSaveBack: z.number(),
};
export type RoomSummary = {
  [K in keyof typeof roomSummarySchema]: z.infer<(typeof roomSummarySchema)[K]>;
};

export const roomDetailSchema = z.object({
  room: z.unknown().transform((v) => v as RoomSummary),
  rules: z.array(z.string()),
  members: z.array(
    z.object({
      id: z.string(),
      displayName: z.string(),
      niche: z.string().nullable(),
      role: z.enum(["owner", "moderator", "member"]),
      saveBackScore: z.number(),
      joinedAt: z.string(),
      verified: z.boolean(),
    }),
  ),
  recentActivity: z.array(z.object({ id: z.string(), what: z.string(), at: z.string() })),
  viewer: z
    .object({
      membership: z.enum(["none", "queued", "active", "removed"]).default("none"),
      saveBackScore: z.number(),
    })
    .nullable(),
});
export type RoomDetail = z.infer<typeof roomDetailSchema>;

export const createRoomInput = z.object({
  name: nameSchema,
  purpose: z.enum(ROOM_PURPOSES),
  houseRule: z.string().trim().min(10).max(400),
  state: z
    .enum(["Nationwide", "Lagos", "Abuja", "Rivers", "Oyo", "Kano", "Enugu"])
    .default("Lagos"),
  capacity: z.number().int().min(50).max(5000).default(5000),
  verifiedOnly: z.boolean().default(true),
});
export type CreateRoomInput = z.infer<typeof createRoomInput>;

export const joinRoomInput = z.object({ note: z.string().trim().max(400).optional() });
export const roomActionInput = z.object({
  action: z.enum(["approve", "reject", "remove", "restore"]),
  memberId: idSchema,
  note: z.string().trim().max(400).optional(),
});

export const saveBackCheckinInput = z.object({
  savedContacts: z.number().int().min(0).max(500).default(0),
});

// ---------------------------------------------------------------- media ----

export const uploadIntentInput = z.object({
  kind: z.enum(MEDIA_KINDS),
  fileName: z.string().trim().min(1).max(120),
  contentType: z.enum(ALLOWED_UPLOAD_TYPES),
  sizeBytes: z.number().int().min(1).max(MAX_UPLOAD_BYTES),
  alt: z.string().trim().max(200).optional(),
  label: z.string().trim().max(120).optional(),
});
export type UploadIntentInput = z.infer<typeof uploadIntentInput>;

export type UploadTicket = {
  mediaId: string;
  method: "PUT";
  url: string;
  headers: Record<string, string>;
  expiresAt: string;
  maxSizeBytes: number;
};

export const mediaConfirmInput = z.object({
  mediaId: idSchema,
  /** sha256 hex of the uploaded bytes, from the browser (best effort). */
  checksum: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
});

// ------------------------------------------------------------------ crm ----

export const leadInput = z.object({
  name: nameSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  stage: z.enum(LEAD_STAGES).default("new"),
  valueMinor: priceMinorSchema.optional(),
  source: z.enum(LEAD_SOURCES).default("manual"),
  note: longTextSchema(2000).optional(),
  ownerId: idSchema.optional(),
  priority: z.enum(LEAD_PRIORITIES).optional(),
});
export type LeadInput = z.infer<typeof leadInput>;

export const leadUpdateInput = leadInput.partial().omit({ stage: true });

export const leadStageInput = z.object({
  stage: z.enum(LEAD_STAGES),
  note: longTextSchema(1000).optional(),
  lostReason: z.string().trim().max(200).optional(),
});
export type LeadStageInput = z.infer<typeof leadStageInput>;

export type LeadDto = {
  id: string;
  code: string;
  businessId: string;
  name: string;
  phone: string | null;
  email: string | null;
  stage: (typeof LEAD_STAGES)[number];
  score: number;
  valueMinor: number | null;
  source: (typeof LEAD_SOURCES)[number];
  priority: (typeof LEAD_PRIORITIES)[number] | null;
  assigneeUserId: string | null;
  assigneeName: string | null;
  enquiryId: string | null;
  contactId: string | null;
  note: string | null;
  lastActivityAt: string | null;
  createdAt: string;
  updatedAt: string;
  wonAt: string | null;
  lostReason: string | null;
  history: {
    id: string;
    fromStage: string | null;
    toStage: string;
    at: string;
    actor: string | null;
    note: string | null;
  }[];
};

export const contactInput = z.object({
  name: nameSchema,
  phone: phoneSchema.optional().or(z.literal("")),
  email: emailSchema.optional().or(z.literal("")),
  notes: longTextSchema(2000).optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(12).default([]),
});
export type ContactInput = z.infer<typeof contactInput>;

export const taskInput = z.object({
  title: z.string().trim().min(3).max(200),
  dueAt: z.string().max(40).optional(),
  priority: z.enum(LEAD_PRIORITIES).default("medium"),
  leadId: idSchema.optional(),
  assigneeUserId: idSchema.optional(),
});
export type TaskInput = z.infer<typeof taskInput>;

export const automationInput = z.object({
  trigger: z.enum([
    "new_enquiry",
    "lead_stale",
    "quote_requested",
    "review_published",
    "listing_reported",
  ]),
  action: z.enum(["create_task", "notify_owner", "assign_round_robin", "tag_contact"]),
  config: z.object({ hours: z.number().int().min(1).max(720).optional() }).default({}),
  enabled: z.boolean().default(true),
});
export type AutomationInput = z.infer<typeof automationInput>;

export const teamInviteInput = z.object({
  email: emailSchema,
  role: z.enum(MEMBERSHIP_ROLES).extract(["manager", "agent", "marketing"]),
});
export type TeamInviteInput = z.infer<typeof teamInviteInput>;

// ------------------------------------------------------------- workspace ----

export const businessProfileInput = z.object({
  name: nameSchema,
  tagline: z.string().trim().min(8).max(140),
  about: z.string().trim().min(40).max(4000),
  categorySlug: slugSchema,
  city: shortTextSchema,
  area: z.string().trim().max(60).optional().or(z.literal("")),
  state: shortTextSchema,
  address: z.string().trim().max(300).optional().or(z.literal("")),
  phone: phoneSchema.optional().or(z.literal("")),
  whatsapp: phoneSchema.optional().or(z.literal("")),
  website: z
    .string()
    .trim()
    .max(300)
    .refine(
      (v) => v === "" || /^https?:\/\/[^\s]+\.[a-z]{2,}/i.test(v),
      "Use a full URL starting with https://",
    )
    .optional(),
  instagram: z.string().trim().max(60).optional().or(z.literal("")),
  tiktok: z.string().trim().max(60).optional().or(z.literal("")),
  amenities: z.array(z.string().trim().min(2).max(40)).max(12).default([]),
  serviceAreas: z.array(z.string().trim().min(2).max(60)).max(12).default([]),
  responseMinutes: z.number().int().min(1).max(2880).optional(),
  hours: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        opens: z
          .string()
          .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
          .optional()
          .or(z.literal("")),
        closes: z
          .string()
          .regex(/^([01]?\d|2[0-3]):[0-5]\d$/)
          .optional()
          .or(z.literal("")),
        closed: z.boolean().default(false),
      }),
    )
    .max(7)
    .default([]),
});
export type BusinessProfileInput = z.infer<typeof businessProfileInput>;

/**
 * The console saves one card at a time (basics, contact, hours), so a profile write may
 * carry any subset of the document. Each field keeps its own rules; the Worker merges the
 * rest from the stored row, so a partial save can never blank an untouched field.
 */
export const businessProfilePatchInput = businessProfileInput
  .partial()
  .extend({
    /** A full-document save (the onboarding wizard) sets this to skip the merge. */
    replace: z.boolean().default(false),
  })
  .refine((value) => Object.keys(value).some((key) => key !== "replace"), {
    message: "Send at least one field to change.",
  });
export type BusinessProfilePatchInput = z.infer<typeof businessProfilePatchInput>;

export const catalogItemInput = z.object({
  name: z.string().trim().min(2).max(120),
  priceMinor: priceMinorSchema.optional(),
  note: z.string().trim().max(200).optional().or(z.literal("")),
  tag: z.string().trim().max(30).optional().or(z.literal("")),
  active: z.boolean().default(true),
});
export type CatalogItemInput = z.infer<typeof catalogItemInput>;

export const linkInput = z.object({
  label: z.string().trim().min(2).max(60),
  kind: z.enum(["whatsapp", "qr", "profile", "campaign"]),
  targetUrl: z
    .string()
    .trim()
    .max(500)
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => v === undefined || v === "" || /^https?:\/\/[^\s]+$/.test(v),
      "Use a full URL starting with https://",
    ),
  campaignId: idSchema.optional(),
  message: z.string().trim().max(300).optional(),
});
export type LinkInput = z.infer<typeof linkInput>;

export const campaignInput = z.object({
  name: z.string().trim().min(3).max(80),
  channel: z.enum(["whatsapp_link", "qr", "campaign_link", "room", "print"]),
  budgetMinor: priceMinorSchema.optional(),
  status: z.enum(["draft", "live", "paused", "ended"]).default("draft"),
  startsAt: z.string().max(40).optional(),
  endsAt: z.string().max(40).optional(),
});
export type CampaignInput = z.infer<typeof campaignInput>;

export const billingChangeInput = z.object({
  plan: z.enum(BUSINESS_PLANS),
  idempotencyKey: z.string().min(8).max(64),
});

export const workspaceLeadQuery = z.object({
  stage: z.enum(LEAD_STAGES).optional(),
  q: z.string().trim().max(80).optional(),
  assignee: z.enum(["me", "unassigned", "all"]).default("all"),
  sort: z.enum(["recent", "score", "value"]).default("recent"),
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(5).max(50).default(20),
});
export type WorkspaceLeadQuery = z.infer<typeof workspaceLeadQuery>;

export const analyticsQuery = z.object({
  days: z.coerce.number().int().min(7).max(180).default(30),
});

export type WorkspaceSummary = {
  business: {
    id: string;
    name: string;
    slug: string;
    plan: (typeof BUSINESS_PLANS)[number];
    status: string;
  };
  role: (typeof MEMBERSHIP_ROLES)[number];
  metrics: {
    contactsGained: number;
    contactsGainedDelta: number;
    newLeads: number;
    newLeadsDelta: number;
    avgReplyMinutes: number | null;
    wonValueMinor: number;
    openTasks: number;
    unassignedLeads: number;
    profileCompleteness: number;
  };
  trend: { date: string; contacts: number; leads: number; enquiries: number }[];
  sources: { source: (typeof LEAD_SOURCES)[number]; count: number; share: number }[];
  stages: { stage: (typeof LEAD_STAGES)[number]; count: number }[];
  attention: { id: string; kind: string; label: string; detail: string; href: string }[];
};

export type WorkspaceStats = {
  totalViews: number;
  totalEnquiries: number;
  totalLeads: number;
  conversionRate: number;
  sources: { source: (typeof LEAD_SOURCES)[number]; count: number; leads: number; share: number }[];
  days: { date: string; views: number; enquiries: number; leads: number; contacts: number }[];
};

export type WorkspaceSettings = {
  notificationPrefs: {
    newEnquiry: boolean;
    newReview: boolean;
    leadStale: boolean;
    weeklyDigest: boolean;
  };
  enquiryForm: { enabled: boolean; requirePhone: boolean; autoAckMessage: string | null };
  visibility: { hidePhone: boolean };
};

// ---------------------------------------------------------------- admin ----

export const adminUserQuery = z.object({
  q: z.string().trim().max(80).optional(),
  role: z.enum(USER_ROLES).optional(),
  status: z.enum(["active", "suspended", "banned"]).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  perPage: z.coerce.number().int().min(5).max(100).default(25),
});

export const adminUserStatusInput = z.object({
  status: z.enum(["active", "suspended", "banned"]),
  reason: z.string().trim().min(5).max(500),
});

export const adminBusinessInput = z.object({
  action: z.enum([
    "publish",
    "hide",
    "suspend",
    "restore",
    "feature",
    "unfeature",
    "verify_documents",
    "verify_premium",
  ]),
  note: z.string().trim().max(500).optional(),
});

export const moderationDecisionInput = z.object({
  decision: z.enum(["approve", "reject", "remove"]),
  note: z.string().trim().max(500).optional(),
  notifyOwner: z.boolean().default(true),
});
export type ModerationDecisionInput = z.infer<typeof moderationDecisionInput>;

export const REPORT_ACTION_TYPES = [
  "none",
  "warning",
  "content_hidden",
  "suspend_user",
  "ban_user",
  "dismiss",
] as const;
export type ReportActionType = (typeof REPORT_ACTION_TYPES)[number];

export const reportResolutionInput = z.object({
  status: z.enum(["reviewing", "actioned", "dismissed"]),
  action: z.enum(REPORT_ACTION_TYPES).default("none"),
  note: z.string().trim().min(5).max(500),
});
export type ReportResolutionInput = z.infer<typeof reportResolutionInput>;

export const claimDecisionInput = z.object({
  decision: z.enum(["approve", "reject", "contest"]),
  note: z.string().trim().min(5).max(500),
});
export type ClaimDecisionInput = z.infer<typeof claimDecisionInput>;

export const categoryInput = z.object({
  name: nameSchema,
  slug: slugSchema.optional(),
  icon: z.string().trim().max(40).default("Store"),
  description: z.string().trim().max(400).optional().or(z.literal("")),
  checklist: z.array(z.string().trim().min(3).max(120)).max(10).default([]),
  requiredMedia: z.array(z.enum(MEDIA_KINDS)).max(8).default([]),
  sort: z.number().int().min(0).max(999).default(100),
});
export type CategoryInput = z.infer<typeof categoryInput>;

export const ticketUpdateInput = z.object({
  status: z.enum(["open", "waiting", "resolved", "closed"]),
  reply: z.string().trim().min(2).max(2000),
  priority: z.enum(LEAD_PRIORITIES).optional(),
});
export type TicketUpdateInput = z.infer<typeof ticketUpdateInput>;

export const flagInput = z.object({
  key: z
    .string()
    .trim()
    .regex(/^[a-z0-9_.-]{2,60}$/),
  enabled: z.boolean(),
  description: z.string().trim().max(200).optional(),
  rolloutPercent: z.number().int().min(0).max(100).default(100),
});
export type FlagInput = z.infer<typeof flagInput>;

export const configInput = z
  .object({
    maintenance: z
      .object({ enabled: z.boolean(), message: z.string().trim().min(3).max(300) })
      .nullable()
      .optional(),
    moderation: z
      .object({
        slaHours: z.number().int().min(1).max(336),
        autoHideRisk: z.enum(["low", "medium", "high"]),
      })
      .optional(),
    verification: z.object({ slaHours: z.number().int().min(1).max(336) }).optional(),
    signup: z
      .object({ requireEmailVerification: z.boolean().optional(), closed: z.boolean().optional() })
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: "Nothing to update." });
export type ConfigInput = z.infer<typeof configInput>;

export type AdminStats = {
  businesses: {
    total: number;
    published: number;
    draft: number;
    suspended: number;
    newThisMonth: number;
  };
  users: { total: number; consumers: number; owners: number; suspended: number };
  trust: {
    pendingVerifications: number;
    openReports: number;
    highRiskReports: number;
    pendingClaims: number;
  };
  engagement: { views7d: number; enquiries7d: number; chats7d: number; reviews7d: number };
  revenue: { mrrMinor: number; payingBusinesses: number; byPlan: Record<string, number> };
  queues: { name: string; items: number; oldestHours: number | null }[];
  trend: { date: string; views: number; enquiries: number; signups: number }[];
};

export type SitemapEntry = {
  path: string;
  lastmod?: string;
  changefreq?: "daily" | "weekly" | "monthly";
  priority?: number;
};

// ---------------------------------------------------------------- misc ----

export const ENQUIRY_STATUS_VALUES = ENQUIRY_STATUSES;
export const VERIFICATION_VALUES = VERIFICATION_LEVELS;

export function makeSlug(input: string): string {
  return slugify(input) || "business";
}

export const enquiryStatusInput = z.object({ status: z.enum(ENQUIRY_STATUSES) });
