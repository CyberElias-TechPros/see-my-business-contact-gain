/**
 * Hands the CSRF token that SSR already fetched to the browser-side API client.
 *
 * `api-client` keeps the token module-side and attaches it to every unsafe request. Without this
 * component the browser would refetch `/api/v1/auth/session` before the first enquiry, review or
 * sign-out — one extra round trip in front of the action the visitor cares about, on a page that
 * already had the answer in its own HTML.
 *
 * It also keeps the token honest across a sign-in or sign-out in this tab: `useQuery` re-reads the
 * session when the key is invalidated, and the effect below re-primes whatever the cache now holds.
 * A stale token is not a footgun either — the API replies 403 with a clear message and
 * `apiFetch` drops the cached value and retries once.
 *
 * Mounted exactly once, inside the `QueryClientProvider` the root route renders.
 */
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";

import { setCsrfToken } from "../../lib/api-client.ts";
import { sessionQuery } from "../../lib/queries.ts";

export function SessionPrimer() {
  const { data } = useQuery(sessionQuery());
  const token = data?.csrfToken ?? "";

  useEffect(() => {
    // Empty string means "no session": clear the cached token instead of leaving a previous
    // visitor's behind, which is what a sign-out in this tab looks like.
    setCsrfToken(token || null);
  }, [token]);

  return null;
}
