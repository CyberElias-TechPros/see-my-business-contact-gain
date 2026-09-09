import { createFileRoute, redirect } from "@tanstack/react-router";
import {
  BarChart3,
  CalendarDays,
  CheckSquare,
  CreditCard,
  Inbox,
  Kanban,
  LayoutDashboard,
  Megaphone,
  Package,
  QrCode,
  ScrollText,
  Settings,
  Store,
  Target,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { z } from "zod";

import { ConsoleShell, type NavItem } from "@/components/console/ConsoleShell";
import {
  LISTING_STATUS_LABELS,
  PLAN_LABELS,
  ROLE_LABELS,
  resolveWorkspace,
} from "@/lib/workspace.ts";
import { sessionQuery, workspaceSummaryQuery, type Session } from "@/lib/queries.ts";
import { safeNext } from "@/lib/safe-next.ts";

/**
 * The raw `?ws=` from a route-level `location`. `location.search` is typed `{}` here (the router
 * does not thread a route's own `validateSearch` output into it) and is a null-prototype object, so
 * it is read through a cast rather than an `appSearch.parse`, which would throw on whatever shape
 * the server hands over.
 */
function wantedWorkspace(search: unknown): string | undefined {
  if (!search || typeof search !== "object") return undefined;
  const value = (search as { ws?: unknown }).ws;
  return typeof value === "string" ? value : undefined;
}

/**
 * `?ws=` selects the workspace when an account owns several (`src/lib/workspace.ts` explains why
 * that lives in the URL). Everything else about the visitor comes from the session.
 */
const appSearch = z.object({
  ws: z.string().max(64).optional(),
});

const NAV: NavItem[] = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/inbox", label: "Inbox", icon: Inbox },
  { to: "/app/contacts", label: "Contacts", icon: Users },
  { to: "/app/leads", label: "Leads", icon: Target },
  { to: "/app/pipeline", label: "Pipeline", icon: Kanban },
  { to: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/app/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/app/profile", label: "Business profile", icon: Store },
  { to: "/app/products", label: "Products & services", icon: Package },
  { to: "/app/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/app/links", label: "QR & links", icon: QrCode },
  { to: "/app/automation", label: "Automation", icon: Zap },
  { to: "/app/team", label: "Team", icon: UserCog },
  { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/settings", label: "Settings", icon: Settings },
  { to: "/app/audit", label: "Audit log", icon: ScrollText },
];

export const Route = createFileRoute("/app")({
  validateSearch: (raw: Record<string, unknown>) => appSearch.parse(raw),
  // `head` on a layout route is merged into every child match, so this one line keeps the whole
  // business workspace out of search engines; src/server.ts additionally sends `X-Robots-Tag` for these prefixes
  // so a route added tomorrow cannot leak before its own metadata is written.
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow, noarchive, noimageindex" }],
  }),
  /**
   * The guard runs before anything mounts, on the server as well as in the browser, so an
   * anonymous visitor to `/app/leads` is answered with a redirect out of the loader — not a
   * rendered console that then fetches and discovers it has no cookie. `next` carries the full path
   * (query included) through `safeNext`, and because the value may never leave this origin the
   * redirect is what makes a pasted `/app/...` link behave instead of dumping someone on `/app`.
   */
  beforeLoad: async ({ context, location }) => {
    const session: Session | null = await context.queryClient
      .ensureQueryData(sessionQuery())
      .catch(() => null);
    if (!session?.user) {
      // `location.searchStr`, never `location.search`: the parsed search is a **null-prototype**
      // object, so interpolating it into a template string throws
      // `TypeError: Cannot convert object to primitive value` — on the server, where it arrives as
      // a 500 with no hint of what was concatenated.
      throw redirect({
        to: "/auth",
        search: {
          next: safeNext(`${location.pathname}${location.searchStr ?? ""}${location.hash ?? ""}`),
        },
      });
    }
    if (!resolveWorkspace(session, wantedWorkspace(location.search))) {
      // Signed in, and nothing to manage. `/claim` is the only honest destination: the account
      // exists, a listing with their name probably does too, and claiming it is what turns that
      // into a workspace.
      throw redirect({ to: "/claim" });
    }
  },
  loader: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQuery());
    const workspace = resolveWorkspace(session, wantedWorkspace(location.search));
    if (!session?.user || !workspace) {
      // `beforeLoad` redirected already; this keeps the types total for `Layout` below.
      return { user: null, workspace: null, summary: null, missing: true as const };
    }
    // The one summary read serves the header (plan, listing status), the nav badges (unassigned
    // leads, open tasks) and the dashboard itself: identical cache key, so the child page does not
    // ask twice. A failed summary must not blank the console — every page in it loads its own data.
    const summary = await context.queryClient
      .ensureQueryData(workspaceSummaryQuery(workspace.businessId))
      .catch(() => null);
    return { user: session.user, workspace, summary, missing: false as const };
  },
  component: Layout,
});

function Layout() {
  const { user, workspace, summary, missing } = Route.useLoaderData();

  if (!user || !workspace || missing) return null;

  const metrics = summary?.metrics;
  const items: NavItem[] = NAV.map((item) => {
    if (item.to === "/app/leads" && metrics?.unassignedLeads) {
      return { ...item, badge: String(metrics.unassignedLeads) };
    }
    if (item.to === "/app/tasks" && metrics?.openTasks) {
      return { ...item, badge: String(metrics.openTasks) };
    }
    return item;
  });

  const status = workspace.status;
  const tone = status === "published" ? "default" : status === "suspended" ? "bad" : "warn";

  return (
    <ConsoleShell
      items={items}
      title={workspace.businessName}
      subtitle={`${PLAN_LABELS[workspace.plan] ?? workspace.plan} plan · ${ROLE_LABELS[workspace.role] ?? "Member"}`}
      user={{ name: user.displayName, role: ROLE_LABELS[workspace.role] ?? "Team member" }}
      badge={
        summary
          ? { label: LISTING_STATUS_LABELS[status] ?? status, tone }
          : // The summary is what proves the listing is live; without it the console says so
            // rather than implying a published listing it never checked.
            { label: "Status unavailable", tone: "warn" }
      }
    />
  );
}
