/**
 * Which business workspace the console is looking at.
 *
 * One account can hold several memberships (an agency owning three listings, a staff member added
 * to two), so "the current workspace" is UI state, and it lives in the URL (`/app/leads?ws=biz_…`)
 * rather than in a store: refreshing, pasting a link to a colleague and pressing Back all keep the
 * same workspace, which a `useState` selection cannot promise.
 *
 * The id is *accepted* anywhere and *validated* by the API. Every workspace handler re-checks
 * membership for the session that made the request, so a hand-typed `ws` belonging to somebody else
 * answers 403 — which is why it is safe to make this parameter visible, linkable and shareable.
 * Nothing here needs to know which ids are "ours".
 */
import { useSearch } from "@tanstack/react-router";

import type { Session } from "./queries.ts";

/** The membership shape both the session payload and the workspace picker need. */
export type WorkspaceMembership = Session["memberships"][number];

/**
 * The membership to render: the one named by `ws` (by id or by slug, because the claim and
 * notification emails link with slugs), else the first. A `ws` that does not match one of *this*
 * user's memberships is ignored rather than honoured — the API would reject it anyway, and falling
 * back to the real first workspace keeps the console usable instead of showing an error page for a
 * stale bookmark.
 */
export function resolveWorkspace(
  session: Session | null | undefined,
  wanted?: string | undefined,
): WorkspaceMembership | null {
  const memberships = session?.memberships ?? [];
  if (memberships.length === 0) return null;
  if (wanted) {
    const match = memberships.find(
      (entry) => entry.businessId === wanted || entry.businessSlug === wanted,
    );
    if (match) return match;
  }
  return memberships[0] ?? null;
}

/**
 * Display names for the two enums the console shows next to a business name. `shared/domain.ts`
 * deliberately holds rules, not copy, and the API sends the enum value — so the labels live with
 * the one frontend file that renders them.
 */
export const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  growth: "Growth",
  pro: "Pro",
};

export const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  manager: "Manager",
  agent: "Staff",
  marketing: "Marketing",
};

/** What the listing a workspace manages is doing in the directory. */
export const LISTING_STATUS_LABELS: Record<string, string> = {
  draft: "Draft — not published yet",
  pending_review: "Awaiting review by GainHub staff",
  published: "Published",
  hidden: "Hidden from search",
  suspended: "Suspended",
};

/**
 * Inside `/app/*`: the resolved workspace plus the `ws` param it came from. `null` means the guard
 * in `src/routes/app/route.tsx` has not finished deciding yet — the layout redirects before it
 * renders children, so a page should treat `null` as "render nothing", not as an error.
 */
export function useWorkspace(session: Session | null | undefined): WorkspaceMembership | null {
  const { ws } = useSearch({ from: "/app" });
  return resolveWorkspace(session, ws);
}
