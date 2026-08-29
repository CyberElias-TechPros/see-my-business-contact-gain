import { createFileRoute } from "@tanstack/react-router";
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
import { qk, useWs } from "@/lib/queries";

export const Route = createFileRoute("/app/analytics")({
  component: WorkspaceAnalytics,
});

function WorkspaceAnalytics() {
  const analytics = useWs(qk.wsAnalytics, (b) => b.workspaceAnalytics());
  const summary = useWs(qk.wsSummary, (b) => b.workspaceSummary());

  if (analytics.isLoading || summary.isLoading) return <LoadingCard label="Loading analytics…" />;
  if (analytics.isError)
    return (
      <LoadError
        message={(analytics.error as Error)?.message}
        retry={() => void analytics.refetch()}
      />
    );
  if (summary.isError)
    return (
      <LoadError message={(summary.error as Error)?.message} retry={() => void summary.refetch()} />
    );

  const data = analytics.data!;
  const stats = summary.data?.stats ?? [];

  return (
    <div>
      <SectionHead
        title="Analytics"
        subtitle="Traffic, contacts and conversion for your listings."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} delta={s.delta} hint={s.hint} />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Events, last 7 days" className="lg:col-span-2">
          {data.trend.length ? (
            <BarTrend data={data.trend} />
          ) : (
            <EmptyState title="No events yet" body="Views, chats and saves will chart here." />
          )}
        </Panel>
        <Panel title="Where contacts come from">
          {data.sources.length ? (
            <SourceBars data={data.sources} />
          ) : (
            <p className="text-sm text-muted-foreground">No attribution yet.</p>
          )}
        </Panel>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Enquiry funnel">
          {data.funnel.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not enough traffic yet.</p>
          ) : (
            <div className="space-y-3">
              {data.funnel.map((f, i) => {
                const max = data.funnel[0]?.n || 1;
                const pct = Math.round((f.n / max) * 100);
                return (
                  <div key={f.stage}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{f.stage}</span>
                      <span className="text-muted-foreground">{f.n.toLocaleString()}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${pct}%`,
                          opacity: 1 - i * 0.18,
                          background: "var(--primary)",
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title="Top tracked links">
          {data.topLinks.length === 0 ? (
            <EmptyState
              title="No link scans yet"
              body="Generate links or QR codes to see which perform best."
            />
          ) : (
            <SimpleTable
              columns={["Link", "Scans"]}
              rows={[...data.topLinks]
                .sort((a, b) => b.scans - a.scans)
                .map((l) => [l.label, l.scans.toLocaleString()])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
