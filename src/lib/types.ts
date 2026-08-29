/**
 * Shared domain types used by both the frontend and (mirrored in Go-free TS)
 * the Cloudflare Worker backend. The canonical demo dataset lives in
 * `src/data/dataset.json`; the backend seeds D1 from the same file.
 */

export type VerificationLevel = "unverified" | "email" | "phone" | "documents" | "premium";
export type Plan = "Free" | "Growth" | "Pro";
export type LeadStage = "New" | "Qualified" | "Quotation" | "Follow up" | "Won" | "Lost";

export type Social = { label: string; handle: string };
export type Service = { name: string; price: string; note: string };
export type Product = { name: string; price: string; tag: string };
export type GalleryItem = { label: string; kind: string };
export type TeamMemberEntry = { name: string; role: string };
export type HourRow = { day: string; open: string };

export type Business = {
  id: string;
  ownerId: string | null;
  name: string;
  tagline: string;
  about: string;
  categorySlug: string;
  categoryName?: string;
  city: string;
  state: string;
  address: string;
  rating: number;
  reviewsCount: number;
  verified: VerificationLevel;
  openNow: boolean;
  whatsapp: string;
  phone: string;
  website: string;
  socials: Social[];
  services: Service[];
  products: Product[];
  amenities: string[];
  serviceAreas: string[];
  gallery: GalleryItem[];
  team: TeamMemberEntry[];
  plan: Plan;
  contactsGained: number;
  savedBy: number;
  featured: boolean;
  responseMinutes: number;
  ts: number; // minutes ago the record was created/updated
  cover: string;
  hours?: HourRow[];
};

export type Category = { slug: string; name: string; icon: string; count: number };
export type LocationEntry = { slug: string; name: string; areas: string[]; count: number };

export type User = {
  id: string;
  email: string;
  phone?: string | null;
  name: string;
  role: "user" | "owner" | "admin";
  status: string;
  whatsapp?: string | null;
  ts: number;
};

export type Review = {
  id: string;
  businessId: string;
  author: string;
  rating: number;
  body: string;
  status: string;
  ts: number;
};

export type Room = {
  id: string;
  name: string;
  purpose: string;
  members: number;
  slots: number;
  slotsLeft?: number;
  rule: string;
  verifiedOnly: boolean;
  state: string;
  status: string;
  ownerId: string | null;
  ts: number;
};

export type RoomMember = { roomId: string; name: string; niche: string; saveBack: number };
export type RoomActivity = { id?: string; roomId: string; text: string; ts: number };

export type Lead = {
  id: string;
  businessId: string;
  name: string;
  source: string;
  channel: string;
  stage: LeadStage;
  value: string;
  agent: string;
  score: number;
  ts: number;
};

export type Contact = {
  id: string;
  businessId: string;
  name: string;
  phone: string;
  email?: string;
  tags: string[];
  source: string;
  ts: number;
};

export type Message = { from: "business" | "contact"; body: string; ts: number };

export type Conversation = {
  id: string;
  businessId: string;
  name: string;
  last: string;
  unread: number;
  tag: string;
  assigned: string;
  ts: number;
  messages?: Message[];
};

export type Task = {
  id: string;
  businessId: string;
  title: string;
  due: string;
  owner: string;
  priority: "High" | "Medium" | "Low";
  done: boolean;
  ts: number;
};

export type Campaign = {
  id: string;
  businessId: string;
  name: string;
  channel: string;
  scans: number;
  leads: number;
  cost: string;
  cpl: string;
  status: string;
  ts: number;
};

export type TrackedLink = {
  id: string;
  businessId: string;
  label: string;
  code: string;
  url: string;
  scans: number;
  source: string;
  ts: number;
};

export type Automation = {
  id: string;
  businessId: string;
  trigger: string;
  action: string;
  runs: number;
  status: "Active" | "Paused";
  ts: number;
};

export type TeamMember = {
  id: string;
  businessId: string;
  name: string;
  email: string;
  role: string;
  status: string;
  ts: number;
};

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  businessId?: string | null;
  ts: number;
};

export type Claim = {
  id: string;
  businessId: string | null;
  businessName: string;
  claimant: string;
  role: string;
  contact: string;
  evidence: string;
  notes: string;
  status: string;
  ts: number;
};

export type ModerationItem = {
  id: string;
  type: string;
  item: string;
  reason: string;
  risk: string;
  status: string;
  ts: number;
};

export type Report = {
  id: string;
  targetType: string;
  targetLabel: string;
  reason: string;
  details: string;
  contact: string;
  status: string;
  risk: string;
  ts: number;
};

export type Suggestion = {
  id: string;
  type: string;
  categorySlug: string;
  name: string;
  contact: string;
  address: string;
  details: string;
  status: string;
  ts: number;
};

export type Ticket = {
  id: string;
  subject: string;
  user: string;
  priority: string;
  status: string;
  ts: number;
};
export type Invoice = {
  id: string;
  businessId: string;
  plan: string;
  amount: string;
  status: string;
  ts: number;
};
export type Ad = {
  id: string;
  advertiser: string;
  inventory: string;
  spend: string;
  chats: number;
  status: string;
  ts: number;
};
export type Flag = {
  key: string;
  rollout: string;
  audience: string;
  status: string;
  description: string;
  enabled: boolean;
  ts: number;
};
export type ConfigEntry = { key: string; value: string; notes: string };
export type Job = {
  id: string;
  name: string;
  schedule: string;
  lastRun: string;
  status: string;
  output: string;
};

export type TrendPoint = { label: string; contacts: number; leads: number };
export type SourceSlice = { label: string; value: number };

export type WorkspaceSummary = {
  stats: { label: string; value: string; delta?: string; hint?: string }[];
  trend: TrendPoint[];
  sources: SourceSlice[];
  latestLeads: Lead[];
};

export type SearchParams = {
  q?: string | undefined;
  category?: string | undefined;
  location?: string | undefined;
  area?: string | undefined;
  minRating?: number | undefined;
  openNow?: boolean | undefined;
  verifiedOnly?: boolean | undefined;
  delivery?: boolean | undefined;
  card?: boolean | undefined;
  homeService?: boolean | undefined;
  sort?: "relevance" | "rating" | "response" | "nearest" | "contacts" | undefined;
  page?: number | undefined;
  pageSize?: number | undefined;
};

export type SearchResult = {
  items: Business[];
  total: number;
  page: number;
  pages: number;
  pageSize: number;
};

export type PublicMeta = {
  categories: Category[];
  locations: LocationEntry[];
  stats: { businesses: number; chats: string; states: number };
};

export type RoomDetail = Omit<Room, "members"> & {
  members: RoomMember[];
  activity: RoomActivity[];
  joined?: boolean;
};
