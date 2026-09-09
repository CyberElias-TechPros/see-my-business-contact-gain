/**
 * Bindings for the GainHub API Worker.
 *
 * `npm run cf:typegen` regenerates this file's `Cloudflare.Env` shape from
 * `worker/wrangler.jsonc`; the hand-written version is checked in so `tsc`,
 * `vitest` and editors resolve bindings even where the Cloudflare CLI cannot run
 * (offline CI, sandboxes). `npm run check:env` diffs the two — a binding added to
 * wrangler.jsonc without a type here fails CI rather than surprising you at runtime.
 *
 * Runtime globals (D1Database, KVNamespace, R2Bucket, ExecutionContext, Queue, …)
 * come from `@cloudflare/workers-types`; only the env shape belongs in this file.
 */
declare namespace Cloudflare {
  interface Env {
    /** `production` | `staging` | `development` | `test` */
    APP_ENV: string;
    /** Injected by the deploy scripts; `/api/v1/version` reports them. */
    GIT_SHA?: string;
    APP_VERSION?: string;
    DB: D1Database;
    KV: KVNamespace;
    MEDIA: R2Bucket;
    EMAIL_QUEUE: Queue<import("./src/notifications.ts").QueueMessage>;

    /** Public origin of the frontend (links, emails, canonical URLs, redirects). */
    PUBLIC_URL: string;
    /** Origin the API itself is reached at; used to build media and upload URLs. */
    API_URL: string;
    /** Comma-separated browser origins allowed to send credentialed cross-origin calls. */
    ALLOWED_ORIGINS?: string;
    /** Cookie scope; empty means host-only (what `wrangler dev` uses). */
    COOKIE_DOMAIN?: string;
    /** Set to `1` when the frontend and API are on different site names, so the session cookie needs SameSite=None. */
    COOKIE_SAMESITE_NONE?: string;
    /** HMAC key for upload tickets and derived CSRF tokens. Secret, never logged. */
    SECRET_KEY: string;
    /** Hard cap on an uploaded object, in bytes. Defaults to shared/domain.MAX_UPLOAD_BYTES. */
    MEDIA_MAX_BYTES?: string;

    RESEND_API_KEY?: string;
    MAIL_FROM?: string;
  }
}
