import { newId, nowIso } from "./db.ts";
import type { Env } from "./types.ts";

/**
 * Notifications: an in-app row for the bell, plus one queue message for async
 * email. User-facing requests never wait on a mail provider (section: third-party
 * failure strategy) — the queue owns retries and the row is the source of truth.
 */
export type NotificationKind =
  | "new_enquiry"
  | "new_lead"
  | "lead_assigned"
  | "new_review"
  | "review_reply"
  | "claim_decision"
  | "verification_decision"
  | "moderation_action"
  | "media_approved"
  | "team_invite"
  | "invoice_paid"
  | "lead_stale"
  | "room_application";

export type NotifyInput = {
  userId: string;
  businessId?: string | null;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string | null;
  /** Stable key so a retried request cannot double-ping the user. */
  dedupeKey?: string | null;
  email?: { subject: string; text: string; to?: string | null } | null;
};

export async function notify(env: Env, input: NotifyInput): Promise<void> {
  const id = newId("ntf");
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO notifications (id, user_id, business_id, type, title, body, href, dedupe_key, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
  )
    .bind(
      id,
      input.userId,
      input.businessId ?? null,
      input.kind,
      input.title.slice(0, 160),
      input.body.slice(0, 600),
      input.href ?? null,
      input.dedupeKey ? input.dedupeKey.slice(0, 120) : null,
      now,
    )
    .run();

  if (input.email) {
    await env.EMAIL_QUEUE.send({
      type: "email",
      to: input.email.to ?? null,
      subject: input.email.subject,
      text: input.email.text,
      userId: input.userId,
      idempotencyKey: input.dedupeKey ?? id,
      queuedAt: now,
    });
  }
}

export async function notifyBusinessOwners(
  env: Env,
  businessId: string,
  input: Omit<NotifyInput, "userId" | "businessId"> & { includeAgent?: string | null },
): Promise<number> {
  const rows = await env.DB.prepare(
    `SELECT user_id FROM memberships WHERE business_id = ? AND status = 'active' AND role IN ('owner','manager')`,
  )
    .bind(businessId)
    .all<{ user_id: string }>();
  const targets = rows.results ?? [];
  for (const row of targets) {
    await notify(env, { ...input, userId: row.user_id, businessId });
  }
  return targets.length;
}

export type QueueEmailMessage = {
  type: "email";
  to: string | null;
  subject: string;
  text: string;
  userId: string | null;
  idempotencyKey: string;
  queuedAt: string;
};

export type QueueCleanupMessage = { type: "media_delete"; key: string; mediaId: string };
export type QueueWebhookMessage = {
  type: "webhook";
  url: string;
  payload: Record<string, unknown>;
};

export type QueueMessage = QueueEmailMessage | QueueCleanupMessage | QueueWebhookMessage;
