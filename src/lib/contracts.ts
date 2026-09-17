import { z } from "zod";

export const TERMS_VERSION = "2026-09-12";

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional().default("");

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const phoneSchema = z
  .string()
  .trim()
  .min(7)
  .max(24)
  .regex(/^[+\d][\d\s().-]+$/, "Enter a valid phone number");
export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number");
export const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

export const registerSchema = z
  .object({
    fullName: trimmed(2, 100),
    email: z
      .union([emailSchema, z.literal("")])
      .optional()
      .default(""),
    phone: z
      .union([phoneSchema, z.literal("")])
      .optional()
      .default(""),
    password: passwordSchema,
    acceptedTerms: z.literal(true),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Add an email address or phone number",
    path: ["email"],
  });

export const loginSchema = z.object({
  identity: trimmed(3, 254),
  password: z.string().min(1).max(128),
});

const queryBoolean = z.preprocess(
  (value) => value === true || value === "true" || value === "1",
  z.boolean(),
);

export const directoryQuerySchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  category: slugSchema.optional(),
  location: slugSchema.optional(),
  verified: queryBoolean.optional().default(false),
  openNow: queryBoolean.optional().default(false),
  minRating: z.coerce.number().min(0).max(5).optional().default(0),
  sort: z.enum(["relevance", "rating", "name", "recent"]).optional().default("relevance"),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(24).optional().default(12),
});

export const listingApplicationSchema = z.object({
  ownerName: trimmed(2, 100),
  email: emailSchema,
  businessName: trimmed(2, 120),
  tagline: trimmed(8, 160),
  categorySlug: slugSchema,
  locationSlug: slugSchema,
  address: trimmed(5, 220),
  whatsapp: phoneSchema,
  phone: z
    .union([phoneSchema, z.literal("")])
    .optional()
    .default(""),
  website: z
    .union([z.string().trim().url().max(300), z.literal("")])
    .optional()
    .default(""),
  about: trimmed(40, 2_000),
  acceptedTerms: z.literal(true),
  company: z.string().max(0).optional().default(""),
});

export const enquirySchema = z.object({
  businessId: z.string().uuid(),
  name: trimmed(2, 100),
  phone: phoneSchema,
  message: trimmed(20, 1_500),
  consent: z.literal(true),
});

export const reviewSchema = z.object({
  businessId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  body: trimmed(20, 1_500),
});

/** Editing a review re-submits it, so the same bounds apply as on first write. */
export const reviewUpdateSchema = z.object({
  rating: z.coerce.number().int().min(1).max(5),
  body: trimmed(20, 1_500),
});

export const enquiryStatusSchema = z.object({
  status: z.enum(["new", "contacted", "qualified", "closed", "spam"]),
});

export const suggestionSchema = z.object({
  type: z.enum(["new", "correction", "closed", "duplicate"]),
  categorySlug: slugSchema.optional(),
  businessName: trimmed(2, 120),
  phone: z
    .union([phoneSchema, z.literal("")])
    .optional()
    .default(""),
  address: optionalTrimmed(220),
  details: trimmed(20, 2_000),
  contactEmail: z
    .union([emailSchema, z.literal("")])
    .optional()
    .default(""),
  company: z.string().max(0).optional().default(""),
});

export const reportSchema = z.object({
  targetType: z.enum(["business", "review", "room", "member", "other"]),
  targetId: trimmed(1, 100),
  reason: z.enum(["scam", "impersonation", "incorrect", "closed", "abuse", "other"]),
  details: trimmed(20, 2_000),
  contactEmail: z
    .union([emailSchema, z.literal("")])
    .optional()
    .default(""),
  company: z.string().max(0).optional().default(""),
});

export const roomProposalSchema = z.object({
  name: trimmed(3, 100),
  purpose: z.enum(["business", "niche", "network"]),
  state: trimmed(2, 80),
  slotLimit: z.coerce.number().int().min(20).max(5_000),
  rules: trimmed(30, 2_000),
  verifiedOnly: z.boolean().default(true),
});

export const roomApplicationSchema = z.object({
  roomId: z.string().uuid(),
  businessId: z.string().uuid(),
  acceptedRules: z.literal(true),
});

/**
 * A circle owner admitting or declining a join request. The note is optional and
 * is only surfaced to the applicant on a decline, so a rejection can explain
 * itself instead of arriving as a silent status change.
 */
export const roomApplicationDecisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().trim().max(400).optional().default(""),
});

export const dataRequestSchema = z.object({
  kind: z.enum(["access", "portability", "correction", "deletion"]),
  details: z.string().trim().max(1_000).optional().default(""),
});

export const saveBusinessSchema = z.object({
  businessId: z.string().uuid(),
  saved: z.boolean(),
});

/* -------------------------------------------------------------------------- */
/* Opening hours                                                              */
/* -------------------------------------------------------------------------- */

/** `HH:MM` in Africa/Lagos, zero-padded. `closesAt <= opensAt` means overnight. */
const timeOfDay = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a 24-hour HH:MM time");

export const businessHoursEntrySchema = z.object({
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  isClosed: z.boolean().default(false),
  opensAt: timeOfDay.default("09:00"),
  closesAt: timeOfDay.default("18:00"),
});

export const businessHoursSchema = z.array(businessHoursEntrySchema).max(7).default([]);

/* -------------------------------------------------------------------------- */
/* Account management                                                          */
/* -------------------------------------------------------------------------- */

export const forgotPasswordSchema = z.object({
  identity: trimmed(3, 254),
});

export const resetPasswordSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});

export const updateProfileSchema = z
  .object({
    fullName: trimmed(2, 100),
    email: z
      .union([emailSchema, z.literal("")])
      .optional()
      .default(""),
    phone: z
      .union([phoneSchema, z.literal("")])
      .optional()
      .default(""),
  })
  .refine((value) => Boolean(value.email || value.phone), {
    message: "Keep at least an email address or phone number",
    path: ["email"],
  });

/* -------------------------------------------------------------------------- */
/* Owner listing management                                                    */
/* -------------------------------------------------------------------------- */

export const updateBusinessSchema = z.object({
  businessId: z.string().uuid(),
  tagline: trimmed(8, 160),
  about: trimmed(40, 2_000),
  whatsapp: phoneSchema,
  phone: z
    .union([phoneSchema, z.literal("")])
    .optional()
    .default(""),
  website: z
    .union([z.string().trim().url().max(300), z.literal("")])
    .optional()
    .default(""),
  address: trimmed(5, 220),
  priceRange: z.enum(["", "₦", "₦₦", "₦₦₦"]).optional().default(""),
  amenities: z.array(z.string().trim().min(2).max(60)).max(24).optional().default([]),
  serviceAreas: z.array(z.string().trim().min(2).max(80)).max(24).optional().default([]),
  socials: z
    .array(
      z.object({
        label: z.string().trim().min(2).max(40),
        handle: z.string().trim().min(2).max(120),
      }),
    )
    .max(8)
    .optional()
    .default([]),
  hours: businessHoursSchema.optional().default([]),
  services: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(120),
        price: z.string().trim().max(60).optional().default(""),
        note: z.string().trim().max(200).optional().default(""),
      }),
    )
    .max(24)
    .optional()
    .default([]),
});

export const notificationsReadSchema = z.object({
  ids: z.array(z.string().uuid()).max(200).optional(),
  all: z.boolean().optional().default(false),
});

export const moderationActionSchema = z.object({
  queue: z.enum([
    "listing_applications",
    "claims",
    "reports",
    "reviews",
    "rooms",
    "room_applications",
    "suggestions",
    "data_requests",
  ]),
  id: z.string().uuid(),
  action: z.enum([
    "start_review",
    "approve",
    "reject",
    "resolve",
    "dismiss",
    "mark_verifying",
    "mark_processing",
    "complete",
    "contest",
  ]),
  note: z.string().trim().max(1_000).optional().default(""),
});

export type DirectoryQuery = z.infer<typeof directoryQuerySchema>;
export type ListingApplicationInput = z.infer<typeof listingApplicationSchema>;
export type EnquiryInput = z.infer<typeof enquirySchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
export type SuggestionInput = z.infer<typeof suggestionSchema>;
export type ReportInput = z.infer<typeof reportSchema>;
export type RoomProposalInput = z.infer<typeof roomProposalSchema>;

export type BusinessHoursEntry = {
  dayOfWeek: number;
  isClosed: boolean;
  opensAt: string;
  closesAt: string;
};

export type PublicBusinessHours = BusinessHoursEntry & {
  /** Local (Africa/Lagos) label, e.g. "Monday". */
  label: string;
};

export type PublicBusiness = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  about: string;
  categorySlug: string;
  categoryName: string;
  locationSlug: string;
  city: string;
  state: string;
  address: string;
  rating: number;
  reviewCount: number;
  verificationLevel: "unverified" | "email" | "phone" | "documents" | "premium";
  openNow: boolean;
  whatsapp: string;
  phone: string;
  website: string;
  priceRange: string;
  amenities: string[];
  serviceAreas: string[];
  socials: Array<{ label: string; handle: string }>;
  hours: PublicBusinessHours[];
  yearEstablished: number | null;
  teamSize: string;
  services?: Array<{ id: string; name: string; price: string; note: string }>;
};

export type PublicReview = {
  id: string;
  rating: number;
  body: string;
  createdAt: string;
  authorName: string;
};

export type MyReview = {
  id: string;
  rating: number;
  body: string;
  status: "pending" | "published" | "rejected" | "disputed";
  createdAt: string;
  updatedAt: string;
  editedAt: string | null;
};

export type ReviewListResponse = {
  items: PublicReview[];
  summary: { average: number; total: number; distribution: Record<1 | 2 | 3 | 4 | 5, number> };
  /**
   * The signed-in reader's own review of this business, in any moderation state.
   * `null` when anonymous or when they have not reviewed it. Without this the
   * interface cannot tell "you have not reviewed this" apart from "your review
   * is still pending", which is exactly the confusion the review gap describes.
   */
  mine: MyReview | null;
};

export type SearchSuggestion = {
  type: "business" | "category" | "location" | "service";
  label: string;
  hint: string;
  href: string;
};

export type AppNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

export type NotificationList = {
  items: AppNotification[];
  unreadCount: number;
};

export type BusinessInsights = {
  range: { from: string; to: string };
  totals: {
    contacts: number;
    uniqueVisitors: number;
    enquiries: number;
    whatsapp: number;
    phone: number;
    website: number;
    directions: number;
  };
  byChannel: Array<{ channel: string; count: number }>;
  byDay: Array<{ date: string; contacts: number; enquiries: number }>;
  byBusiness: Array<{
    id: string;
    name: string;
    slug: string;
    contacts: number;
    uniqueVisitors: number;
    enquiries: number;
    reviews: number;
    rating: number;
    savedBy: number;
  }>;
  recentContacts: Array<{ channel: string; businessName: string; createdAt: string }>;
};

/** One circle the signed-in user owns, with the join requests waiting on them. */
export type OwnedCircle = {
  id: string;
  name: string;
  purpose: "business" | "niche" | "network";
  state: string;
  status: string;
  memberCount: number;
  queuedCount: number;
  slotLimit: number;
};

/** A join request sitting in an owned circle's queue. */
export type CircleQueueItem = {
  id: string;
  roomId: string;
  roomName: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  applicantName: string;
  createdAt: string;
};

/** A circle the signed-in user has applied to, in any state. */
export type JoinedCircle = {
  id: string;
  roomId: string;
  status: "queued" | "approved" | "rejected" | "left" | "removed";
  roomName: string;
  roomStatus: string;
  businessId: string;
  businessName: string;
  businessSlug: string;
  createdAt: string;
};

export type MyCirclesResponse = {
  owned: OwnedCircle[];
  queue: CircleQueueItem[];
  applications: JoinedCircle[];
};

export type DirectoryResponse = {
  items: PublicBusiness[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    pages: number;
  };
};

export type SessionUser = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: "consumer" | "business_owner" | "platform_admin";
};

export type ApiErrorPayload = {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
  requestId: string;
};

export type ApiSuccess<T> = { data: T; requestId: string };
