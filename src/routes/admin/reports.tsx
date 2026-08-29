import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/api";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  const reports = useAd(qk.adReports, (b) => b.adminReports());
  const update = useAdMutation(
    (b, vars: { id: string; status: string }) => b.adminUpdateReport(vars.id, vars.status),
    {
      invalidate: [qk.adReports, qk.adOverview],
    },
  );

  if (reports.isLoading) return <LoadingCard label="Loading reports…" />;
  if (reports.isError)
    return (
      <LoadError message={(reports.error as Error)?.message} retry={() => void reports.refetch()} />
    );

  const items = reports.data ?? [];
  const open = items.filter((r) => r.status === "Open");

  return (
    <div>
      <SectionHead
        title="Abuse reports"
        subtitle="Reports submitted from listings, reviews, rooms and members."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open" value={String(open.length)} hint="needs action" />
        <StatCard
          label="Resolved"
          value={String(items.filter((r) => r.status === "Resolved").length)}
          hint="closed"
        />
        <StatCard
          label="Dismissed"
          value={String(items.filter((r) => r.status === "Dismissed").length)}
          hint="no action"
        />
        <StatCard
          label="Oldest open"
          value={open.length ? timeAgo(Math.max(...open.map((r) => r.ts))) : "—"}
          hint="in queue"
        />
      </div>
      <div className="mt-6">
        <Panel title="Report queue">
          {items.length === 0 ? (
            <EmptyState
              title="No reports"
              body="Reports from the 'Report' button on listings land here."
            />
          ) : (
            <div className="space-y-2">
              {items.map((r) => (
                <div key={r.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{r.targetType}</Badge>
                    <p className="font-medium">{r.targetLabel}</p>
                    <Badge
                      variant={
                        r.status === "Open"
                          ? "secondary"
                          : r.status === "Resolved"
                            ? "default"
                            : "outline"
                      }
                    >
                      {r.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      <TimeAgo minutes={r.ts} />
                    </span>
                  </div>
                  <p className="mt-1">
                    <span className="font-medium">{r.reason}.</span> {r.details}
                  </p>
                  {r.contact ? (
                    <p className="text-xs text-muted-foreground">Reporter contact: {r.contact}</p>
                  ) : null}
                  {r.status === "Open" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          update.mutate(
                            { id: r.id, status: "Resolved" },
                            { onSuccess: () => toast.success("Marked resolved") },
                          )
                        }
                      >
                        Resolve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          update.mutate(
                            { id: r.id, status: "Dismissed" },
                            { onSuccess: () => toast.success("Dismissed") },
                          )
                        }
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
