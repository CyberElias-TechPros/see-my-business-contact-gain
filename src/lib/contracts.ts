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

export const dataRequestSchema = z.object({
  kind: z.enum(["access", "portability", "correction", "deletion"]),
  details: z.string().trim().max(1_000).optional().default(""),
});

export const saveBusinessSchema = z.object({
  businessId: z.string().uuid(),
  saved: z.boolean(),
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
  services?: Array<{ id: string; name: string; price: string; note: string }>;
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
