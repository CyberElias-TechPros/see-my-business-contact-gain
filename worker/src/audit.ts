import { newId, nowIso } from "./db.ts";
import type { Env } from "./types.ts";

/**
 * Audit trail for anything a human or the system can be asked about later:
 * who did it, to what, when, from which request.
 *
 * Deliberately excludes secrets and raw contact values — `metadata` is expected
 * to hold ids and enum states, and everything passes through the log redactor.
 */
export type AuditEvent = {
  businessId?: string | null;
  actorUserId?: string | null;
  actorLabel: string;
  actorKind?: "user" | "admin" | "system" | "cron";
  action: string;
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
  requestId?: string;
};

export async function recordAudit(env: Env, event: AuditEvent): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO audit_logs (id, business_id, actor_user_id, actor_label, actor_kind, action, resource_type, resource_id, metadata_json, ip_hash, request_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      newId("aud"),
      event.businessId ?? null,
      event.actorUserId ?? null,
      event.actorLabel.slice(0, 120),
      event.actorKind ?? "user",
      event.action.slice(0, 80),
      event.resourceType.slice(0, 40),
      String(event.resourceId).slice(0, 60),
      JSON.stringify(event.metadata ?? {}),
      event.ipHash ?? null,
      event.requestId ?? null,
      nowIso(),
    )
    .run();
}

export function systemAudit(
  partial: Omit<AuditEvent, "actorLabel"> & { actorLabel?: string },
): AuditEvent {
  return { actorKind: "system", actorLabel: "System", ...partial };
}
