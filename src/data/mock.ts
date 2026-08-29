import raw from "./dataset.json";

import type {
  Ad,
  AuditEntry,
  Automation,
  Business,
  Campaign,
  Category,
  Claim,
  ConfigEntry,
  Contact,
  Conversation,
  Flag,
  Invoice,
  Job,
  Lead,
  LocationEntry,
  ModerationItem,
  Report,
  Review,
  Room,
  RoomActivity,
  RoomMember,
  Suggestion,
  Task,
  TeamMember,
  Ticket,
  TrackedLink,
  TrendPoint,
  SourceSlice,
  User,
} from "@/lib/types";

/**
 * Canonical demo dataset. This file is the *typed* view over
 * `src/data/dataset.json`, which is also the seed source for the Cloudflare
 * Worker backend (`backend/scripts/generate-seed.mjs`). Everything the app
 * renders in demo mode comes from here.
 */
export const dataset = raw as unknown as {
  users: (User & { password: string })[];
  categories: Category[];
  locations: LocationEntry[];
  businesses: Business[];
  reviews: Review[];
  rooms: Room[];
  roomMembers: RoomMember[];
  roomActivity: RoomActivity[];
  leads: Lead[];
  contacts: Contact[];
  conversations: Conversation[];
  tasks: Task[];
  campaigns: Campaign[];
  links: TrackedLink[];
  automations: Automation[];
  teamMembers: TeamMember[];
  auditLog: AuditEntry[];
  claims: Claim[];
  moderation: ModerationItem[];
  reports: Report[];
  suggestions: Suggestion[];
  tickets: Ticket[];
  invoices: Invoice[];
  ads: Ad[];
  flags: Flag[];
  config: ConfigEntry[];
  jobs: Job[];
  savedByUser: Record<string, string[]>;
  enquiries: unknown[];
  dataRequests: unknown[];
  events: unknown[];
  trendData: TrendPoint[];
  sourceData: SourceSlice[];
};

export const demoUsers = dataset.users;
export const businesses: Business[] = dataset.businesses;
export const categories = dataset.categories;
export const locations = dataset.locations;
export const contactGainRooms = dataset.rooms;
export const leads = dataset.leads;
export const pipelineStages = [
  "New",
  "Qualified",
  "Quotation",
  "Follow up",
  "Won",
  "Lost",
] as const;
export const conversations = dataset.conversations;
export const tasks = dataset.tasks;
export const campaigns = dataset.campaigns;
export const contactLinks = dataset.links;
export const automations = dataset.automations;
export const teamMembers = dataset.teamMembers;
export const auditLog = dataset.auditLog;
export const adminUsers = dataset.users;
export const claims = dataset.claims;
export const moderationQueue = dataset.moderation;
export const reviews = dataset.reviews;
export const tickets = dataset.tickets;
export const invoices = dataset.invoices;
export const trendData = dataset.trendData;
export const sourceData = dataset.sourceData;

export const defaultHours = [
  { day: "Monday", open: "8:00 AM – 6:00 PM" },
  { day: "Tuesday", open: "8:00 AM – 6:00 PM" },
  { day: "Wednesday", open: "8:00 AM – 6:00 PM" },
  { day: "Thursday", open: "8:00 AM – 6:00 PM" },
  { day: "Friday", open: "8:00 AM – 7:00 PM" },
  { day: "Saturday", open: "9:00 AM – 4:00 PM" },
  { day: "Sunday", open: "Closed" },
];

/** Best-effort synchronous lookup used for SSR `<head>` metadata only. */
export const peekBusiness = (id: string): Business | undefined =>
  businesses.find((b) => b.id === id);
