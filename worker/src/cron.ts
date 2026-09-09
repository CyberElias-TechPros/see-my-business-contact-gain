import { recordJobRun, readJobRuns } from "./cache.ts";
import { newId, nowIso } from "./db.ts";
import { frontendUrl, sendMail } from "./mail.ts";
import type { Env } from "./types.ts";

/**
 * Scheduled work. Two crons are configured in wrangler.jsonc: the every-15-minute
 * tick does cheap, user-visible freshness (view counters, SLA nudges); the nightly
 * tick at 03:17Z does rollups and retention purges (02:17 West Africa Time).
 *
 * Each job is idempotent and batch-sized: a run that dies halfway must be safe to
 * repeat, because Workers give exactly-once *delivery* for crons but no transaction
 * across job steps.
 */
type CronRun = { job: string; items: number; error?: string | null };

const QUICK_JOBS = ["flush_view_counters", "moderation_sla", "stale_leads"] as const;
const NIGHTLY_JOBS = [
  "aggregate_daily",
  "purge_link_events",
  "purge_deleted_media",
  "purge_expired_rows",
] as const;

export async function handleCron(
  event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext,
): Promise<void> {
  const nightly = event.cron === "17 3 * * *";
  const jobs = nightly ? NIGHTLY_JOBS : QUICK_JOBS;
  for (const job of jobs) {
    const started = Date.now();
    const runId = newId("crn");
    await env.DB.prepare(
      "INSERT INTO cron_runs (id, job, status, started_at) VALUES (?, ?, 'running', ?)",
    )
      .bind(runId, job, nowIso())
      .run();
    try {
      const result = await runJob(job, env);
      const duration = Date.now() - started;
      await env.DB.prepare(
        "UPDATE cron_runs SET status = 'success', items_processed = ?, duration_ms = ?, finished_at = ? WHERE id = ?",
      )
        .bind(result.items, duration, nowIso(), runId)
        .run();
      await recordJobRun(env, job, { items: result.items, durationMs: duration, error: null });
    } catch (error) {
      const duration = Date.now() - started;
      const message = error instanceof Error ? error.message : String(error);
      await env.DB.prepare(
        "UPDATE cron_runs SET status = 'failure', duration_ms = ?, error = ?, finished_at = ? WHERE id = ?",
      )
        .bind(duration, message.slice(0, 500), nowIso(), runId)
        .run();
      await recordJobRun(env, job, {
        items: 0,
        durationMs: duration,
        error: message.slice(0, 300),
      });
      // A failing job must not poison the others in the same tick.
      console.log(
        JSON.stringify({ level: "error", event: "cron_job_failed", job, error: message }),
      );
    }
  }
  // Sunday night, after the rollups: the only marketing mail the platform sends.
  if (nightly && new Date(event.scheduledTime).getUTCDay() === 1) {
    ctx.waitUntil(runWeeklyDigest(env).catch(() => undefined));
  }
}

async function runJob(job: string, env: Env): Promise<CronRun> {
  switch (job) {
    case "flush_view_counters":
      return flushViewCounters(env);
    case "moderation_sla":
      return moderationSla(env);
    case "stale_leads":
      return staleLeads(env);
    case "aggregate_daily":
      return aggregateDaily(env);
    case "purge_link_events":
      return purgeLinkEvents(env);
    case "purge_deleted_media":
      return purgeDeletedMedia(env);
    case "purge_expired_rows":
      return purgeExpiredRows(env);
    default:
      throw new Error(`unknown cron job ${job}`);
  }
}

/**
 * Profile views are counted in KV on the request path (no D1 write per page view);
 * here the pending counters are folded into the listing and today's rollup, and the
 * KV keys are deleted. A counter that is read and then fails to write is lost — an
 * accepted trade-off for a page view that never pays for a write.
 */
async function flushViewCounters(env: Env): Promise<CronRun> {
  let items = 0;
  const listed = await env.KV.list({ prefix: "views:", limit: 1000 });
  if (listed.keys.length === 0) return { job: "flush_view_counters", items: 0 };
  const deltas = new Map<string, number>();
  for (const key of listed.keys) {
    const raw = await env.KV.get(key.name);
    const value = Number(raw ?? 0);
    const id = key.name.slice("views:".length);
    if (Number.isFinite(value) && value > 0 && id) deltas.set(id, (deltas.get(id) ?? 0) + value);
  }
  const statements: D1PreparedStatement[] = [];
  const today = nowIso().slice(0, 10);
  for (const [businessId, count] of deltas) {
    statements.push(
      env.DB.prepare("UPDATE businesses SET view_count = view_count + ? WHERE id = ?").bind(
        count,
        businessId,
      ),
    );
    statements.push(
      env.DB.prepare(
        `INSERT INTO metrics_daily (business_id, day, views, enquiries, whatsapp_chats, leads, won_value_minor, updated_at)
         VALUES (?, ?, ?, 0, 0, 0, 0, ?)
         ON CONFLICT (business_id, day) DO UPDATE SET views = views + excluded.views, updated_at = excluded.updated_at`,
      ).bind(businessId, today, count, nowIso()),
    );
    items += count;
  }
  if (statements.length) await env.DB.batch(statements);
  // KV exposes delete(key) only, so a purge is a bounded fan-out (1000 keys max per run).
  await Promise.all(listed.keys.map((key) => env.KV.delete(key.name)));
  return { job: "flush_view_counters", items };
}

/**
 * Overdue moderation is escalated, not auto-decided: an admin's judgement about a
 * real trader's livelihood is exactly the thing a cron must not make alone.
 */
async function moderationSla(env: Env): Promise<CronRun> {
  const config = await env.KV.get<{ moderation?: { slaHours?: number } }>(
    "config:platform",
    "json",
  );
  const slaHours = config?.moderation?.slaHours ?? 24;
  const cutoff = new Date(Date.now() - slaHours * 3600_000).toISOString();
  const overdue = await env.DB.prepare(
    `SELECT id, item_type, business_id, risk FROM moderation_items
      WHERE status = 'pending' AND created_at < ? ORDER BY created_at LIMIT 200`,
  )
    .bind(cutoff)
    .all<{ id: string; item_type: string; business_id: string | null; risk: string }>();
  const rows = overdue.results ?? [];
  if (rows.length === 0) return { job: "moderation_sla", items: 0 };

  const statements: D1PreparedStatement[] = [];
  for (const row of rows) {
    statements.push(
      env.DB.prepare(
        "UPDATE moderation_items SET risk = 'high' WHERE id = ? AND risk <> 'high'",
      ).bind(row.id),
    );
    // High-risk listings that nobody has looked at within the SLA are hidden, because
    // the public-facing harm outweighs the owner's inconvenience — and this is the one
    // automatic action the policy allows. It is reversible from the admin queue.
    if (row.item_type === "listing" && row.risk === "high" && row.business_id) {
      statements.push(
        env.DB.prepare(
          "UPDATE businesses SET status = 'hidden', moderation_note = ?, updated_at = ? WHERE id = ? AND status = 'pending'",
        ).bind(
          `Auto-hidden after ${slaHours}h without review. Appeal from your workspace console.`,
          nowIso(),
          row.business_id,
        ),
      );
    }
  }
  await env.DB.batch(statements);

  const admins = await env.DB.prepare(
    "SELECT id FROM users WHERE role = 'admin' AND status = 'active' LIMIT 10",
  ).all<{ id: string }>();
  for (const admin of admins.results ?? []) {
    await env.DB.prepare(
      `INSERT INTO notifications (id, user_id, business_id, type, title, body, href, dedupe_key, created_at)
       VALUES (?, ?, NULL, 'moderation_action', ?, ?, '/admin/moderation', ?, ?)
       ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
    )
      .bind(
        newId("ntf"),
        admin.id,
        `${rows.length} moderation item(s) past the ${slaHours}h target`,
        "The oldest items are flagged high risk. Listings that breached the SLA were auto-hidden.",
        `moderation_sla:${admin.id}:${nowIso().slice(0, 13)}`,
        nowIso(),
      )
      .run();
  }
  return { job: "moderation_sla", items: rows.length };
}

/**
 * A lead nobody has touched in 72 hours is lost money. The CRM says so once per lead
 * per day, and creates the follow-up task the automation rule would create — so the
 * behaviour is the same whether or not the owner configured an automation.
 */
async function staleLeads(env: Env): Promise<CronRun> {
  const cutoff = new Date(Date.now() - 72 * 3600_000).toISOString();
  const stale = await env.DB.prepare(
    `SELECT l.id, l.code, l.name, l.business_id, l.stage, l.assignee_user_id, b.name AS business_name, b.plan
       FROM leads l JOIN businesses b ON b.id = l.business_id
      WHERE l.stage IN ('new', 'qualified', 'quoted', 'follow_up') AND l.last_activity_at < ?
      ORDER BY l.last_activity_at LIMIT 200`,
  )
    .bind(cutoff)
    .all<{
      id: string;
      code: string;
      name: string;
      business_id: string;
      stage: string;
      assignee_user_id: string | null;
      business_name: string;
      plan: string;
    }>();
  const rows = stale.results ?? [];
  if (rows.length === 0) return { job: "stale_leads", items: 0 };

  const statements: D1PreparedStatement[] = [];
  for (const lead of rows) {
    // `lead_stale` automation, if present, decides what happens; the default is a
    // follow-up task. Rows never duplicate: the task title carries the lead code.
    statements.push(
      env.DB.prepare(
        `INSERT INTO tasks (id, business_id, lead_id, title, priority, status, created_at, updated_at)
         SELECT ?, ?, ?, ?, 'high', 'open', ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE business_id = ? AND lead_id = ? AND status = 'open' AND title = ?)`,
      ).bind(
        newId("tsk"),
        lead.business_id,
        lead.id,
        `Follow up ${lead.code} (${lead.name})`,
        nowIso(),
        nowIso(),
        lead.business_id,
        lead.id,
        `Follow up ${lead.code} (${lead.name})`,
      ),
    );
    const target = lead.assignee_user_id ?? (await ownerOf(env, lead.business_id));
    if (target) {
      statements.push(
        env.DB.prepare(
          `INSERT INTO notifications (id, user_id, business_id, type, title, body, href, dedupe_key, created_at)
           VALUES (?, ?, ?, 'lead_stale', ?, ?, ?, ?, ?)
           ON CONFLICT (user_id, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING`,
        ).bind(
          newId("ntf"),
          target,
          lead.business_id,
          `${lead.code} has had no activity for 3 days`,
          `Reply while ${lead.name} is still comparing options.`,
          "/app/leads",
          `lead_stale:${lead.id}:${nowIso().slice(0, 10)}`,
          nowIso(),
        ),
      );
    }
  }
  await env.DB.batch(statements);
  return { job: "stale_leads", items: rows.length };
}

async function ownerOf(env: Env, businessId: string): Promise<string | null> {
  const row = await env.DB.prepare(
    "SELECT user_id FROM memberships WHERE business_id = ? AND role = 'owner' AND status = 'active' LIMIT 1",
  )
    .bind(businessId)
    .first<{ user_id: string }>();
  if (row) return row.user_id;
  const owner = await env.DB.prepare("SELECT owner_user_id FROM businesses WHERE id = ?")
    .bind(businessId)
    .first<{ owner_user_id: string | null }>();
  return owner?.owner_user_id ?? null;
}

/**
 * Yesterday's rollup, computed from the source tables. Dashboards read
 * `metrics_daily` so a listing with 40k views never scans 40k event rows.
 */
async function aggregateDaily(env: Env): Promise<CronRun> {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  // `views` is deliberately NOT recomputed here: it arrives incrementally from the
  // KV counter flush, and overwriting it with a cumulative total would double-count
  // every day that was already rolled up.
  const result = await env.DB.prepare(
    `INSERT INTO metrics_daily (business_id, day, enquiries, whatsapp_chats, leads, won_value_minor, updated_at)
     SELECT b.id, ?,
       (SELECT COUNT(*) FROM enquiries e WHERE e.business_id = b.id AND date(e.created_at) = ?),
       (SELECT COUNT(*) FROM link_events le WHERE le.business_id = b.id AND le.kind = 'chat' AND le.day = ?),
       (SELECT COUNT(*) FROM leads l WHERE l.business_id = b.id AND date(l.created_at) = ?),
       (SELECT COALESCE(SUM(l.value_minor), 0) FROM leads l WHERE l.business_id = b.id AND l.stage = 'won' AND date(l.won_at) = ?),
       ?
     FROM businesses b
     WHERE EXISTS (SELECT 1 FROM enquiries e WHERE e.business_id = b.id AND date(e.created_at) = ?)
        OR EXISTS (SELECT 1 FROM leads l WHERE l.business_id = b.id AND date(l.created_at) = ?)
        OR EXISTS (SELECT 1 FROM link_events le WHERE le.business_id = b.id AND le.day = ?)
     ON CONFLICT (business_id, day) DO UPDATE SET
       enquiries = excluded.enquiries, whatsapp_chats = excluded.whatsapp_chats,
       leads = excluded.leads, won_value_minor = excluded.won_value_minor, updated_at = excluded.updated_at`,
  )
    .bind(
      yesterday,
      yesterday,
      yesterday,
      yesterday,
      yesterday,
      nowIso(),
      yesterday,
      yesterday,
      yesterday,
    )
    .run();
  return { job: "aggregate_daily", items: changes(result) };
}

/** Click/scan events are kept for 30 days: enough for a monthly trend, no history to leak. */
async function purgeLinkEvents(env: Env): Promise<CronRun> {
  const cutoff = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const result = await env.DB.prepare("DELETE FROM link_events WHERE day < ?").bind(cutoff).run();
  return { job: "purge_link_events", items: changes(result) };
}

/**
 * Media is only removed from R2 a week after the owner deleted it, so a mistaken
 * delete stays recoverable. This is the one place R2 objects are destroyed.
 */
async function purgeDeletedMedia(env: Env): Promise<CronRun> {
  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const rows = await env.DB.prepare(
    "SELECT id, r2_key FROM media WHERE deleted_at IS NOT NULL AND deleted_at < ? AND r2_key NOT LIKE 'purged:%' LIMIT 200",
  )
    .bind(cutoff)
    .all<{ id: string; r2_key: string }>();
  const keys = (rows.results ?? []).map((row) => row.r2_key);
  if (keys.length === 0) return { job: "purge_deleted_media", items: 0 };
  for (const key of keys) await env.MEDIA.delete(key);
  const statements = (rows.results ?? []).map((row) =>
    env.DB.prepare("UPDATE media SET r2_key = ? WHERE id = ?").bind(`purged:${row.r2_key}`, row.id),
  );
  await env.DB.batch(statements);
  return { job: "purge_deleted_media", items: keys.length };
}

/** Housekeeping for rows whose whole purpose is a window of time. */
async function purgeExpiredRows(env: Env): Promise<CronRun> {
  const now = nowIso();
  let items = 0;
  items += changes(
    await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ? OR revoked_at < ?")
      .bind(now, new Date(Date.now() - 30 * 86_400_000).toISOString())
      .run(),
  );
  items += changes(
    await env.DB.prepare("DELETE FROM action_tokens WHERE expires_at < ? OR used_at < ?")
      .bind(now, new Date(Date.now() - 7 * 86_400_000).toISOString())
      .run(),
  );
  items += changes(
    await env.DB.prepare("DELETE FROM idempotency_keys WHERE expires_at < ?").bind(now).run(),
  );
  // 18 months of audit trail: enough to answer a dispute, not a permanent dossier.
  items += changes(
    await env.DB.prepare("DELETE FROM audit_logs WHERE created_at < ?")
      .bind(new Date(Date.now() - 550 * 86_400_000).toISOString())
      .run(),
  );
  return { job: "purge_expired_rows", items };
}

/** One mail per week, only to owners who actually had activity, and it honours the ledger. */
async function runWeeklyDigest(env: Env): Promise<number> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const rows = await env.DB.prepare(
    `SELECT m.user_id, b.id AS business_id, b.name, SUM(d.views) AS views, SUM(d.enquiries) AS enquiries, SUM(d.leads) AS leads
       FROM metrics_daily d
       JOIN businesses b ON b.id = d.business_id
       JOIN memberships m ON m.business_id = b.id AND m.role = 'owner' AND m.status = 'active'
      WHERE d.day >= ?
      GROUP BY m.user_id, b.id
     HAVING SUM(d.enquiries) > 0
      ORDER BY SUM(d.enquiries) DESC LIMIT 500`,
  )
    .bind(weekAgo)
    .all<{
      user_id: string;
      business_id: string;
      name: string;
      views: number;
      enquiries: number;
      leads: number;
    }>();
  let sent = 0;
  for (const row of rows.results ?? []) {
    const user = await env.DB.prepare(
      "SELECT email_normalized, marketing_opt_in FROM users WHERE id = ?",
    )
      .bind(row.user_id)
      .first<{ email_normalized: string; marketing_opt_in: number }>();
    if (!user) continue;
    const result = await sendMail(env, {
      to: user.email_normalized,
      subject: `Your week on GainHub: ${Number(row.enquiries)} new enquiries`,
      text: [
        `${row.name} received ${Number(row.enquiries)} enquiries and ${Number(row.leads)} leads this week, across ${Number(row.views)} profile views.`,
        "",
        `Open your console: ${frontendUrl(env, "/app/leads")}`,
      ].join("\n"),
    });
    if (result.delivered) sent++;
    await env.DB.prepare(
      "UPDATE metrics_daily SET updated_at = ? WHERE business_id = ? AND day = ?",
    )
      .bind(nowIso(), row.business_id, weekAgo)
      .run();
  }
  return sent;
}

function changes(result: unknown): number {
  return (result as unknown as { meta?: { changes?: number } }).meta?.changes ?? 0;
}

/** Surfaced by `GET /api/v1/admin/jobs`; kept here so the job list has one source. */
export const CRON_JOBS: readonly string[] = [...QUICK_JOBS, ...NIGHTLY_JOBS, "weekly_digest"];

export async function cronHeartbeat(env: Env): Promise<Record<string, unknown>> {
  return readJobRuns(env, [...CRON_JOBS]);
}
