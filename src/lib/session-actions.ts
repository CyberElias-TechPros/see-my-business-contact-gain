/**
 * Session-changing actions shared by the header and the account menu, so "sign out" behaves
 * identically wherever it is clicked.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";

import { apiFetch, setCsrfToken } from "./api-client.ts";

/** Routes that have nothing to show a signed-out visitor — send them home instead of an empty shell. */
const PRIVATE_PREFIXES = ["/app", "/admin", "/account"];

/**
 * Revokes the session server-side and drops every cached read with it.
 *
 * The cache reset is the important half: each key on a public page holds data the API filtered for
 * the person who just left (their saved list, their workspace numbers), and the components still
 * mounted would keep rendering it as if it belonged to the next visitor. Clearing is also what
 * makes the header flip back to "Sign in" without a round trip.
 *
 * A failed `POST /auth/logout` does not abort the reset. The server-side revocation is best-effort
 * from the client's point of view — leaving someone stuck in a session they explicitly asked to
 * leave, because our own API had a bad minute, is the worse outcome.
 */
export function useSignOut(): () => Promise<void> {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return useCallback(async () => {
    try {
      await apiFetch("/api/v1/auth/logout", { method: "POST" });
    } catch {
      // Intentionally silent: see above.
    }
    setCsrfToken(null);
    queryClient.clear();
    if (PRIVATE_PREFIXES.some((prefix) => window.location.pathname.startsWith(prefix))) {
      await navigate({ to: "/" });
    }
  }, [navigate, queryClient]);
}
