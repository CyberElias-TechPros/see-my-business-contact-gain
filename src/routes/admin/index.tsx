import { createFileRoute, Link } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import {
  BarTrend,
  EmptyState,
  LoadError,
  LoadingCard,
  Panel,
  SimpleTable,
  SourceBars,
  StatCard,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const overview = useAd(qk.adOverview, (b) => b.adminOverview());
  const claims = useAd(qk.adClaims, (b) => b.adminClaims());
  const reports = useAd(qk.adReports, (b) => b.adminReports());
  const support = useAd(qk.adSupport, (b) => b.adminSupport());
  const updateClaim = useAdMutation(
    (b, vars: { id: string; status: string }) => b.adminUpdateClaim(vars.id, vars.status),
    {
      invalidate: [qk.adClaims, qk.adOverview],
    },
  );

  if (overview.isLoading) return <LoadingCard label="Loading platform overview…" />;
  if (overview.isError)
    return (
      <LoadError
        message={(overview.error as Error)?.message}
        retry={() => void overview.refetch()}
      />
    );

  const data = overview.data!;
  const pendingClaims = (claims.data ?? []).filter((c) => c.status === "Pending").slice(0, 5);
  const openReports = (reports.data ?? []).filter((r) => r.status === "Open").slice(0, 5);
  const openTickets = (support.data ?? []).filter((t) => t.status === "Open").slice(0, 5);

  return (
    <div>
      <SectionHead
        title="Platform overview"
        subtitle="Queues, growth and marketplace health at a glance."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} hint={s.hint} />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(data.queues).map(([queue, count]) => (
          <Button key={queue} asChild variant="outline" size="sm">
            <Link to="/admin/moderation">
              {queue}: <span className="font-semibold">{count}</span>
            </Link>
          </Button>
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Platform activity, 7 days" className="lg:col-span-2">
          <BarTrend data={data.trend} />
        </Panel>
        <Panel title="Contact sources">
          <SourceBars data={data.sources} />
        </Panel>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Pending claims">
          {pendingClaims.length === 0 ? (
            <EmptyState title="Queue clear" body="No claims awaiting review." />
          ) : (
            <div className="space-y-2">
              {pendingClaims.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{c.businessName || c.claimant}</p>
                    <p className="truncate text-xs text-muted-foreground">{c.claimant}</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => updateClaim.mutate({ id: c.id, status: "Approved" })}
                  >
                    Approve
                  </Button>
                </div>
              ))}
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/admin/claims">Review all claims →</Link>
              </Button>
            </div>
          )}
        </Panel>
        <Panel title="Open reports">
          {openReports.length === 0 ? (
            <EmptyState title="Queue clear" body="No open reports." />
          ) : (
            <div className="space-y-2">
              {openReports.map((r) => (
                <div key={r.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{r.targetLabel}</p>
                  <p className="text-xs text-muted-foreground">{r.reason}</p>
                </div>
              ))}
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/admin/reports">Review all reports →</Link>
              </Button>
            </div>
          )}
        </Panel>
        <Panel title="Support tickets">
          {openTickets.length === 0 ? (
            <EmptyState title="Queue clear" body="No open tickets." />
          ) : (
            <div className="space-y-2">
              {openTickets.map((t) => (
                <div key={t.id} className="rounded-xl border p-3 text-sm">
                  <p className="font-medium">{t.subject}</p>
                  <p className="text-xs text-muted-foreground">{t.user}</p>
                </div>
              ))}
              <Button asChild variant="ghost" size="sm" className="w-full">
                <Link to="/admin/support">Open support queue →</Link>
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
