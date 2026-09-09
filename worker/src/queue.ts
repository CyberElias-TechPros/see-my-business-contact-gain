import { nowIso } from "./db.ts";
import { sendMail } from "./mail.ts";
import type { QueueMessage } from "./notifications.ts";
import type { Env } from "./types.ts";

/**
 * Background work for the notification queue.
 *
 * Failure policy, stated because it is the whole point of using a queue:
 *  - a provider outage or a 5xx throws, so Cloudflare retries the batch with the
 *    backoff configured in wrangler.jsonc (3 attempts, 30s) and then parks it;
 *  - a permanent problem (malformed message, unverifiable address) is acked and
 *    logged, because retrying it only delays every message behind it;
 *  - a mail provider that is simply not configured (fresh clone, CI, preview) is
 *    acked: the in-app notification row was already written by `notify()`, so the
 *    user-visible product still works and no queue backs up.
 */
export async function handleQueue(batch: MessageBatch<QueueMessage>, env: Env): Promise<void> {
  for (const message of batch.messages) {
    try {
      await handleOne(message.body, env);
      message.ack();
    } catch (error) {
      if (error instanceof PermanentQueueError) {
        message.ack();
        log(env, "error", "queue_message_dropped", { reason: String(error) });
        continue;
      }
      log(env, "warn", "queue_message_retry", { error: String(error) });
      message.retry();
    }
  }
}

class PermanentQueueError extends Error {}

async function handleOne(body: QueueMessage, env: Env): Promise<void> {
  switch (body.type) {
    case "email": {
      if (!body.to) return; // in-app only: nothing to deliver
      if (!body.subject || !body.text)
        throw new PermanentQueueError("email message missing subject or body");
      const result = await sendMail(env, { to: body.to, subject: body.subject, text: body.text });
      if (!result.delivered) {
        if (result.reason === "provider_not_configured") {
          log(env, "info", "mail_not_configured", { subject: result ? body.subject : "" });
          return;
        }
        if (result.reason === "invalid_recipient")
          throw new PermanentQueueError("refusing to send to an invalid address");
        throw new Error(result.reason ?? "mail provider failed");
      }
      return;
    }
    case "media_delete": {
      if (!body.key) throw new PermanentQueueError("media_delete without a key");
      await env.MEDIA.delete(body.key);
      // R2 deletes are idempotent, so the row is left as the tombstone (`deleted_at`
      // is already set); a retried message must not resurrect or double-delete.
      return;
    }
    case "webhook": {
      if (!body.url || !/^https:\/\//.test(body.url))
        throw new PermanentQueueError("webhook url must be https");
      const response = await fetch(body.url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body.payload ?? {}),
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok && response.status >= 500)
        throw new Error(`webhook responded ${response.status}`);
      return;
    }
    default:
      throw new PermanentQueueError("unknown queue message type");
  }
}

function log(
  env: Env,
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown>,
): void {
  // Queue contexts have no request-scoped logger; the same shape is reproduced here,
  // deliberately without recipient addresses or tokens.
  console.log(
    JSON.stringify({ level, event, env: env.APP_ENV ?? "production", at: nowIso(), ...fields }),
  );
}
