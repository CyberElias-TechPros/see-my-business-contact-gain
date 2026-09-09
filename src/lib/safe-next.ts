/**
 * The one place that decides where a signed-in visitor may be sent.
 *
 * `/auth?next=/app/leads` is how the header, the workspace guards and `/claim` all hand over after
 * a sign-in, which makes the `next` parameter the most dangerous string in the app: a form that
 * bounces you to `https://evil.example` after you type a password is a working phishing kit that
 * runs on our own origin and our own TLS certificate.
 *
 * So only an origin-relative path survives, and everything else collapses to `/app` — the
 * destination that is correct for any signed-in visitor:
 *
 * - must start with a single `/` (rejects `https://host`, `javascript:`, and `//host`, which the
 *   browser resolves against the *page's* scheme and lands off-site);
 * - rejects backslashes and control characters, because `/\evil.com` is treated as a path by us
 *   and as a host by some browsers;
 * - rejects the auth pages themselves, which would otherwise loop, and any `.`/`..` segment that
 *   could smuggle a checked path into an unchecked one (`/auth/../admin`);
 * - keeps the original string (query and hash included) once it is known to be safe, so
 *   `?next=/search?q=plumber` does not lose its own parameters.
 *
 * Lives in `src/lib`, not in the route file, because route files that export anything but a
 * component break React Fast Refresh (see `docs/FRONTEND.md`) — and because `/claim` needs it too.
 */

export const AUTH_RETURN_FALLBACK = "/app";

export function safeNext(value: string | undefined): string {
  if (!value || value.length > 500) return AUTH_RETURN_FALLBACK;
  if (!value.startsWith("/")) return AUTH_RETURN_FALLBACK;
  if (value.startsWith("//")) return AUTH_RETURN_FALLBACK;
  if (/\\/u.test(value) || /[\s\p{C}]/u.test(value)) return AUTH_RETURN_FALLBACK;
  const [path] = value.split(/[?#]/);
  if (!path) return AUTH_RETURN_FALLBACK;
  // No legitimate `next` needs a dot segment, and rejecting them keeps `/auth/../admin` from
  // reading as "not the auth page" while the browser resolves it into somewhere we never checked.
  // Split rather than matched: `.`/`..` are whole path segments, and comparing segments cannot go
  // wrong on the `/../`-style shapes a regex has to be written carefully to catch.
  if (path.split("/").some((segment) => segment === "." || segment === "..")) {
    return AUTH_RETURN_FALLBACK;
  }
  const normalised = path.toLowerCase().replace(/\/+$/, "");
  if (normalised === "/auth" || normalised === "/login" || normalised === "/signup") {
    return AUTH_RETURN_FALLBACK;
  }
  return value;
}
