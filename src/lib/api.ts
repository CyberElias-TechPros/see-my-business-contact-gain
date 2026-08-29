import { dataset, defaultHours, peekBusiness } from "@/data/mock";
import type {
  Ad,
  AddToListResult,
  AuditEntry,
  Automation,
  Business,
  Campaign,
  Category,
  Claim,
  ConfigEntry,
  Contact,
  ContactList,
  Conversation,
  Flag,
  Invoice,
  Job,
  Lead,
  ListMember,
  ListStatus,
  Message,
  ModerationItem,
  PersonListing,
  PublicMeta,
  Report,
  Review,
  Room,
  RoomDetail,
  SearchParams,
  SearchResult,
  SourceSlice,
  Suggestion,
  Task,
  TeamMember,
  Ticket,
  TrackedLink,
  TrendPoint,
  User,
  WorkspaceSummary,
} from "@/lib/types";

/**
 * Backend transport.
 *
 * - If `VITE_API_URL` is set, every call goes to the Cloudflare Worker API.
 * - Otherwise the client probes `/api/health` (same-origin dev proxy or a
 *   Vercel rewrite). If that fails, the app transparently switches to the
 *   bundled demo backend (localStorage) so it is never broken.
 */

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const API_BASE: string =
  (import.meta.env as Record<string, string | undefined>)["VITE_API_URL"]?.replace(/\/$/, "") ?? "";

export type BackendMode = "unknown" | "live" | "demo";
let mode: BackendMode = "unknown";
let modePromise: Promise<BackendMode> | null = null;

export function backendMode(): BackendMode {
  return mode;
}

export async function detectBackend(): Promise<BackendMode> {
  if (mode !== "unknown") return mode;
  if (API_BASE) {
    mode = "live";
    return mode;
  }
  if (!modePromise) {
    modePromise = (async () => {
      try {
        const res = await fetch("/api/health", { signal: AbortSignal.timeout(4000) });
        mode = res.ok ? "live" : "demo";
      } catch {
        mode = "demo";
      }
      return mode;
    })();
  }
  return modePromise;
}

async function http<T>(method: string, path: string, body?: unknown): Promise<T> {
  const init: RequestInit = { method, credentials: "include" };
  if (body !== undefined) {
    init.headers = { "content-type": "application/json" };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API_BASE}/api${path}`, init);
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

const reqGet = <T>(path: string) => http<T>("GET", path);
const reqPost = <T>(path: string, body?: unknown) => http<T>("POST", path, body);
const reqPatch = <T>(path: string, body?: unknown) => http<T>("PATCH", path, body);
const reqPut = <T>(path: string, body?: unknown) => http<T>("PUT", path, body);
const reqDel = <T>(path: string) => http<T>("DELETE", path);

/** Build a wa.me deep link with attribution text (or a custom pre-filled message). */
export function waLink(
  business: Pick<Business, "whatsapp" | "name">,
  source?: string,
  message?: string,
): string {
  const digits = business.whatsapp.replace(/\D/g, "");
  const text = encodeURIComponent(
    message ?? `Hi ${business.name}! I found you on GainHub NG${source ? ` (${source})` : ""}.`,
  );
  return `https://wa.me/${digits}?text=${text}`;
}

/** Relative-time label from a "minutes ago" value. */
export function timeAgo(minutes: number): string {
  if (minutes < 1) return "now";
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

export type AdminOverview = {
  stats: { label: string; value: string; hint?: string }[];
  queues: Record<string, number>;
  trend: TrendPoint[];
  sources: SourceSlice[];
};
export type AdminAnalytics = {
  stats: { label: string; value: string; hint?: string }[];
  byCategory: { name: string; chats: number; listings: number }[];
};

export type { SearchResult, PublicMeta };

// ---------------------------------------------------------------------------
// Public interface consumed by the React Query hooks. Implemented twice:
// HttpBackend (Cloudflare Worker) and the demo store.
// ---------------------------------------------------------------------------
export interface Backend {
  meta(): Promise<PublicMeta>;
  signIn(email: string, password: string): Promise<User>;
  signUp(data: { name: string; email: string; password: string; phone?: string }): Promise<User>;
  signOut(): Promise<void>;
  me(): Promise<User | null>;
  updateMe(data: {
    name?: string;
    whatsapp?: string;
    prefs?: Record<string, unknown>;
  }): Promise<void>;

  searchBusinesses(params: SearchParams): Promise<SearchResult>;
  business(id: string): Promise<{ business: Business; reviews: Review[]; saved: boolean }>;
  postReview(id: string, data: { author: string; rating: number; body: string }): Promise<void>;
  postEnquiry(
    id: string,
    data: { name: string; whatsapp: string; message?: string; service?: string },
  ): Promise<void>;
  trackEvent(
    businessId: string,
    type: "contact" | "call" | "save" | "share",
    source?: string,
  ): Promise<void>;

  rooms(params?: { q?: string; state?: string }): Promise<Room[]>;
  room(id: string): Promise<RoomDetail>;
  createRoom(data: {
    name: string;
    purpose?: string;
    rule?: string;
    slots?: number;
    state?: string;
    verifiedOnly?: boolean;
  }): Promise<{ id: string }>;
  joinRoom(id: string): Promise<void>;
  reportRoom(id: string, details: string): Promise<void>;

  postClaim(data: {
    businessId?: string;
    businessName?: string;
    claimant: string;
    role?: string;
    contact: string;
    evidence?: string;
    notes?: string;
  }): Promise<void>;
  postSuggestion(data: {
    type: string;
    categorySlug?: string;
    name: string;
    contact?: string;
    address?: string;
    details?: string;
  }): Promise<void>;
  postReport(data: {
    targetType: string;
    targetLabel: string;
    reason: string;
    details?: string;
    contact?: string;
  }): Promise<void>;
  postDataRequest(data: {
    name: string;
    email: string;
    requestType: string;
    details?: string;
  }): Promise<void>;

  createBusiness(data: {
    name: string;
    tagline?: string;
    about?: string;
    categorySlug: string;
    city?: string;
    state?: string;
    address?: string;
    whatsapp: string;
    phone?: string;
    website?: string;
  }): Promise<{ id: string }>;

  saved(): Promise<Business[]>;
  saveBusiness(id: string): Promise<void>;
  unsaveBusiness(id: string): Promise<void>;
  myReviews(): Promise<Review[]>;
  myEnquiries(): Promise<Record<string, unknown>[]>;

  // Contact hub — private per-user contact lists over the public directory.
  lists(): Promise<ContactList[]>;
  createList(name: string): Promise<{ id: string }>;
  renameList(id: string, name: string): Promise<void>;
  deleteList(id: string): Promise<void>;
  listMembers(id: string): Promise<ListMember[]>;
  addToList(id: string, businessIds: string[], source?: string): Promise<AddToListResult>;
  updateListMember(
    listId: string,
    businessId: string,
    patch: { status?: ListStatus; tags?: string[]; note?: string },
  ): Promise<void>;
  removeFromList(listId: string, businessId: string): Promise<void>;

  // Personal contact-gain listings ("post a number").
  listings(params?: { q?: string; category?: string; state?: string }): Promise<PersonListing[]>;
  createListing(data: {
    displayName: string;
    category: string;
    state?: string;
    bio?: string;
    whatsapp: string;
  }): Promise<{ id: string }>;
  myListings(): Promise<PersonListing[]>;
  deleteListing(id: string): Promise<void>;
  trackListingAdd(id: string): Promise<void>;

  // Owner review management.
  workspaceReviews(): Promise<Review[]>;
  replyToReview(id: string, reply: string): Promise<void>;

  workspaceSummary(): Promise<WorkspaceSummary & { business: Business }>;
  workspaceLeads(): Promise<Lead[]>;
  addLead(data: Partial<Lead>): Promise<void>;
  updateLead(id: string, patch: Partial<Lead>): Promise<void>;
  deleteLead(id: string): Promise<void>;
  workspaceTasks(): Promise<Task[]>;
  addTask(data: Partial<Task>): Promise<void>;
  updateTask(id: string, patch: Partial<Task>): Promise<void>;
  workspaceContacts(): Promise<Contact[]>;
  addContact(data: Partial<Contact>): Promise<void>;
  deleteContact(id: string): Promise<void>;
  workspaceConversations(): Promise<Conversation[]>;
  conversationMessages(id: string): Promise<Message[]>;
  sendMessage(id: string, body: string): Promise<void>;
  markConversationRead(id: string): Promise<void>;
  workspaceCampaigns(): Promise<Campaign[]>;
  addCampaign(data: Partial<Campaign>): Promise<void>;
  updateCampaign(id: string, status: string): Promise<void>;
  workspaceLinks(): Promise<TrackedLink[]>;
  addLink(data: { label: string; code?: string; source?: string }): Promise<{ code: string }>;
  deleteLink(id: string): Promise<void>;
  workspaceAutomations(): Promise<Automation[]>;
  addAutomation(data: { trigger: string; action: string }): Promise<void>;
  updateAutomation(id: string, status: string): Promise<void>;
  workspaceTeam(): Promise<TeamMember[]>;
  inviteMember(data: { name: string; email: string; role?: string }): Promise<void>;
  removeMember(id: string): Promise<void>;
  workspaceProfile(): Promise<Business>;
  updateProfile(patch: Record<string, unknown>): Promise<void>;
  workspaceInvoices(): Promise<{ items: Invoice[]; plan: string }>;
  requestUpgrade(plan: string): Promise<void>;
  workspaceAudit(): Promise<AuditEntry[]>;
  workspaceAnalytics(): Promise<{
    trend: TrendPoint[];
    sources: SourceSlice[];
    funnel: { stage: string; n: number }[];
    topLinks: { label: string; scans: number }[];
  }>;

  adminOverview(): Promise<AdminOverview>;
  adminUsers(q?: string): Promise<User[]>;
  adminUpdateUser(id: string, patch: { status?: string; role?: string }): Promise<void>;
  adminBusinesses(q?: string): Promise<Business[]>;
  adminUpdateBusiness(
    id: string,
    patch: { verified?: string; plan?: string; status?: string; featured?: boolean },
  ): Promise<void>;
  adminClaims(): Promise<Claim[]>;
  adminUpdateClaim(id: string, status: string): Promise<void>;
  adminModeration(): Promise<ModerationItem[]>;
  adminUpdateModeration(id: string, action: "approve" | "remove"): Promise<void>;
  adminReviews(): Promise<Review[]>;
  adminUpdateReview(id: string, status: string): Promise<void>;
  adminReports(): Promise<Report[]>;
  adminUpdateReport(id: string, status: string): Promise<void>;
  adminSuggestions(): Promise<Suggestion[]>;
  adminUpdateSuggestion(id: string, status: string): Promise<void>;
  adminCategories(): Promise<Category[]>;
  adminAddCategory(data: { name: string; icon?: string }): Promise<void>;
  adminAds(): Promise<Ad[]>;
  adminAddAd(data: { advertiser: string; inventory: string; spend?: string }): Promise<void>;
  adminUpdateAd(id: string, status: string): Promise<void>;
  adminSubscriptions(): Promise<{
    items: (Invoice & { business?: string; currentPlan?: string })[];
    byPlan: { plan: string; businesses: number }[];
  }>;
  adminSupport(): Promise<Ticket[]>;
  adminUpdateTicket(id: string, status: string): Promise<void>;
  adminJobs(): Promise<Job[]>;
  adminRunJob(id: string): Promise<void>;
  adminAnalytics(): Promise<AdminAnalytics>;
  adminFlags(): Promise<Flag[]>;
  adminAddFlag(data: {
    key: string;
    description?: string;
    audience?: string;
    rollout?: string;
  }): Promise<void>;
  adminUpdateFlag(
    key: string,
    patch: { enabled?: boolean; rollout?: string; status?: string },
  ): Promise<void>;
  adminConfig(): Promise<ConfigEntry[]>;
  adminUpdateConfig(entries: Record<string, string>): Promise<void>;
  adminAudit(): Promise<AuditEntry[]>;
}

class HttpBackend implements Backend {
  meta() {
    return reqGet<PublicMeta>("/meta");
  }
  signIn(email: string, password: string) {
    return reqPost<{ user: User }>("/auth/signin", { email, password }).then((r) => r.user);
  }
  signUp(data: { name: string; email: string; password: string; phone?: string }) {
    return reqPost<{ user: User }>("/auth/signup", data).then((r) => r.user);
  }
  signOut() {
    return reqPost("/auth/signout").then(() => undefined);
  }
  me() {
    return reqGet<{ user: User | null }>("/auth/me").then((r) => r.user);
  }
  updateMe(data: { name?: string; whatsapp?: string; prefs?: Record<string, unknown> }) {
    return reqPatch("/me", data).then(() => undefined);
  }

  searchBusinesses(params: SearchParams) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === "" || v === false) continue;
      qs.set(k, String(v));
    }
    return reqGet<SearchResult>(`/businesses?${qs.toString()}`);
  }
  business(id: string) {
    return reqGet<{ business: Business; reviews: Review[]; saved: boolean }>(`/businesses/${id}`);
  }
  postReview(id: string, data: { author: string; rating: number; body: string }) {
    return reqPost(`/businesses/${id}/reviews`, data).then(() => undefined);
  }
  postEnquiry(
    id: string,
    data: { name: string; whatsapp: string; message?: string; service?: string },
  ) {
    return reqPost(`/businesses/${id}/enquiries`, data).then(() => undefined);
  }
  trackEvent(businessId: string, type: "contact" | "call" | "save" | "share", source?: string) {
    return reqPost("/events", { businessId, type, source })
      .then(() => undefined)
      .catch(() => undefined);
  }

  rooms(params?: { q?: string; state?: string }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.state && params.state !== "all") qs.set("state", params.state);
    return reqGet<{ items: Room[] }>(`/rooms?${qs.toString()}`).then((r) => r.items);
  }
  room(id: string) {
    return reqGet<RoomDetail>(`/rooms/${id}`);
  }
  createRoom(data: {
    name: string;
    purpose?: string;
    rule?: string;
    slots?: number;
    state?: string;
    verifiedOnly?: boolean;
  }) {
    return reqPost<{ id: string }>("/rooms", data);
  }
  joinRoom(id: string) {
    return reqPost(`/rooms/${id}/join`).then(() => undefined);
  }
  reportRoom(id: string, details: string) {
    return reqPost(`/rooms/${id}/report`, { details }).then(() => undefined);
  }

  postClaim(data: Parameters<Backend["postClaim"]>[0]) {
    return reqPost("/claims", data).then(() => undefined);
  }
  postSuggestion(data: Parameters<Backend["postSuggestion"]>[0]) {
    return reqPost("/suggestions", data).then(() => undefined);
  }
  postReport(data: Parameters<Backend["postReport"]>[0]) {
    return reqPost("/reports", data).then(() => undefined);
  }
  postDataRequest(data: Parameters<Backend["postDataRequest"]>[0]) {
    return reqPost("/data-requests", data).then(() => undefined);
  }
  createBusiness(data: Parameters<Backend["createBusiness"]>[0]) {
    return reqPost<{ id: string }>("/businesses", data);
  }

  saved() {
    return reqGet<{ items: Business[] }>("/me/saved").then((r) => r.items);
  }
  saveBusiness(id: string) {
    return reqPost("/me/saved", { businessId: id }).then(() => undefined);
  }
  unsaveBusiness(id: string) {
    return reqDel(`/me/saved/${id}`).then(() => undefined);
  }
  myReviews() {
    return reqGet<{ items: Review[] }>("/me/reviews").then((r) => r.items);
  }
  myEnquiries() {
    return reqGet<{ items: Record<string, unknown>[] }>("/me/enquiries").then((r) => r.items);
  }

  lists() {
    return reqGet<{ items: ContactList[] }>("/me/lists").then((r) => r.items);
  }
  createList(name: string) {
    return reqPost<{ id: string }>("/me/lists", { name });
  }
  renameList(id: string, name: string) {
    return reqPatch(`/me/lists/${id}`, { name }).then(() => undefined);
  }
  deleteList(id: string) {
    return reqDel(`/me/lists/${id}`).then(() => undefined);
  }
  listMembers(id: string) {
    return reqGet<{ items: ListMember[] }>(`/me/lists/${id}/members`).then((r) => r.items);
  }
  addToList(id: string, businessIds: string[], source?: string) {
    return reqPost<AddToListResult>(`/me/lists/${id}/members`, { businessIds, source });
  }
  updateListMember(
    listId: string,
    businessId: string,
    patch: { status?: ListStatus; tags?: string[]; note?: string },
  ) {
    return reqPatch(`/me/lists/${listId}/members/${businessId}`, patch).then(() => undefined);
  }
  removeFromList(listId: string, businessId: string) {
    return reqDel(`/me/lists/${listId}/members/${businessId}`).then(() => undefined);
  }
  listings(params?: { q?: string; category?: string; state?: string }) {
    const qs = new URLSearchParams();
    if (params?.q) qs.set("q", params.q);
    if (params?.category) qs.set("category", params.category);
    if (params?.state) qs.set("state", params.state);
    return reqGet<{ items: PersonListing[] }>(`/listings?${qs.toString()}`).then((r) => r.items);
  }
  createListing(data: {
    displayName: string;
    category: string;
    state?: string;
    bio?: string;
    whatsapp: string;
  }) {
    return reqPost<{ id: string }>("/listings", data);
  }
  myListings() {
    return reqGet<{ items: PersonListing[] }>("/me/listings").then((r) => r.items);
  }
  deleteListing(id: string) {
    return reqDel(`/listings/${id}`).then(() => undefined);
  }
  trackListingAdd(id: string) {
    return reqPost(`/listings/${id}/adds`)
      .then(() => undefined)
      .catch(() => undefined);
  }
  workspaceReviews() {
    return reqGet<{ items: Review[] }>("/workspace/reviews").then((r) => r.items);
  }
  replyToReview(id: string, reply: string) {
    return reqPatch(`/workspace/reviews/${id}`, { reply }).then(() => undefined);
  }
  workspaceSummary() {
    return reqGet<WorkspaceSummary & { business: Business }>("/workspace/summary");
  }
  workspaceLeads() {
    return reqGet<{ items: Lead[] }>("/workspace/leads").then((r) => r.items);
  }
  addLead(data: Partial<Lead>) {
    return reqPost("/workspace/leads", data).then(() => undefined);
  }
  updateLead(id: string, patch: Partial<Lead>) {
    return reqPatch(`/workspace/leads/${id}`, patch).then(() => undefined);
  }
  deleteLead(id: string) {
    return reqDel(`/workspace/leads/${id}`).then(() => undefined);
  }
  workspaceTasks() {
    return reqGet<{ items: Task[] }>("/workspace/tasks").then((r) => r.items);
  }
  addTask(data: Partial<Task>) {
    return reqPost("/workspace/tasks", data).then(() => undefined);
  }
  updateTask(id: string, patch: Partial<Task>) {
    return reqPatch(`/workspace/tasks/${id}`, patch).then(() => undefined);
  }
  workspaceContacts() {
    return reqGet<{ items: Contact[] }>("/workspace/contacts").then((r) => r.items);
  }
  addContact(data: Partial<Contact>) {
    return reqPost("/workspace/contacts", data).then(() => undefined);
  }
  deleteContact(id: string) {
    return reqDel(`/workspace/contacts/${id}`).then(() => undefined);
  }
  workspaceConversations() {
    return reqGet<{ items: Conversation[] }>("/workspace/conversations").then((r) => r.items);
  }
  conversationMessages(id: string) {
    return reqGet<{ items: Message[] }>(`/workspace/conversations/${id}/messages`).then(
      (r) => r.items,
    );
  }
  sendMessage(id: string, body: string) {
    return reqPost(`/workspace/conversations/${id}/messages`, { body }).then(() => undefined);
  }
  markConversationRead(id: string) {
    return reqPost(`/workspace/conversations/${id}/read`).then(() => undefined);
  }
  workspaceCampaigns() {
    return reqGet<{ items: Campaign[] }>("/workspace/campaigns").then((r) => r.items);
  }
  addCampaign(data: Partial<Campaign>) {
    return reqPost("/workspace/campaigns", data).then(() => undefined);
  }
  updateCampaign(id: string, status: string) {
    return reqPatch(`/workspace/campaigns/${id}`, { status }).then(() => undefined);
  }
  workspaceLinks() {
    return reqGet<{ items: TrackedLink[] }>("/workspace/links").then((r) => r.items);
  }
  addLink(data: { label: string; code?: string; source?: string }) {
    return reqPost<{ code: string }>("/workspace/links", data);
  }
  deleteLink(id: string) {
    return reqDel(`/workspace/links/${id}`).then(() => undefined);
  }
  workspaceAutomations() {
    return reqGet<{ items: Automation[] }>("/workspace/automations").then((r) => r.items);
  }
  addAutomation(data: { trigger: string; action: string }) {
    return reqPost("/workspace/automations", data).then(() => undefined);
  }
  updateAutomation(id: string, status: string) {
    return reqPatch(`/workspace/automations/${id}`, { status }).then(() => undefined);
  }
  workspaceTeam() {
    return reqGet<{ items: TeamMember[] }>("/workspace/team").then((r) => r.items);
  }
  inviteMember(data: { name: string; email: string; role?: string }) {
    return reqPost("/workspace/team", data).then(() => undefined);
  }
  removeMember(id: string) {
    return reqDel(`/workspace/team/${id}`).then(() => undefined);
  }
  workspaceProfile() {
    return reqGet<{ business: Business }>("/workspace/profile").then((r) => r.business);
  }
  updateProfile(patch: Record<string, unknown>) {
    return reqPatch("/workspace/profile", patch).then(() => undefined);
  }
  workspaceInvoices() {
    return reqGet<{ items: Invoice[]; plan: string }>("/workspace/invoices");
  }
  requestUpgrade(plan: string) {
    return reqPost("/workspace/upgrade", { plan }).then(() => undefined);
  }
  workspaceAudit() {
    return reqGet<{ items: AuditEntry[] }>("/workspace/audit").then((r) => r.items);
  }
  workspaceAnalytics() {
    return reqGet<{
      trend: TrendPoint[];
      sources: SourceSlice[];
      funnel: { stage: string; n: number }[];
      topLinks: { label: string; scans: number }[];
    }>("/workspace/analytics");
  }

  adminOverview() {
    return reqGet<AdminOverview>("/admin/overview");
  }
  adminUsers(q?: string) {
    return reqGet<{ items: User[] }>(`/admin/users${q ? `?q=${encodeURIComponent(q)}` : ""}`).then(
      (r) => r.items,
    );
  }
  adminUpdateUser(id: string, patch: { status?: string; role?: string }) {
    return reqPatch(`/admin/users/${id}`, patch).then(() => undefined);
  }
  adminBusinesses(q?: string) {
    return reqGet<{ items: Business[] }>(
      `/admin/businesses${q ? `?q=${encodeURIComponent(q)}` : ""}`,
    ).then((r) => r.items);
  }
  adminUpdateBusiness(
    id: string,
    patch: { verified?: string; plan?: string; status?: string; featured?: boolean },
  ) {
    return reqPatch(`/admin/businesses/${id}`, patch).then(() => undefined);
  }
  adminClaims() {
    return reqGet<{ items: Claim[] }>("/admin/claims").then((r) => r.items);
  }
  adminUpdateClaim(id: string, status: string) {
    return reqPatch(`/admin/claims/${id}`, { status }).then(() => undefined);
  }
  adminModeration() {
    return reqGet<{ items: ModerationItem[] }>("/admin/moderation").then((r) => r.items);
  }
  adminUpdateModeration(id: string, action: "approve" | "remove") {
    return reqPatch(`/admin/moderation/${id}`, { action }).then(() => undefined);
  }
  adminReviews() {
    return reqGet<{ items: Review[] }>("/admin/reviews").then((r) => r.items);
  }
  adminUpdateReview(id: string, status: string) {
    return reqPatch(`/admin/reviews/${id}`, { status }).then(() => undefined);
  }
  adminReports() {
    return reqGet<{ items: Report[] }>("/admin/reports").then((r) => r.items);
  }
  adminUpdateReport(id: string, status: string) {
    return reqPatch(`/admin/reports/${id}`, { status }).then(() => undefined);
  }
  adminSuggestions() {
    return reqGet<{ items: Suggestion[] }>("/admin/suggestions").then((r) => r.items);
  }
  adminUpdateSuggestion(id: string, status: string) {
    return reqPatch(`/admin/suggestions/${id}`, { status }).then(() => undefined);
  }
  adminCategories() {
    return reqGet<{ items: (Category & { live?: number })[] }>("/admin/categories").then(
      (r) => r.items,
    );
  }
  adminAddCategory(data: { name: string; icon?: string }) {
    return reqPost("/admin/categories", data).then(() => undefined);
  }
  adminAds() {
    return reqGet<{ items: Ad[] }>("/admin/ads").then((r) => r.items);
  }
  adminAddAd(data: { advertiser: string; inventory: string; spend?: string }) {
    return reqPost("/admin/ads", data).then(() => undefined);
  }
  adminUpdateAd(id: string, status: string) {
    return reqPatch(`/admin/ads/${id}`, { status }).then(() => undefined);
  }
  adminSubscriptions() {
    return reqGet<{
      items: (Invoice & { business?: string; currentPlan?: string })[];
      byPlan: { plan: string; businesses: number }[];
    }>("/admin/subscriptions");
  }
  adminSupport() {
    return reqGet<{ items: Ticket[] }>("/admin/support").then((r) => r.items);
  }
  adminUpdateTicket(id: string, status: string) {
    return reqPatch(`/admin/support/${id}`, { status }).then(() => undefined);
  }
  adminJobs() {
    return reqGet<{ items: Job[] }>("/admin/jobs").then((r) => r.items);
  }
  adminRunJob(id: string) {
    return reqPost(`/admin/jobs/${id}/run`).then(() => undefined);
  }
  adminAnalytics() {
    return reqGet<AdminAnalytics>("/admin/analytics");
  }
  adminFlags() {
    return reqGet<{ items: Flag[] }>("/admin/flags").then((r) => r.items);
  }
  adminAddFlag(data: { key: string; description?: string; audience?: string; rollout?: string }) {
    return reqPost("/admin/flags", data).then(() => undefined);
  }
  adminUpdateFlag(key: string, patch: { enabled?: boolean; rollout?: string; status?: string }) {
    return reqPatch(`/admin/flags/${key}`, patch).then(() => undefined);
  }
  adminConfig() {
    return reqGet<{ items: ConfigEntry[] }>("/admin/config").then((r) => r.items);
  }
  adminUpdateConfig(entries: Record<string, string>) {
    return reqPut("/admin/config", entries).then(() => undefined);
  }
  adminAudit() {
    return reqGet<{ items: AuditEntry[] }>("/admin/audit").then((r) => r.items);
  }
}

/** Resolve the active backend (live worker or local demo store). */
export async function getBackend(): Promise<Backend> {
  const m = await detectBackend();
  if (m === "live") return httpBackend;
  const { demoBackend } = await import("@/lib/demo/store");
  return demoBackend;
}

export const httpBackend = new HttpBackend();

export { dataset, defaultHours, peekBusiness };
