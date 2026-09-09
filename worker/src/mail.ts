import type { Env } from "./types.ts";

/**
 * Email transport.
 *
 * `RESEND_API_KEY` + `MAIL_FROM` enable real delivery. When they are absent
 * (fresh clone, CI, preview) the mailer degrades to a structured log line so the
 * rest of the product — queue, notifications, admin views — stays testable and
 * no request fails because an unconfigured provider was unreachable.
 */
export type Mail = { to: string; subject: string; text: string; html?: string };

export type MailResult = { delivered: boolean; provider: "resend" | "log"; reason?: string };

export async function sendMail(env: Env, mail: Mail): Promise<MailResult> {
  if (!isEmail(mail.to)) return { delivered: false, provider: "log", reason: "invalid_recipient" };
  if (!env.RESEND_API_KEY || !env.MAIL_FROM) {
    console.info(JSON.stringify({ event: "mail_skipped", to: mail.to, subject: mail.subject }));
    return { delivered: false, provider: "log", reason: "provider_not_configured" };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: env.MAIL_FROM,
      to: [mail.to],
      subject: mail.subject,
      text: mail.text,
      ...(mail.html ? { html: mail.html } : {}),
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`mail provider responded ${response.status}: ${detail.slice(0, 200)}`);
  }
  return { delivered: true, provider: "resend" };
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value);
}

/** The links in transactional mail always point at the frontend, never the API. */
export function frontendUrl(env: Env, path: string): string {
  const base = (env.PUBLIC_URL ?? "https://gainhub.ng").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
