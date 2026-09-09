/**
 * The workspace dashboard, entirely from `GET /workspaces/:id/summary`.
 *
 * The layout already fetched that summary for the header and the nav badges, so this page reads
 * the same cache key and renders on the first paint — there is deliberately no loader here: one
 * payload, one request, and the numbers on the cards are the same objects the sidebar badges came
 * from, which is what keeps a dashboard and its own navigation from disagreeing.
 *
 * Trend labels are computed from UTC date parts instead of `toLocaleDateString` on purpose. Node
 * and a low-end Android browser disagree about locale data often enough to produce a hydration
 * mismatch, and a mismatch on a noindex console page still means React throws the tree away and
 * rebuilds it — a flicker on every load for the sake of a weekday name.
 */
import { Link, createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ArrowUpRight } from "lucide-react";

import { SectionHead } from "@/components/console/ConsoleShell";
import { BarTrend, Panel, SimpleTable, SourceBars, StatCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { LEAD_SOURCE_LABELS, LEAD_STAGE_LABELS, formatNaira } from "../../../shared/domain.ts";
import { useWorkspace } from "@/lib/workspace.ts";
import { sessionQuery, workspaceLeadsQuery, workspaceSummaryQuery } from "@/lib/queries.ts";
import type { WorkspaceSummary } from "@/lib/queries.ts";

export const Route = createFileRoute("/app/")({
  component: WorkspaceDashboard,
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function dayLabel(iso: string): string {
  const parsed = new Date(`${iso}T00:00:00Z`);
  const day = Number.isNaN(parsed.getTime()) ? null : parsed.getUTCDay();
  return day === null ? iso.slice(5) : (WEEKDAYS[day] ?? iso.slice(5));
}

/**
 * The API's delta is an integer percentage against the previous 30 days, and it is `0` both for a
 * genuinely flat month and for "there was no previous period to compare" — so a bare `+0%` would
 * claim a measurement we do not have. Empty means "no comparison yet", and the card's hint says
 * what the number is against.
 */
function deltaText(delta: number): string {
  if (!Number.isFinite(delta) || delta === 0) return "";
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)}%`;
}

function WorkspaceDashboard() {
  const workspace = useWorkspace(useQuery(sessionQuery()).data);
  // `enabled` because `useWorkspace` reads the route search and the layout's guard may still be
  // redirecting; a fetch for `""` would be a request at `/workspaces//summary`.
  const summary = useQuery({
    ...workspaceSummaryQuery(workspace?.businessId ?? ""),
    enabled: Boolean(workspace),
  });

  if (!workspace) return null;
  return (
    <div>
      <SectionHead
        title={summary.data ? `Good day, ${workspace.businessName}` : "Dashboard"}
        subtitle="Contacts gained, leads won, and what needs a reply today."
        action={
          <Button asChild variant="outline">
            <Link to="/app/profile">Update my profile</Link>
          </Button>
        }
      />

      {summary.isPending ? (
        <DashboardSkeleton />
      ) : summary.isError || !summary.data ? (
        <Panel title="We could not load today’s numbers">
          <p className="text-sm text-muted-foreground">
            The summary request failed, so nothing on this page is invented. Your leads, inbox and
            profile still load on their own pages.{" "}
            <button
              type="button"
              className="text-primary underline underline-offset-4"
              onClick={() => void summary.refetch()}
            >
              Try again
            </button>
          </p>
        </Panel>
      ) : (
        <DashboardBody summary={summary.data} businessId={workspace.businessId} />
      )}
    </div>
  );
}

function DashboardBody({ summary, businessId }: { summary: WorkspaceSummary; businessId: string }) {
  const { metrics, trend, sources, attention } = summary;
  const leads = useQuery(workspaceLeadsQuery(businessId, { page: 1 }));

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Contacts gained"
          value={metrics.contactsGained.toLocaleString("en-US")}
          delta={deltaText(metrics.contactsGainedDelta)}
          hint="vs the previous 30 days"
        />
        <StatCard
          label="New leads"
          value={String(metrics.newLeads)}
          delta={deltaText(metrics.newLeadsDelta)}
          hint="waiting on you"
        />
        <StatCard
          label="Reply time"
          value={
            metrics.avgReplyMinutes === null
              ? "No data"
              : metrics.avgReplyMinutes < 60
                ? `${Math.round(metrics.avgReplyMinutes)}m`
                : `${(metrics.avgReplyMinutes / 60).toFixed(1)}h`
          }
          hint={
            metrics.avgReplyMinutes === null
              ? "answers a few enquiries to see this"
              : "average first reply"
          }
        />
        <StatCard
          label="Won value"
          value={formatNaira(metrics.wonValueMinor)}
          hint="marked won this month"
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Contacts vs leads"
            action={
              <span className="text-xs text-muted-foreground">last {trend.length || 7} days</span>
            }
          >
            {trend.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing has been recorded yet. Views and enquiries start showing up here the day
                your first visitor arrives.
              </p>
            ) : (
              <BarTrend
                data={trend.map((day) => ({
                  label: dayLabel(day.date),
                  contacts: day.contacts,
                  leads: day.leads,
                }))}
              />
            )}
          </Panel>

          <Panel
            title="Latest leads"
            action={
              <Link
                to="/app/leads"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary"
              >
                All leads <ArrowUpRight className="size-3" aria-hidden="true" />
              </Link>
            }
          >
            {leads.isPending ? (
              <p className="py-6 text-sm text-muted-foreground">Loading leads…</p>
            ) : (leads.data?.items.length ?? 0) === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                No leads yet. Every contact gained from your profile, QR code or a room becomes a
                lead here.{" "}
                <Link to="/app/links" className="text-primary underline underline-offset-4">
                  Share your QR code
                </Link>
              </p>
            ) : (
              <SimpleTable
                columns={["Name", "Source", "Stage", "Value", "Score"]}
                rows={(leads.data?.items ?? []).slice(0, 5).map((lead) => [
                  lead.name,
                  LEAD_SOURCE_LABELS[lead.source] ?? lead.source,
                  <Badge key="stage" variant="outline">
                    {LEAD_STAGE_LABELS[lead.stage] ?? lead.stage}
                  </Badge>,
                  formatNaira(lead.valueMinor),
                  String(lead.score),
                ])}
              />
            )}
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel title="Needs attention">
            {attention.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                Nothing is waiting on you. New enquiries, unread reviews and a listing about to
                expire all show up here first.
              </p>
            ) : (
              <ul className="space-y-3">
                {attention.map((item) => (
                  <li key={item.id} className="flex gap-3">
                    <AlertTriangle
                      className="mt-0.5 size-4 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-muted-foreground">{item.detail}</p>
                      {/*
                        A plain anchor, not `Link`: the API returns a full path that may carry its own
                        query (`/app/leads?assignee=unassigned`), and `Link`'s `to` accepts a route
                        path with `search` supplied separately. Same-origin, so a document navigation
                        is exactly what we want.
                      */}
                      <a
                        href={item.href}
                        className="mt-1 inline-block text-xs font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Open
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Where contacts come from">
            {sources.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                No source has produced a contact yet.
              </p>
            ) : (
              <SourceBars
                data={sources.map((source) => ({
                  label: LEAD_SOURCE_LABELS[source.source] ?? source.source,
                  value: source.count,
                }))}
              />
            )}
          </Panel>

          <Panel title="Profile completeness">
            <Progress value={Math.min(100, Math.max(0, metrics.profileCompleteness))} />
            <p className="mt-2 text-xs text-muted-foreground">
              {metrics.profileCompleteness >= 100
                ? "Complete — verified badges and photos are what turn a view into a saved business."
                : `About ${metrics.profileCompleteness}% complete. Listings with photos, prices and hours get saved far more often.`}{" "}
              <Link to="/app/profile" className="font-medium text-primary">
                Finish it
              </Link>
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-xl bg-muted" />
      <p className="text-xs text-muted-foreground">Loading this week’s numbers…</p>
    </div>
  );
}
