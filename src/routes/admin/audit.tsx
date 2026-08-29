import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { timeAgo } from "@/lib/api";
import { qk, useAd } from "@/lib/queries";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAudit,
});

function AdminAudit() {
  const audit = useAd(qk.adAudit, (b) => b.adminAudit());

  if (audit.isLoading) return <LoadingCard label="Loading audit log…" />;
  if (audit.isError)
    return (
      <LoadError message={(audit.error as Error)?.message} retry={() => void audit.refetch()} />
    );

  const events = audit.data ?? [];

  return (
    <div>
      <SectionHead
        title="Audit logs"
        subtitle="Every admin action is recorded here for compliance."
      />
      <Panel title="Platform activity">
        {events.length === 0 ? (
          <EmptyState title="No entries" body="Admin actions will be logged here." />
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
