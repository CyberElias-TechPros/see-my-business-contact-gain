import type { D1Database } from "@cloudflare/workers-types";

export async function audit(
  db: D1Database,
  actor: string,
  action: string,
  businessId: string | null,
): Promise<void> {
  try {
    await db
      .prepare(
        `INSERT INTO audit_log (actor, action, business_id, created_at) VALUES (?1, ?2, ?3, ?4)`,
      )
      .bind(actor, action, businessId, Date.now())
      .run();
  } catch {
    // Auditing must never break the request path.
  }
}
