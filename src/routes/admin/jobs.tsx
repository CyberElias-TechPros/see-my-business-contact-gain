import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/jobs")({
  component: AdminJobs,
});

function AdminJobs() {
  const jobs = useAd(qk.adJobs, (b) => b.adminJobs());
  const run = useAdMutation((b, id: string) => b.adminRunJob(id), {
    invalidate: [qk.adJobs, qk.adOverview],
  });

  if (jobs.isLoading) return <LoadingCard label="Loading jobs…" />;
  if (jobs.isError)
    return <LoadError message={(jobs.error as Error)?.message} retry={() => void jobs.refetch()} />;

  const items = jobs.data ?? [];
  const running = items.filter((j) => j.status === "Running").length;

  return (
    <div>
      <SectionHead
        title="System jobs"
        subtitle="Scheduled maintenance — recomputes, digests, cleanups."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jobs" value={String(items.length)} hint="scheduled" />
        <StatCard label="Running" value={String(running)} hint="right now" />
        <StatCard
          label="Idle"
          value={String(items.filter((j) => j.status === "Idle").length)}
          hint="waiting cron"
        />
        <StatCard
          label="Failed"
          value={String(items.filter((j) => j.status === "Failed").length)}
          hint="need attention"
        />
      </div>
      <div className="mt-6">
        <Panel title="Scheduler">
          {items.length === 0 ? (
            <EmptyState title="No jobs" body="Scheduled jobs appear here." />
          ) : (
            <div className="space-y-2">
              {items.map((j) => (
                <div
                  key={j.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{j.name}</p>
                    <p className="text-xs text-muted-foreground">
                      every {j.schedule} • last run {j.lastRun}
                    </p>
                    {j.output ? <p className="text-xs text-muted-foreground">{j.output}</p> : null}
                  </div>
                  <Badge
                    variant={
                      j.status === "Failed"
                        ? "destructive"
                        : j.status === "Running"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {j.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={run.isPending}
                    onClick={() =>
                      run.mutate(j.id, { onSuccess: () => toast.success(`${j.name} triggered`) })
                    }
                  >
                    Run now
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
