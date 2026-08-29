import { dataset, defaultHours } from "@/data/mock";
import { ApiError, type Backend } from "@/lib/api";
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
  Suggestion,
  Task,
  TeamMember,
  Ticket,
  TrackedLink,
  User,
  WorkspaceSummary,
} from "@/lib/types";

/**
 * Demo backend — a localStorage-persisted mirror of the Cloudflare Worker API.
 * Used when the app is deployed without `VITE_API_URL` (or the dev API isn't
 * running), so every page and form stays functional. Passwords exist only in
 * this demo dataset and are never used in the live backend.
 */

const STORE_KEY = "gainhub.demo.v1";
const SESSION_KEY = "gainhub.demo.session";

type DemoState = typeof dataset & { seq: number };

function seed(): DemoState {
  return {
    ...structuredClone(dataset),
    contactLists: [],
    contactListMembers: {},
    personalListings: [],
    seq: 10_000,
  };
}

function load(): DemoState {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as DemoState;
  } catch {
    // ignore corrupted state
  }
  return seed();
}

let state: DemoState | null = null;

function db(): DemoState {
  if (!state) state = load();
  return state;
}

function persist() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db()));
  } catch {
    // storage full / unavailable — demo continues in memory
  }
}

function nextId(prefix: string): string {
  const d = db();
  d.seq += 1;
  return `${prefix}-${d.seq}`;
}

function resetPassword(u: User & { password?: string }): User {
  const { password: _pw, ...rest } = u as User & { password?: string };
  return rest;
}

function currentUser(): User & { password?: string } {
  const id = localStorage.getItem(SESSION_KEY);
  if (!id) throw new ApiError("Sign in required", 401);
  const user = db().users.find((u) => u.id === id);
  if (!user) throw new ApiError("Sign in required", 401);
  if (user.status === "Suspended") throw new ApiError("This account has been suspended", 403);
  return user;
}

function requireAdmin(): User & { password?: string } {
  const user = currentUser();
  if (user.role !== "admin") throw new ApiError("Admin access required", 401);
  return user;
}

function ownedBusiness(): Business {
  const user = currentUser();
  const biz = db().businesses.find((b) => b.ownerId === user.id);
  if (!biz) throw new ApiError("Create your business profile first", 401);
  return biz;
}

function pushAudit(actor: string, action: string, businessId?: string | null) {
  const d = db();
  d.auditLog.unshift({ id: nextId("A"), actor, action, businessId: businessId ?? null, ts: 0 });
}

function demoSearch(params: SearchParams): SearchResult {
  const pageSize = params.pageSize ?? 12;
  let items = [...db().businesses];
  if (params.q) {
    const q = params.q.toLowerCase();
    // Business-graph search: match the business OR any product/service it sells.
    items = items.filter(
      (b) =>
        [b.name, b.tagline, b.about, b.city, b.state].some((v) => v.toLowerCase().includes(q)) ||
        b.services.some((x) => x.name.toLowerCase().includes(q)) ||
        b.products.some((x) => x.name.toLowerCase().includes(q)),
    );
    for (const b of items) {
      const inBase = [b.name, b.tagline, b.about, b.city, b.state].some((v) =>
        v.toLowerCase().includes(q),
      );
      if (inBase) continue;
      const svc = b.services.find((x) => x.name.toLowerCase().includes(q));
      if (svc) {
        b.matchedOn = { kind: "service", name: svc.name };
        continue;
      }
      const prod = b.products.find((x) => x.name.toLowerCase().includes(q));
      if (prod) b.matchedOn = { kind: "product", name: prod.name };
    }
  }
  if (params.category) items = items.filter((b) => b.categorySlug === params.category);
  if (params.area)
    items = items.filter((b) => b.city.toLowerCase().includes(params.area!.toLowerCase()));
  if (params.location) {
    const loc = db().locations.find((l) => l.slug === params.location);
    if (loc) {
      const names = [loc.name.replace(" (FCT)", ""), ...loc.areas];
      items = items.filter((b) => names.some((n) => b.state.includes(n) || b.city === n));
    }
  }
  if (params.minRating) items = items.filter((b) => b.rating >= (params.minRating ?? 0));
  if (params.openNow) items = items.filter((b) => b.openNow);
  if (params.verifiedOnly) items = items.filter((b) => b.verified !== "unverified");
  for (const [flag, needle] of [
    ["delivery", "Delivery"],
    ["card", "Card payment"],
    ["homeService", "Home service"],
  ] as const) {
    if (params[flag]) items = items.filter((b) => b.amenities.includes(needle));
  }
  switch (params.sort) {
    case "rating":
      items.sort((a, b) => b.rating - a.rating || b.reviewsCount - a.reviewsCount);
      break;
    case "response":
      items.sort((a, b) => a.responseMinutes - b.responseMinutes);
      break;
    case "contacts":
      items.sort((a, b) => b.contactsGained - a.contactsGained);
      break;
    default:
      items.sort(
        (a, b) => Number(b.featured) - Number(a.featured) || b.contactsGained - a.contactsGained,
      );
  }
  const total = items.length;
  const page = params.page ?? 1;
  const start = (page - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    pageSize,
  };
}

function roomToApi(r: (typeof dataset.rooms)[number]): Room {
  return { ...r, slotsLeft: Math.max(0, r.slots - r.members) };
}

function meta(): Promise<PublicMeta> {
  const d = db();
  const liveByCat = new Map<string, number>();
  for (const b of d.businesses)
    liveByCat.set(b.categorySlug, (liveByCat.get(b.categorySlug) ?? 0) + 1);
  const result: PublicMeta = {
    categories: d.categories.map((c) => ({ ...c, live: liveByCat.get(c.slug) ?? 0 })),
    locations: d.locations,
    stats: {
      businesses: d.categories.reduce((acc, c) => acc + c.count, 0),
      chats: "1.2M",
      states: 36,
    },
  };
  return Promise.resolve(result);
}

export const demoBackend: Backend = {
  meta,

  async signIn(email, password) {
    const user = db().users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (!user || user.password !== password) throw new ApiError("Incorrect email or password", 401);
    if (user.status === "Suspended") throw new ApiError("This account has been suspended", 403);
    localStorage.setItem(SESSION_KEY, user.id);
    return resetPassword(user);
  },

  async signUp(data) {
    const d = db();
    if (d.users.some((u) => u.email.toLowerCase() === data.email.toLowerCase()))
      throw new ApiError("An account with this email already exists — try signing in instead", 409);
    if (data.password.length < 8) throw new ApiError("Password must be at least 8 characters", 400);
    const user = {
      id: nextId("U"),
      email: data.email.toLowerCase(),
      name: data.name,
      password: data.password,
      role: "user" as const,
      status: "Active",
      phone: data.phone ?? null,
      ts: 0,
    };
    d.users.push(user);
    localStorage.setItem(SESSION_KEY, user.id);
    persist();
    return resetPassword(user);
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY);
  },

  async me() {
    const id = localStorage.getItem(SESSION_KEY);
    if (!id) return null;
    const user = db().users.find((u) => u.id === id);
    return user ? resetPassword(user) : null;
  },

  async updateMe(data) {
    const user = currentUser();
    if (data.name) user.name = data.name;
    if (data.whatsapp !== undefined) user.whatsapp = data.whatsapp;
    persist();
  },

  searchBusinesses: (params) => Promise.resolve(demoSearch(params)),

  async business(id) {
    const d = db();
    const business = d.businesses.find((b) => b.id === id);
    if (!business) throw new ApiError("Business not found", 404);
    const reviews = d.reviews.filter((r) => r.businessId === id && r.status === "Published");
    const sessionId = localStorage.getItem(SESSION_KEY);
    const me = sessionId ? d.users.find((u) => u.id === sessionId) : undefined;
    const saved = me ? (d.savedByUser[me.email]?.includes(id) ?? false) : false;
    return Promise.resolve({ business, reviews, saved });
  },

  async postReview(id, data) {
    currentUser();
    const d = db();
    if (data.body.trim().length < 10)
      throw new ApiError("Review is a little short — tell us a bit more", 400);
    d.reviews.unshift({
      id: nextId("R"),
      businessId: id,
      author: data.author,
      rating: Math.min(5, Math.max(1, data.rating)),
      body: data.body,
      status: "Published",
      ts: 0,
    });
    const all = d.reviews.filter((r) => r.businessId === id && r.status === "Published");
    const biz = d.businesses.find((b) => b.id === id);
    if (biz) {
      biz.rating = Math.round((all.reduce((acc, r) => acc + r.rating, 0) / all.length) * 10) / 10;
      biz.reviewsCount = all.length;
    }
    persist();
  },

  async postEnquiry(id, data) {
    const d = db();
    const biz = d.businesses.find((b) => b.id === id);
    if (!biz) throw new ApiError("Business not found", 404);
    const leadId = nextId("LD");
    const convId = nextId("CV");
    d.enquiries.push({
      id: nextId("EN"),
      businessId: id,
      name: data.name,
      whatsapp: data.whatsapp,
      message: data.message ?? "",
      service: data.service ?? "",
      status: "New",
      ts: 0,
    });
    d.leads.unshift({
      id: leadId,
      businessId: id,
      name: data.name,
      source: "Directory profile",
      channel: "Form",
      stage: "New",
      value: "—",
      agent: "Unassigned",
      score: 50,
      ts: 0,
    });
    d.conversations.unshift({
      id: convId,
      businessId: id,
      name: data.name,
      last: data.message || "New quote request from your profile",
      unread: 1,
      tag: "New enquiry",
      assigned: "Unassigned",
      ts: 0,
      messages: [
        { from: "contact", body: data.message || "New quote request from your profile", ts: 0 },
      ],
    });
    biz.contactsGained += 1;
    pushAudit("System", `New enquiry from ${data.name} (Directory profile)`, id);
    persist();
  },

  async trackEvent(businessId, type) {
    const biz = db().businesses.find((b) => b.id === businessId);
    if (!biz) return;
    if (type === "contact") biz.contactsGained += 1;
    if (type === "save") biz.savedBy += 1;
    persist();
  },

  async rooms(params) {
    let rooms = db().rooms.filter((r) => r.status === "Active");
    if (params?.q) {
      const q = params.q.toLowerCase();
      rooms = rooms.filter(
        (r) => r.name.toLowerCase().includes(q) || r.purpose.toLowerCase().includes(q),
      );
    }
    if (params?.state && params.state !== "all")
      rooms = rooms.filter((r) => r.state === params.state);
    return Promise.resolve(rooms.map(roomToApi));
  },

  async room(id) {
    const d = db();
    const room = d.rooms.find((r) => r.id === id);
    if (!room) throw new ApiError("Room not found", 404);
    const members = d.roomMembers.filter((m) => m.roomId === id);
    const activity = d.roomActivity.filter((a) => a.roomId === id);
    const { slotsLeft: _sl, ...roomBase } = roomToApi(room);
    const detail: RoomDetail = { ...roomBase, members, activity };
    return Promise.resolve(detail);
  },

  async createRoom(data) {
    const user = currentUser();
    const id = nextId("RM").toLowerCase();
    db().rooms.push({
      id,
      name: data.name,
      purpose: data.purpose ?? "",
      members: 0,
      slots: data.slots ?? 5000,
      rule: data.rule ?? "",
      verifiedOnly: data.verifiedOnly ?? true,
      state: data.state ?? "Nationwide",
      status: "Pending",
      ownerId: user.id,
      ts: 0,
    });
    pushAudit(user.name, `Submitted contact-gain room “${data.name}” for approval`, null);
    persist();
    return { id };
  },

  async joinRoom(id) {
    const user = currentUser();
    const d = db();
    const room = d.rooms.find((r) => r.id === id);
    if (!room) throw new ApiError("Room not found", 404);
    if (room.status !== "Active") throw new ApiError("This room is not accepting members yet", 400);
    const biz = d.businesses.find((b) => b.ownerId === user.id);
    const verified = biz ? biz.verified !== "unverified" : false;
    if (room.verifiedOnly && !verified)
      throw new ApiError(
        "This room is for verified businesses only — verify your listing first",
        403,
      );
    const name = biz?.name ?? user.name;
    if (d.roomMembers.some((m) => m.roomId === id && m.name === name)) return;
    d.roomMembers.push({
      roomId: id,
      name,
      niche: biz ? biz.categorySlug.replace(/-/g, " ") : "Member",
      saveBack: 100,
    });
    room.members += 1;
    d.roomActivity.unshift({ roomId: id, text: `${name} joined the room`, ts: 0 });
    persist();
  },

  async reportRoom(id, details) {
    const room = db().rooms.find((r) => r.id === id);
    if (!room) throw new ApiError("Room not found", 404);
    db().reports.unshift({
      id: nextId("RP"),
      targetType: "Room",
      targetLabel: room.name,
      reason: "Room report",
      details,
      contact: "",
      status: "Open",
      risk: /scam|fraud|fake/i.test(details) ? "High" : "Medium",
      ts: 0,
    });
    persist();
  },

  async postClaim(data) {
    const d = db();
    const biz = data.businessId ? d.businesses.find((b) => b.id === data.businessId) : undefined;
    d.claims.unshift({
      id: nextId("CL"),
      businessId: biz?.id ?? null,
      businessName: biz?.name ?? data.businessName ?? "",
      claimant: data.claimant,
      role: data.role || "Owner",
      contact: data.contact,
      evidence: data.evidence ?? "",
      notes: data.notes ?? "",
      status: "Pending",
      ts: 0,
    });
    pushAudit(
      data.claimant,
      `Submitted ownership claim for ${biz?.name ?? data.businessName}`,
      biz?.id ?? null,
    );
    persist();
  },

  async postSuggestion(data) {
    db().suggestions.unshift({
      id: nextId("SG"),
      type: data.type,
      categorySlug: data.categorySlug ?? "",
      name: data.name,
      contact: data.contact ?? "",
      address: data.address ?? "",
      details: data.details ?? "",
      status: "Pending",
      ts: 0,
    });
    persist();
  },

  async postReport(data) {
    db().reports.unshift({
      id: nextId("RP"),
      targetType: data.targetType,
      targetLabel: data.targetLabel,
      reason: data.reason,
      details: data.details ?? "",
      contact: data.contact ?? "",
      status: "Open",
      risk: /scam|fraud|fake|nud|impersonat/i.test(`${data.reason} ${data.details}`)
        ? "High"
        : "Medium",
      ts: 0,
    });
    persist();
  },

  async postDataRequest(data) {
    db().dataRequests.push({
      id: nextId("DR"),
      name: data.name,
      email: data.email,
      requestType: data.requestType,
      details: data.details ?? "",
      status: "Pending",
      ts: 0,
    });
    persist();
  },

  async createBusiness(data) {
    const user = currentUser();
    const d = db();
    let id =
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60) || "business";
    if (d.businesses.some((b) => b.id === id))
      id = `${id}-${Math.floor(Math.random() * 900 + 100)}`;
    d.businesses.push({
      id,
      ownerId: user.id,
      name: data.name,
      tagline: data.tagline ?? "",
      about: data.about ?? "",
      categorySlug: data.categorySlug,
      city: data.city ?? "Ikeja",
      state: data.state ?? "Lagos",
      address: data.address ?? "",
      rating: 0,
      reviewsCount: 0,
      verified: "unverified",
      openNow: true,
      whatsapp: data.whatsapp,
      phone: data.phone || data.whatsapp,
      website: data.website ?? "",
      socials: [],
      services: [],
      products: [],
      amenities: ["Card payment", "Transfer accepted"],
      serviceAreas: [],
      gallery: [],
      team: [{ name: user.name, role: "Owner" }],
      plan: "Free",
      contactsGained: 0,
      savedBy: 0,
      featured: false,
      responseMinutes: 15,
      ts: 0,
      cover: "bg-ink-mesh",
      hours: defaultHours,
    });
    if (user.role === "user") user.role = "owner";
    pushAudit(user.name, `Created business listing ${data.name}`, id);
    persist();
    return { id };
  },

  async saved() {
    const user = currentUser();
    const ids = db().savedByUser[user.email] ?? [];
    return Promise.resolve(db().businesses.filter((b) => ids.includes(b.id)));
  },
  async saveBusiness(id) {
    const user = currentUser();
    const d = db();
    d.savedByUser[user.email] = [...new Set([...(d.savedByUser[user.email] ?? []), id])];
    const biz = d.businesses.find((b) => b.id === id);
    if (biz) biz.savedBy += 1;
    persist();
  },
  async unsaveBusiness(id) {
    const user = currentUser();
    const d = db();
    d.savedByUser[user.email] = (d.savedByUser[user.email] ?? []).filter((x) => x !== id);
    persist();
  },
  async myReviews() {
    const user = currentUser();
    return Promise.resolve(
      db().reviews.filter((r) => r.author.startsWith(user.name.split(" ")[0] ?? "~")),
    );
  },
  async myEnquiries() {
    currentUser();
    return Promise.resolve(db().enquiries as unknown as Record<string, unknown>[]);
  },

  // ------------------------------------------------------------- contact hub
  async lists() {
    const user = currentUser();
    const d = db();
    const lists = d.contactLists ?? (d.contactLists = []);
    return Promise.resolve(
      lists
        .filter((l) => l.userId === user.email)
        .map((l) => ({
          id: l.id,
          name: l.name,
          businessCount: (d.contactListMembers?.[l.id] ?? []).length,
          ts: l.ts,
        })),
    );
  },
  async createList(name: string) {
    const user = currentUser();
    const d = db();
    const lists = d.contactLists ?? (d.contactLists = []);
    const id = nextId("CL");
    lists.push({ id, userId: user.email, name, businessCount: 0, ts: 0 });
    d.contactListMembers = d.contactListMembers ?? {};
    persist();
    return Promise.resolve({ id });
  },
  async renameList(id: string, name: string) {
    const user = currentUser();
    const list = (db().contactLists ?? []).find((l) => l.id === id && l.userId === user.email);
    if (!list) throw new ApiError("List not found", 404);
    list.name = name;
    persist();
    return Promise.resolve();
  },
  async deleteList(id: string) {
    const user = currentUser();
    const d = db();
    const lists = d.contactLists ?? (d.contactLists = []);
    const idx = lists.findIndex((l) => l.id === id && l.userId === user.email);
    if (idx >= 0) lists.splice(idx, 1);
    if (d.contactListMembers) delete d.contactListMembers[id];
    persist();
    return Promise.resolve();
  },
  async listMembers(id: string) {
    const user = currentUser();
    const d = db();
    const list = (d.contactLists ?? []).find((l) => l.id === id && l.userId === user.email);
    if (!list) throw new ApiError("List not found", 404);
    const members = d.contactListMembers?.[id] ?? [];
    return Promise.resolve(
      members
        .map((m) => {
          const business = d.businesses.find((b) => b.id === m.businessId);
          return business ? { ...m, business } : null;
        })
        .filter((m): m is ListMember => m != null),
    );
  },
  async addToList(id: string, businessIds: string[], source?: string) {
    const user = currentUser();
    const d = db();
    const list = (d.contactLists ?? []).find((l) => l.id === id && l.userId === user.email);
    if (!list) throw new ApiError("List not found", 404);
    const all = d.contactListMembers ?? (d.contactListMembers = {});
    const members = all[id] ?? (all[id] = []);
    let added = 0;
    let duplicates = 0;
    for (const businessId of businessIds) {
      if (members.some((m) => m.businessId === businessId)) {
        duplicates += 1; // dedupe: a business lives once per list
        continue;
      }
      members.push({
        businessId,
        business: d.businesses.find((b) => b.id === businessId) as Business,
        status: "New",
        tags: [],
        note: "",
        source: source ?? "Directory search",
        ts: 0,
      });
      added += 1;
    }
    persist();
    return Promise.resolve({ added, duplicates });
  },
  async updateListMember(listId, businessId, patch) {
    const user = currentUser();
    const d = db();
    const member = (d.contactListMembers?.[listId] ?? []).find((m) => m.businessId === businessId);
    if (!member || !(d.contactLists ?? []).some((l) => l.id === listId && l.userId === user.email))
      throw new ApiError("List member not found", 404);
    if (patch.status) member.status = patch.status;
    if (patch.tags) member.tags = patch.tags;
    if (patch.note !== undefined) member.note = patch.note;
    persist();
    return Promise.resolve();
  },
  async removeFromList(listId, businessId) {
    const user = currentUser();
    const d = db();
    const members = d.contactListMembers?.[listId] ?? [];
    const idx = members.findIndex((m) => m.businessId === businessId);
    if (
      idx >= 0 &&
      (d.contactLists ?? []).some((l) => l.id === listId && l.userId === user.email)
    ) {
      members.splice(idx, 1);
      persist();
    }
    return Promise.resolve();
  },

  // ------------------------------------------- personal contact-gain listings
  async listings(params) {
    const d = db();
    let items = [...(d.personalListings ?? [])];
    const q = params?.q?.toLowerCase();
    if (q)
      items = items.filter((l) =>
        [l.displayName, l.ownerName, l.bio, l.category].some((v) => v.toLowerCase().includes(q)),
      );
    if (params?.category) items = items.filter((l) => l.category === params.category);
    if (params?.state) items = items.filter((l) => l.state === params.state);
    return Promise.resolve(items);
  },
  async createListing(data) {
    const user = currentUser();
    const d = db();
    const listings = d.personalListings ?? (d.personalListings = []);
    if (listings.some((l) => l.userId === user.email))
      throw new ApiError(
        "You already have an active listing — delete it before posting a new one",
        409,
      );
    const id = nextId("PL");
    listings.push({
      id,
      userId: user.email,
      ownerName: user.name,
      displayName: data.displayName,
      category: data.category,
      state: data.state ?? "",
      bio: data.bio ?? "",
      whatsapp: data.whatsapp,
      adds: 0,
      ts: 0,
    });
    persist();
    return Promise.resolve({ id });
  },
  async myListings() {
    const user = currentUser();
    return Promise.resolve((db().personalListings ?? []).filter((l) => l.userId === user.email));
  },
  async deleteListing(id: string) {
    const user = currentUser();
    const d = db();
    const listings = d.personalListings ?? (d.personalListings = []);
    const idx = listings.findIndex((l) => l.id === id && l.userId === user.email);
    if (idx >= 0) {
      listings.splice(idx, 1);
      persist();
    }
    return Promise.resolve();
  },
  async trackListingAdd(id: string) {
    const d = db();
    const listing = (d.personalListings ?? []).find((l) => l.id === id);
    if (listing) {
      listing.adds += 1;
      persist();
    }
    return Promise.resolve();
  },

  // ------------------------------------------------------ review management
  async workspaceReviews() {
    const user = currentUser();
    const d = db();
    const mine = d.businesses.filter((b) => b.ownerId === user.id).map((b) => b.id);
    return Promise.resolve(d.reviews.filter((r) => mine.includes(r.businessId)));
  },
  async replyToReview(id: string, reply: string) {
    const user = currentUser();
    const d = db();
    const mine = d.businesses.filter((b) => b.ownerId === user.id).map((b) => b.id);
    const review = d.reviews.find((r) => r.id === id && mine.includes(r.businessId));
    if (!review) throw new ApiError("Review not found", 404);
    review.reply = reply;
    review.repliedAt = 0;
    persist();
    return Promise.resolve();
  },

  async workspaceSummary() {
    const d = db();
    const biz = ownedBusiness();
    const leads = d.leads.filter((l) => l.businessId === biz.id);
    const newLeads = leads.filter((l) => l.stage === "New").length;
    const won = leads.filter((l) => l.stage === "Won").length;
    const unread = d.conversations
      .filter((c) => c.businessId === biz.id)
      .reduce((acc, c) => acc + c.unread, 0);
    return Promise.resolve({
      business: biz,
      stats: [
        {
          label: "Contacts gained",
          value: biz.contactsGained.toLocaleString(),
          delta: "+12%",
          hint: "this week",
        },
        { label: "New leads", value: String(newLeads), hint: "in pipeline" },
        { label: "Reply time", value: `${biz.responseMinutes}m 00s`, hint: "average" },
        { label: "Won deals", value: String(won), hint: "all time" },
        { label: "Unread", value: String(unread), hint: "messages" },
      ],
      trend: d.trendData,
      sources: d.sourceData,
      latestLeads: leads.slice(0, 6),
    });
  },

  async workspaceLeads() {
    const biz = ownedBusiness();
    return Promise.resolve(db().leads.filter((l) => l.businessId === biz.id));
  },
  async addLead(data) {
    const user = currentUser();
    const biz = ownedBusiness();
    db().leads.unshift({
      id: nextId("LD"),
      businessId: biz.id,
      name: String(data.name ?? "Unnamed lead"),
      source: data.source || "Manual entry",
      channel: data.channel || "WhatsApp",
      stage: data.stage || "New",
      value: data.value ?? "",
      agent: user.name,
      score: data.score ?? 50,
      ts: 0,
    });
    pushAudit(user.name, `Added lead for ${data.name}`, biz.id);
    persist();
  },
  async updateLead(id, patch) {
    const lead = db().leads.find((l) => l.id === id);
    if (!lead) throw new ApiError("Lead not found", 404);
    Object.assign(lead, patch);
    pushAudit(currentUser().name, `Updated lead ${id}`, lead.businessId);
    persist();
  },
  async deleteLead(id) {
    const d = db();
    d.leads = d.leads.filter((l) => l.id !== id);
    persist();
  },
  async workspaceTasks() {
    const biz = ownedBusiness();
    return Promise.resolve(db().tasks.filter((t) => t.businessId === biz.id));
  },
  async addTask(data) {
    const user = currentUser();
    const biz = ownedBusiness();
    db().tasks.unshift({
      id: nextId("T"),
      businessId: biz.id,
      title: String(data.title ?? "Untitled task"),
      due: data.due || "Today",
      owner: data.owner || user.name,
      priority: data.priority || "Medium",
      done: false,
      ts: 0,
    });
    persist();
  },
  async updateTask(id, patch) {
    const task = db().tasks.find((t) => t.id === id);
    if (!task) throw new ApiError("Task not found", 404);
    Object.assign(task, patch);
    persist();
  },
  async workspaceContacts() {
    const biz = ownedBusiness();
    return Promise.resolve(db().contacts.filter((c) => c.businessId === biz.id));
  },
  async addContact(data) {
    const biz = ownedBusiness();
    db().contacts.unshift({
      id: nextId("CT"),
      businessId: biz.id,
      name: String(data.name ?? "Unnamed"),
      phone: data.phone ?? "",
      email: data.email ?? "",
      tags: data.tags ?? [],
      source: data.source || "Manual entry",
      ts: 0,
    });
    persist();
  },
  async deleteContact(id) {
    const d = db();
    d.contacts = d.contacts.filter((c) => c.id !== id);
    persist();
  },
  async workspaceConversations() {
    const biz = ownedBusiness();
    return Promise.resolve(
      db()
        .conversations.filter((c) => c.businessId === biz.id)
        .map(({ messages: _m, ...rest }) => rest),
    );
  },
  async conversationMessages(id) {
    ownedBusiness();
    return Promise.resolve(db().conversations.find((c) => c.id === id)?.messages ?? []);
  },
  async sendMessage(id, body) {
    const biz = ownedBusiness();
    const conv = db().conversations.find((c) => c.id === id);
    if (!conv) throw new ApiError("Conversation not found", 404);
    conv.messages = [...(conv.messages ?? []), { from: "business", body, ts: 0 }];
    conv.last = body;
    conv.ts = 0;
    pushAudit(currentUser().name, `Replied to ${conv.name}`, biz.id);
    persist();
  },
  async markConversationRead(id) {
    const conv = db().conversations.find((c) => c.id === id);
    if (conv) conv.unread = 0;
    persist();
  },
  async workspaceCampaigns() {
    const biz = ownedBusiness();
    return Promise.resolve(db().campaigns.filter((c) => c.businessId === biz.id));
  },
  async addCampaign(data) {
    const user = currentUser();
    const biz = ownedBusiness();
    db().campaigns.unshift({
      id: nextId("CMP"),
      businessId: biz.id,
      name: String(data.name ?? "New campaign"),
      channel: data.channel || "WhatsApp link",
      scans: 0,
      leads: 0,
      cost: data.cost || "₦0",
      cpl: "₦0",
      status: "Live",
      ts: 0,
    });
    pushAudit(user.name, `Created campaign ${data.name}`, biz.id);
    persist();
  },
  async updateCampaign(id, status) {
    const campaign = db().campaigns.find((c) => c.id === id);
    if (!campaign) throw new ApiError("Campaign not found", 404);
    campaign.status = status;
    persist();
  },
  async workspaceLinks() {
    const biz = ownedBusiness();
    return Promise.resolve(db().links.filter((l) => l.businessId === biz.id));
  },
  async addLink(data) {
    const user = currentUser();
    const biz = ownedBusiness();
    let code = data.code || biz.id;
    if (db().links.some((l) => l.code === code))
      code = `${code}-${Math.floor(Math.random() * 900 + 100)}`;
    db().links.unshift({
      id: nextId("LK"),
      businessId: biz.id,
      label: data.label,
      code,
      url: `gain.ng/w/${code}`,
      scans: 0,
      source: data.source || "Directory",
      ts: 0,
    });
    pushAudit(user.name, `Created tracked link ${code}`, biz.id);
    persist();
    return { code };
  },
  async deleteLink(id) {
    const d = db();
    d.links = d.links.filter((l) => l.id !== id);
    persist();
  },
  async workspaceAutomations() {
    const biz = ownedBusiness();
    return Promise.resolve(db().automations.filter((a) => a.businessId === biz.id));
  },
  async addAutomation(data) {
    const biz = ownedBusiness();
    db().automations.unshift({
      id: nextId("AU"),
      businessId: biz.id,
      trigger: data.trigger,
      action: data.action,
      runs: 0,
      status: "Active",
      ts: 0,
    });
    persist();
  },
  async updateAutomation(id, status) {
    const automation = db().automations.find((a) => a.id === id);
    if (!automation) throw new ApiError("Automation not found", 404);
    automation.status = status as Automation["status"];
    persist();
  },
  async workspaceTeam() {
    const biz = ownedBusiness();
    return Promise.resolve(db().teamMembers.filter((t) => t.businessId === biz.id));
  },
  async inviteMember(data) {
    const biz = ownedBusiness();
    db().teamMembers.push({
      id: nextId("TM"),
      businessId: biz.id,
      name: data.name,
      email: data.email,
      role: data.role || "Staff",
      status: "Invited",
      ts: 0,
    });
    persist();
  },
  async removeMember(id) {
    const d = db();
    d.teamMembers = d.teamMembers.filter((t) => t.id !== id || t.role === "Owner");
    persist();
  },
  async workspaceProfile() {
    return Promise.resolve(ownedBusiness());
  },
  async updateProfile(patch) {
    const user = currentUser();
    const biz = ownedBusiness();
    Object.assign(biz, patch);
    pushAudit(user.name, "Updated business profile", biz.id);
    persist();
  },
  async workspaceInvoices() {
    const biz = ownedBusiness();
    return Promise.resolve({
      items: db().invoices.filter((i) => i.businessId === biz.id),
      plan: biz.plan,
    });
  },
  async requestUpgrade(plan) {
    const user = currentUser();
    const biz = ownedBusiness();
    const amount = plan === "Pro" ? "₦25,000" : plan === "Growth" ? "₦12,500" : "₦0";
    db().invoices.unshift({
      id: nextId("INV"),
      businessId: biz.id,
      plan: `${plan} — monthly`,
      amount,
      status: "Pending",
      ts: 0,
    });
    db().tickets.unshift({
      id: nextId("S"),
      subject: `Plan change request: ${biz.plan} → ${plan} (${biz.name})`,
      user: user.name,
      priority: "Medium",
      status: "Open",
      ts: 0,
    });
    pushAudit(user.name, `Requested upgrade to ${plan}`, biz.id);
    persist();
  },
  async workspaceAudit() {
    const biz = ownedBusiness();
    return Promise.resolve(
      db().auditLog.filter((a) => a.businessId === biz.id || a.actor === "System"),
    );
  },
  async workspaceAnalytics() {
    const biz = ownedBusiness();
    const leads = db().leads.filter((l) => l.businessId === biz.id);
    const funnel = ["New", "Qualified", "Quotation", "Follow up", "Won", "Lost"].map((stage) => ({
      stage,
      n: leads.filter((l) => l.stage === stage).length,
    }));
    return Promise.resolve({
      trend: db().trendData,
      sources: db().sourceData,
      funnel,
      topLinks: db()
        .links.filter((l) => l.businessId === biz.id)
        .sort((a, b) => b.scans - a.scans)
        .slice(0, 5)
        .map((l) => ({ label: l.label, scans: l.scans })),
    });
  },

  async adminOverview() {
    requireAdmin();
    const d = db();
    return Promise.resolve({
      stats: [
        { label: "Listings", value: d.businesses.length.toLocaleString(), hint: "on platform" },
        {
          label: "Verified",
          value: d.businesses.filter((b) => b.verified !== "unverified").length.toLocaleString(),
          hint: "listings",
        },
        { label: "Chats started", value: "1.5K", delta: "+9%", hint: "7 days" },
        {
          label: "Open reports",
          value: String(
            d.reports.filter((r) => r.status === "Open" || r.status === "Reviewing").length,
          ),
          hint: "in queue",
        },
      ],
      queues: {
        claims: d.claims.filter((c) => c.status === "Pending" || c.status === "In review").length,
        moderation: d.moderation.filter((m) => m.status === "Pending").length,
        reports: d.reports.filter((r) => r.status === "Open" || r.status === "Reviewing").length,
        users: d.users.length,
      },
      trend: d.trendData,
      sources: d.sourceData,
    });
  },
  async adminUsers(q) {
    requireAdmin();
    let users = [...db().users];
    if (q) {
      const needle = q.toLowerCase();
      users = users.filter(
        (u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
      );
    }
    return Promise.resolve(users.map(resetPassword).map((u) => ({ ...u, state: "Lagos" })));
  },
  async adminUpdateUser(id, patch) {
    requireAdmin();
    const user = db().users.find((u) => u.id === id);
    if (!user) throw new ApiError("User not found", 404);
    Object.assign(user, patch);
    persist();
  },
  async adminBusinesses(q) {
    requireAdmin();
    let items = [...db().businesses];
    if (q) {
      const needle = q.toLowerCase();
      items = items.filter((b) => `${b.name} ${b.city} ${b.state}`.toLowerCase().includes(needle));
    }
    return Promise.resolve(items);
  },
  async adminUpdateBusiness(id, patch) {
    const admin = requireAdmin();
    const biz = db().businesses.find((b) => b.id === id);
    if (!biz) throw new ApiError("Business not found", 404);
    Object.assign(biz, patch);
    pushAudit(admin.name, `Updated business ${id}`, id);
    persist();
  },
  async adminClaims() {
    requireAdmin();
    return Promise.resolve(db().claims);
  },
  async adminUpdateClaim(id, status) {
    const admin = requireAdmin();
    const claim = db().claims.find((c) => c.id === id);
    if (!claim) throw new ApiError("Claim not found", 404);
    claim.status = status;
    if (status === "Approved" && claim.businessId) {
      const biz = db().businesses.find((b) => b.id === claim.businessId);
      const owner = db().users.find((u) => u.email === claim.contact);
      if (biz && owner) {
        biz.ownerId = owner.id;
        if (owner.role === "user") owner.role = "owner";
      } else if (biz) {
        biz.verified = biz.verified === "unverified" ? "email" : biz.verified;
      }
    }
    pushAudit(admin.name, `Claim ${id} → ${status}`, claim.businessId);
    persist();
  },
  async adminModeration() {
    requireAdmin();
    return Promise.resolve(db().moderation);
  },
  async adminUpdateModeration(id, action) {
    const admin = requireAdmin();
    const item = db().moderation.find((m) => m.id === id);
    if (!item) throw new ApiError("Item not found", 404);
    item.status = action === "approve" ? "Approved" : "Removed";
    pushAudit(admin.name, `Moderation ${id} → ${item.status}`, null);
    persist();
  },
  async adminReviews() {
    requireAdmin();
    return Promise.resolve(db().reviews);
  },
  async adminUpdateReview(id, status) {
    const admin = requireAdmin();
    const review = db().reviews.find((r) => r.id === id);
    if (!review) throw new ApiError("Review not found", 404);
    review.status = status;
    const all = db().reviews.filter(
      (r) => r.businessId === review.businessId && r.status === "Published",
    );
    const biz = db().businesses.find((b) => b.id === review.businessId);
    if (biz && all.length) {
      biz.rating = Math.round((all.reduce((acc, r) => acc + r.rating, 0) / all.length) * 10) / 10;
      biz.reviewsCount = all.length;
    }
    pushAudit(admin.name, `Review ${id} → ${status}`, review.businessId);
    persist();
  },
  async adminReports() {
    requireAdmin();
    return Promise.resolve(db().reports);
  },
  async adminUpdateReport(id, status) {
    const admin = requireAdmin();
    const report = db().reports.find((r) => r.id === id);
    if (!report) throw new ApiError("Report not found", 404);
    report.status = status;
    pushAudit(admin.name, `Report ${id} → ${status}`, null);
    persist();
  },
  async adminSuggestions() {
    requireAdmin();
    return Promise.resolve(db().suggestions);
  },
  async adminUpdateSuggestion(id, status) {
    const admin = requireAdmin();
    const suggestion = db().suggestions.find((s) => s.id === id);
    if (!suggestion) throw new ApiError("Suggestion not found", 404);
    suggestion.status = status;
    pushAudit(admin.name, `Suggestion ${id} → ${status}`, null);
    persist();
  },
  async adminCategories() {
    requireAdmin();
    const d = db();
    return Promise.resolve(
      d.categories.map((c) => ({
        ...c,
        live: d.businesses.filter((b) => b.categorySlug === c.slug).length,
      })),
    );
  },
  async adminAddCategory(data) {
    const admin = requireAdmin();
    const slug =
      data.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || nextId("CAT").toLowerCase();
    if (db().categories.some((c) => c.slug === slug))
      throw new ApiError("A category with this slug already exists", 409);
    db().categories.push({ slug, name: data.name, icon: data.icon || "Store", count: 0 });
    pushAudit(admin.name, `Created category ${data.name}`, null);
    persist();
  },
  async adminAds() {
    requireAdmin();
    return Promise.resolve(db().ads);
  },
  async adminAddAd(data) {
    const admin = requireAdmin();
    db().ads.unshift({
      id: nextId("AD"),
      advertiser: data.advertiser,
      inventory: data.inventory,
      spend: data.spend || "₦0",
      chats: 0,
      status: "Live",
      ts: 0,
    });
    pushAudit(admin.name, `Created ad placement for ${data.advertiser}`, null);
    persist();
  },
  async adminUpdateAd(id, status) {
    requireAdmin();
    const ad = db().ads.find((a) => a.id === id);
    if (!ad) throw new ApiError("Ad not found", 404);
    ad.status = status;
    persist();
  },
  async adminSubscriptions() {
    requireAdmin();
    const d = db();
    const byPlan = ["Free", "Growth", "Pro"].map((plan) => ({
      plan,
      businesses: d.businesses.filter((b) => b.plan === plan).length,
    }));
    const items: (Invoice & { business?: string; currentPlan?: string })[] = d.invoices.map((i) => {
      const biz = d.businesses.find((b) => b.id === i.businessId);
      return {
        ...i,
        ...(biz?.name ? { business: biz.name } : {}),
        ...(biz?.plan ? { currentPlan: biz.plan } : {}),
      };
    });
    return Promise.resolve({ items, byPlan });
  },
  async adminSupport() {
    requireAdmin();
    return Promise.resolve(db().tickets);
  },
  async adminUpdateTicket(id, status) {
    const admin = requireAdmin();
    const ticket = db().tickets.find((t) => t.id === id);
    if (!ticket) throw new ApiError("Ticket not found", 404);
    ticket.status = status;
    pushAudit(admin.name, `Ticket ${id} → ${status}`, null);
    persist();
  },
  async adminJobs() {
    requireAdmin();
    return Promise.resolve(db().jobs);
  },
  async adminRunJob(id: string) {
    requireAdmin();
    const job = db().jobs.find((j) => j.id === id);
    if (job) {
      job.status = "Idle";
      job.lastRun = "just now";
      job.output = `Manual run at ${new Date().toLocaleTimeString("en-NG")} — completed.`;
    }
    return Promise.resolve();
  },
  async adminAnalytics() {
    requireAdmin();
    const d = db();
    return Promise.resolve({
      stats: [
        { label: "Chats started", value: "1.5K", hint: "all time" },
        { label: "Listing completion", value: "71%", hint: "average" },
        { label: "Categories", value: String(d.categories.length), hint: "active" },
        { label: "Retention", value: "24 months", hint: "NDPR policy" },
      ],
      byCategory: d.categories.map((c) => ({
        name: c.name,
        chats: Math.round(c.count * 0.12),
        listings: d.businesses.filter((b) => b.categorySlug === c.slug).length,
      })),
    });
  },
  async adminFlags() {
    requireAdmin();
    return Promise.resolve(db().flags);
  },
  async adminAddFlag(data) {
    const admin = requireAdmin();
    const key = data.key.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
    if (db().flags.some((f) => f.key === key)) throw new ApiError("Flag already exists", 409);
    db().flags.push({
      key,
      rollout: data.rollout || "0%",
      audience: data.audience || "All",
      status: "Disabled",
      description: data.description || "",
      enabled: false,
      ts: 0,
    });
    pushAudit(admin.name, `Created flag ${key}`, null);
    persist();
  },
  async adminUpdateFlag(key, patch) {
    const admin = requireAdmin();
    const flag = db().flags.find((f) => f.key === key);
    if (!flag) throw new ApiError("Flag not found", 404);
    if (patch.enabled !== undefined) {
      flag.enabled = patch.enabled;
      flag.status =
        patch.status ??
        (patch.enabled ? (flag.rollout === "100%" ? "Enabled" : "Canary") : "Disabled");
    }
    if (patch.rollout !== undefined) flag.rollout = patch.rollout;
    if (patch.status !== undefined) flag.status = patch.status;
    pushAudit(admin.name, `Flag ${key} → ${flag.status}`, null);
    persist();
  },
  async adminConfig() {
    requireAdmin();
    return Promise.resolve(db().config);
  },
  async adminUpdateConfig(entries) {
    const admin = requireAdmin();
    const d = db();
    for (const [key, value] of Object.entries(entries)) {
      const existing = d.config.find((c) => c.key === key);
      if (existing) existing.value = value;
      else d.config.push({ key, value, notes: "" });
    }
    pushAudit(
      admin.name,
      `Updated platform configuration (${Object.keys(entries).length} keys)`,
      null,
    );
    persist();
  },
  async adminAudit() {
    requireAdmin();
    return Promise.resolve(db().auditLog);
  },
};

/** Reset demo data (exposed for a "reset demo data" affordance in settings). */
export function resetDemoData() {
  state = seed();
  persist();
}

export type { AuditEntry, ConfigEntry, Message, SearchResult, Suggestion, User, WorkspaceSummary };
