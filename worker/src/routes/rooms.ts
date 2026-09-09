import { z } from "zod";

import {
  createRoomInput,
  joinRoomInput,
  roomActionInput,
  saveBackCheckinInput,
  type RoomDetail,
  type RoomSummary,
} from "../../../shared/api.ts";
import {
  SAVE_BACK_MINIMUM,
  VERIFICATION_RANK,
  type VerificationLevel,
  slugify,
} from "../../../shared/domain.ts";
import { recordAudit } from "../audit.ts";
import { DB } from "../db-access.ts";
import { all, newId, nowIso } from "../db.ts";
import { ApiError } from "../errors.ts";
import { json, parseBody, parseQuery } from "../http.ts";
import { notify } from "../notifications.ts";
import { myBusiness } from "./guards.ts";
import type { AppContext } from "../types.ts";

const ROOM_SELECT = `id, slug, name, purpose, house_rule, state, verified_only, capacity, member_count, avg_save_back, status, created_by_user_id, owned_by_business_id`;

function mapRoom(row: RoomRow): RoomSummary {
  const memberCount = Number(row.member_count ?? 0);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    purpose: row.purpose,
    houseRule: row.house_rule,
    state: row.state,
    verifiedOnly: row.verified_only === 1,
    capacity: Number(row.capacity),
    memberCount,
    slotsLeft: Math.max(0, Number(row.capacity) - memberCount),
    status: row.status,
    avgSaveBack: Number(row.avg_save_back ?? 0),
  };
}

type RoomRow = {
  id: string;
  slug: string;
  name: string;
  purpose: RoomSummary["purpose"];
  house_rule: string;
  state: string;
  verified_only: number;
  capacity: number;
  member_count: number | null;
  avg_save_back: number | null;
  status: string;
  created_by_user_id: string | null;
  owned_by_business_id: string | null;
};

const roomQuery = z.object({
  state: z.string().trim().max(40).optional(),
  purpose: z.enum(["business", "niche", "logistics", "network"]).optional(),
  q: z.string().trim().max(80).optional(),
});

export async function listRooms(c: AppContext): Promise<Response> {
  const query = parseQuery(roomQuery, c.url);
  const clauses: string[] = ["status = 'active'"];
  const params: unknown[] = [];
  if (query.state && query.state !== "All") {
    clauses.push("state = ?");
    params.push(query.state);
  }
  if (query.purpose) {
    clauses.push("purpose = ?");
    params.push(query.purpose);
  }
  const term = (query.q ?? "").trim().toLowerCase();
  if (term.length >= 2) {
    clauses.push("(lower(name) LIKE ? OR lower(house_rule) LIKE ?)");
    const like = `%${term.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    params.push(like, like);
  }
  const rows = await all<RoomRow>(
    c.env.DB,
    `SELECT ${ROOM_SELECT} FROM rooms WHERE ${clauses.join(" AND ")} ORDER BY member_count DESC LIMIT 60`,
    params,
  );

  // My memberships in one query, then joined in JS: the page shows a state per room
  // without a correlated subquery per row.
  const mine = c.session
    ? await all<{ room_id: string; status: string }>(
        c.env.DB,
        "SELECT room_id, status FROM room_members WHERE user_id = ? AND status <> 'removed'",
        [c.session.user.id],
      )
    : [];
  const myState = new Map(mine.map((row) => [row.room_id, row.status]));

  return json({
    items: rows.map((row) => ({ ...mapRoom(row), membership: myState.get(row.id) ?? "none" })),
    total: rows.length,
  });
}

export async function getRoom(c: AppContext): Promise<Response> {
  const slug = c.params["slug"] ?? "";
  const row = await c.env.DB.prepare(`SELECT ${ROOM_SELECT} FROM rooms WHERE slug = ? OR id = ?`)
    .bind(slug, slug)
    .first<RoomRow>();
  if (!row) throw ApiError.notFound("Room not found.");
  const room = mapRoom(row);

  const [members, activity] = await Promise.all([
    all<{
      user_id: string;
      display_name: string;
      niche: string | null;
      role: "owner" | "moderator" | "member";
      save_back_score: number;
      joined_at: string | null;
      verified_level: string | null;
    }>(
      c.env.DB,
      `SELECT m.user_id, u.display_name, cat.name AS niche, m.role, m.save_back_score, m.joined_at, b.verified_level
         FROM room_members m JOIN users u ON u.id = m.user_id
         LEFT JOIN businesses b ON b.id = m.business_id
         LEFT JOIN categories cat ON cat.id = b.category_id
        WHERE m.room_id = ? AND m.status = 'active'
        ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'moderator' THEN 1 ELSE 2 END, m.save_back_score DESC
        LIMIT 24`,
      [row.id],
    ),
    all<{ id: string; detail: string; created_at: string; actor: string | null }>(
      c.env.DB,
      `SELECT a.id, a.detail, a.created_at, u.display_name AS actor
         FROM room_activity a LEFT JOIN users u ON u.id = a.actor_user_id
        WHERE a.room_id = ? ORDER BY a.created_at DESC LIMIT 12`,
      [row.id],
    ),
  ]);

  const viewerMembership = c.session
    ? await c.env.DB.prepare(
        "SELECT status, save_back_score FROM room_members WHERE room_id = ? AND user_id = ?",
      )
        .bind(row.id, c.session.user.id)
        .first<{ status: string; save_back_score: number }>()
    : null;

  const isModerator = c.session ? await canModerate(c, row) : false;
  const queue = isModerator
    ? await all<{
        user_id: string;
        display_name: string;
        note: string | null;
        requested_at: string;
      }>(
        c.env.DB,
        `SELECT m.user_id, u.display_name, m.note, m.requested_at
           FROM room_members m JOIN users u ON u.id = m.user_id
          WHERE m.room_id = ? AND m.status = 'queued' ORDER BY m.requested_at LIMIT 50`,
        [row.id],
      )
    : [];

  const detail: RoomDetail = {
    room,
    rules: room.houseRule
      .split(/\s*[|•]\s*/)
      .filter(Boolean)
      .slice(0, 6),
    members: members.map((member) => ({
      id: member.user_id,
      displayName: member.display_name,
      niche: member.niche,
      role: member.role,
      saveBackScore: Number(member.save_back_score ?? 0),
      joinedAt: member.joined_at ?? "",
      verified:
        VERIFICATION_RANK[(member.verified_level ?? "unverified") as VerificationLevel] >=
        VERIFICATION_RANK.phone,
    })),
    recentActivity: activity.map((item) => ({
      id: item.id,
      what: item.detail,
      at: item.created_at,
    })),
    viewer: viewerMembership
      ? {
          membership: viewerMembership.status as "queued" | "active",
          saveBackScore: Number(viewerMembership.save_back_score ?? 0),
        }
      : { membership: "none", saveBackScore: 0 },
  };
  // camelCase like every other DTO: the queue is a client-visible contract, not a row dump.
  const mappedQueue = queue.map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    note: row.note ?? null,
    requestedAt: row.requested_at,
  }));
  return json({ ...detail, canModerate: isModerator, queue: mappedQueue });
}

async function canModerate(c: AppContext, room: RoomRow): Promise<boolean> {
  if (!c.session) return false;
  if (c.session.user.role === "admin") return true;
  const membership = await c.env.DB.prepare(
    "SELECT role FROM room_members WHERE room_id = ? AND user_id = ? AND status = 'active'",
  )
    .bind(room.id, c.session.user.id)
    .first<{ role: string }>();
  return membership?.role === "owner" || membership?.role === "moderator";
}

async function uniqueRoomSlug(c: AppContext, name: string): Promise<string> {
  const base = slugify(name) || "room";
  for (let attempt = 1; attempt < 12; attempt++) {
    const candidate = attempt === 1 ? base : `${base}-${attempt}`;
    const clash = await DB.first<{ id: string }>(c.env, "SELECT id FROM rooms WHERE slug = ?", [
      candidate,
    ]);
    if (!clash) return candidate;
  }
  return `${base}-${newId("s").slice(2, 6)}`;
}

export async function createRoom(c: AppContext): Promise<Response> {
  if (!c.session) throw ApiError.unauthenticated("Sign in to open a room.");
  const input = await parseBody(createRoomInput, c.request);
  const business = await myBusiness(c);
  // A room is a moderation responsibility, so it requires a real listing: that is
  // what makes the "verified members only" rule enforceable.
  if (!business)
    throw ApiError.forbidden(
      "Open a business listing first — rooms are tied to a verified workspace.",
    );

  const base = await uniqueRoomSlug(c, input.name);
  const now = nowIso();
  const id = newId("rm");
  await DB.write(c.env, [
    {
      sql: `INSERT INTO rooms (id, slug, name, purpose, house_rule, state, verified_only, capacity, status, created_by_user_id, owned_by_business_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)`,
      params: [
        id,
        base,
        input.name,
        input.purpose,
        input.houseRule,
        input.state,
        input.verifiedOnly ? 1 : 0,
        input.capacity,
        c.session.user.id,
        business.id,
        now,
        now,
      ],
    },
    {
      sql: `INSERT INTO room_members (room_id, user_id, business_id, role, status, save_back_score, requested_at, joined_at)
            VALUES (?, ?, ?, 'owner', 'active', 0, ?, ?)`,
      params: [id, c.session.user.id, business.id, now, now],
    },
    {
      sql: "INSERT INTO room_activity (id, room_id, actor_user_id, kind, detail, created_at) VALUES (?, ?, ?, 'created', ?, ?)",
      params: [
        newId("rac"),
        id,
        c.session.user.id,
        `${business.name} opened this room. Pending review by GainHub admins.`,
        now,
      ],
    },
    {
      sql: `INSERT INTO moderation_items (id, item_type, target_id, business_id, reason, detail_json, risk, status, source, created_at)
            VALUES (?, 'room', ?, ?, 'New room awaiting review', ?, 'medium', 'pending', 'automated', ?)`,
      params: [
        newId("mod"),
        id,
        business.id,
        JSON.stringify({ name: input.name, purpose: input.purpose, state: input.state }),
        now,
      ],
    },
  ]);
  return json({ ok: true, id, slug: base, status: "pending" }, { status: 201 });
}

export async function joinRoom(c: AppContext): Promise<Response> {
  if (!c.session) throw ApiError.unauthenticated("Sign in to join a room.");
  const input = await parseBody(joinRoomInput, c.request);
  const room = await c.env.DB.prepare(`SELECT ${ROOM_SELECT} FROM rooms WHERE slug = ? OR id = ?`)
    .bind(c.params["slug"] ?? "", c.params["slug"] ?? "")
    .first<RoomRow>();
  if (!room) throw ApiError.notFound("Room not found.");
  if (room.status !== "active") throw ApiError.domain("This room is not open for new members yet.");
  if (Number(room.capacity) - Number(room.member_count ?? 0) <= 0)
    throw ApiError.domain("This room is at capacity. Try again when a slot opens.");

  const mine = await myBusiness(c);
  const trust =
    VERIFICATION_RANK[(mine?.verification_level ?? "unverified") as VerificationLevel] ?? 0;
  if (room.verified_only === 1 && trust < VERIFICATION_RANK.phone) {
    // Auto-verify on the two strongest levels only: email alone is not "verified" here.
    throw ApiError.forbidden(
      "This room is for verified businesses. Request verification from your workspace — it usually clears the same day.",
    );
  }

  const now = nowIso();
  const existing = await c.env.DB.prepare(
    "SELECT status FROM room_members WHERE room_id = ? AND user_id = ?",
  )
    .bind(room.id, c.session.user.id)
    .first<{ status: string }>();
  if (existing && existing.status !== "removed") {
    return json({ ok: true, status: existing.status, message: "You are already in this room." });
  }

  await DB.write(c.env, [
    {
      sql: `INSERT INTO room_members (room_id, user_id, business_id, role, status, note, requested_at)
            VALUES (?, ?, ?, 'member', 'queued', ?, ?)
            ON CONFLICT (room_id, user_id) DO UPDATE SET status = 'queued', note = excluded.note, requested_at = excluded.requested_at,
              removed_at = NULL, removed_reason = NULL, business_id = excluded.business_id`,
      params: [room.id, c.session.user.id, mine?.id ?? null, input.note ?? null, now],
    },
    {
      sql: "INSERT INTO room_activity (id, room_id, actor_user_id, kind, detail, created_at) VALUES (?, ?, ?, 'request', ?, ?)",
      params: [
        newId("rac"),
        room.id,
        c.session.user.id,
        `${c.session.user.displayName} asked to join.`,
        now,
      ],
    },
  ]);

  // Notify the room owner and moderators; the queue cap keeps a spam account from
  // pinging every moderator in the directory.
  const moderators = await all<{ user_id: string }>(
    c.env.DB,
    "SELECT user_id FROM room_members WHERE room_id = ? AND role IN ('owner','moderator') AND status = 'active' LIMIT 10",
    [room.id],
  );
  for (const moderator of moderators) {
    await notify(c.env, {
      userId: moderator.user_id,
      businessId: mine?.id ?? null,
      kind: "room_application",
      title: `New application for ${room.name}`,
      body: input.note
        ? `“${input.note.slice(0, 160)}”`
        : `${c.session.user.displayName} asked to join.`,
      href: `/app/rooms/${room.slug}`,
      dedupeKey: `room_application:${room.id}:${c.session.user.id}`,
    });
  }
  return json({ ok: true, status: "queued" }, { status: 201 });
}

export async function actOnRoomMember(c: AppContext): Promise<Response> {
  if (!c.session) throw ApiError.unauthenticated("Sign in first.");
  const input = await parseBody(roomActionInput, c.request);
  const room = await c.env.DB.prepare(`SELECT ${ROOM_SELECT} FROM rooms WHERE slug = ?`)
    .bind(c.params["slug"] ?? "")
    .first<RoomRow>();
  if (!room) throw ApiError.notFound("Room not found.");
  if (!(await canModerate(c, room)))
    throw ApiError.forbidden("Only room owners and moderators can review applications.");

  const member = await c.env.DB.prepare(
    "SELECT status, user_id FROM room_members WHERE room_id = ? AND user_id = ?",
  )
    .bind(room.id, input.memberId)
    .first<{ status: string; user_id: string }>();
  if (!member) throw ApiError.notFound("That member is not in this room.");

  const now = nowIso();
  let nextStatus = member.status;
  let detail = "";
  switch (input.action) {
    case "approve":
      if (member.status !== "queued")
        throw ApiError.conflict("Only pending applications can be approved.");
      nextStatus = "active";
      detail = `${input.memberId.slice(0, 8)} was approved.`;
      break;
    case "reject":
      if (member.status !== "queued")
        throw ApiError.conflict("Only pending applications can be rejected.");
      nextStatus = "removed";
      detail = `Application rejected${input.note ? `: ${input.note}` : "."}`;
      break;
    case "remove":
      if (member.user_id === room.created_by_user_id)
        throw ApiError.domain("The room owner cannot be removed.");
      nextStatus = "removed";
      detail = `${input.memberId.slice(0, 8)} was removed${input.note ? `: ${input.note}` : "."}`;
      break;
    case "restore":
      nextStatus = "active";
      detail = `${input.memberId.slice(0, 8)} was restored.`;
      break;
  }

  await DB.write(c.env, [
    {
      sql: `UPDATE room_members SET status = ?, note = COALESCE(?, note), joined_at = CASE WHEN ? = 'active' AND joined_at IS NULL THEN ? ELSE joined_at END,
              removed_at = CASE WHEN ? = 'removed' THEN ? ELSE NULL END, removed_reason = CASE WHEN ? = 'removed' THEN ? ELSE NULL END
          WHERE room_id = ? AND user_id = ?`,
      params: [
        nextStatus,
        input.note ?? null,
        nextStatus,
        now,
        nextStatus,
        now,
        nextStatus,
        input.note ?? null,
        room.id,
        input.memberId,
      ],
    },
    {
      sql: "INSERT INTO room_activity (id, room_id, actor_user_id, kind, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      params: [newId("rac"), room.id, c.session.user.id, `member_${input.action}`, detail, now],
    },
  ]);

  await notify(c.env, {
    userId: member.user_id,
    kind: "room_application",
    title:
      nextStatus === "active"
        ? `You joined ${room.name}`
        : `Update on your ${room.name} application`,
    body:
      nextStatus === "active"
        ? "Say hello and share what you sell — the first reply usually comes fastest."
        : (input.note ?? "The room moderators could not approve your request."),
    href: `/rooms/${room.slug}`,
    dedupeKey: `room_decision:${room.id}:${member.user_id}:${now.slice(0, 10)}`,
  });
  await recordAudit(c.env, {
    businessId: room.owned_by_business_id ?? null,
    actorUserId: c.session.user.id,
    actorLabel: c.session.user.displayName,
    action: `room.${input.action}`,
    resourceType: "room_member",
    resourceId: `${room.id}:${member.user_id}`,
    metadata: { status: nextStatus },
    ipHash: c.ipHash,
    requestId: c.requestId,
  });
  return json({ ok: true, status: nextStatus });
}

export async function roomCheckin(c: AppContext): Promise<Response> {
  if (!c.session) throw ApiError.unauthenticated("Sign in first.");
  const input = await parseBody(saveBackCheckinInput, c.request);
  const room = await c.env.DB.prepare(`SELECT ${ROOM_SELECT} FROM rooms WHERE slug = ?`)
    .bind(c.params["slug"] ?? "")
    .first<RoomRow>();
  if (!room) throw ApiError.notFound("Room not found.");
  const membership = await c.env.DB.prepare(
    "SELECT status, checks_passed, checks_failed FROM room_members WHERE room_id = ? AND user_id = ?",
  )
    .bind(room.id, c.session.user.id)
    .first<{ status: string; checks_passed: number; checks_failed: number }>();
  if (!membership || membership.status !== "active")
    throw ApiError.forbidden("Only active members can check in.");

  const now = nowIso();
  // Save-back score is derived from behaviour, never from a client-supplied number:
  // passing a check-in raises it, skipping weeks lowers it.
  const passed = input.savedContacts > 0;
  const checksPassed = Number(membership.checks_passed ?? 0) + (passed ? 1 : 0);
  const checksFailed = Number(membership.checks_failed ?? 0) + (passed ? 0 : 1);
  const ratio = checksPassed / Math.max(1, checksPassed + checksFailed);
  const score = Math.max(
    0,
    Math.min(100, Math.round(ratio * 60 + Math.min(40, input.savedContacts * 4))),
  );

  await DB.write(c.env, [
    {
      sql: `UPDATE room_members SET checks_passed = ?, checks_failed = ?, save_back_score = ?, last_checkin_at = ?
            WHERE room_id = ? AND user_id = ?`,
      params: [checksPassed, checksFailed, score, now, room.id, c.session.user.id],
    },
    {
      sql: "INSERT INTO room_activity (id, room_id, actor_user_id, kind, detail, created_at) VALUES (?, ?, ?, 'checkin', ?, ?)",
      params: [
        newId("rac"),
        room.id,
        c.session.user.id,
        `${c.session.user.displayName} checked in with ${input.savedContacts} saved contact${input.savedContacts === 1 ? "" : "s"}.`,
        now,
      ],
    },
  ]);
  return json({ ok: true, saveBackScore: score, meetsMinimum: score >= SAVE_BACK_MINIMUM });
}

export async function myRooms(c: AppContext): Promise<Response> {
  if (!c.session) throw ApiError.unauthenticated("Sign in first.");
  const rows = await all<RoomRow & { membership_status: string; save_back_score: number }>(
    c.env.DB,
    `SELECT r.id, r.slug, r.name, r.purpose, r.house_rule, r.state, r.verified_only, r.capacity, r.member_count,
            r.avg_save_back, r.status, m.status AS membership_status, m.save_back_score
       FROM room_members m JOIN rooms r ON r.id = m.room_id
      WHERE m.user_id = ? AND m.status <> 'removed' ORDER BY m.joined_at DESC LIMIT 40`,
    [c.session.user.id],
  );
  return json({
    items: rows.map((row) => ({
      ...mapRoom(row),
      membership: row.membership_status,
      saveBackScore: Number(row.save_back_score ?? 0),
    })),
  });
}
