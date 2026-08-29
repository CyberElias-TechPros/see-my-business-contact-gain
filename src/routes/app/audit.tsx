import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { qk, useWs } from "@/lib/queries";
import { timeAgo } from "@/lib/api";

export const Route = createFileRoute("/app/audit")({
  component: WorkspaceAudit,
});

function WorkspaceAudit() {
  const audit = useWs(qk.wsAudit, (b) => b.workspaceAudit());

  if (audit.isLoading) return <LoadingCard label="Loading activity…" />;
  if (audit.isError)
    return (
      <LoadError message={(audit.error as Error)?.message} retry={() => void audit.refetch()} />
    );

  const events = audit.data ?? [];

  return (
    <div>
      <SectionHead
        title="Audit log"
        subtitle="Every change made in this workspace, newest first."
      />
      <Panel title="Activity">
        {events.length === 0 ? (
          <EmptyState
            title="No activity yet"
            body="Changes to your listing, leads and team will be recorded here."
          />
        ) : (
          <ol className="relative space-y-4 border-l pl-5">
            {events.map((e, i) => (
              <li key={i} className="relative">
                <span className="absolute -left-[26px] top-1 size-2.5 rounded-full bg-primary/60" />
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {e.action}
                  </Badge>
                  <span className="text-sm">{e.action.replace(/[-_]/g, " ")}</span>
                  {e.businessId ? (
                    <span className="text-xs text-muted-foreground">{e.businessId}</span>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {e.actor} • {timeAgo(e.ts)}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Panel>
    </div>
  );
}
