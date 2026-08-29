import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/api";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/support")({
  component: AdminSupport,
});

function AdminSupport() {
  const support = useAd(qk.adSupport, (b) => b.adminSupport());
  const update = useAdMutation(
    (b, vars: { id: string; status: string }) => b.adminUpdateTicket(vars.id, vars.status),
    {
      invalidate: [qk.adSupport, qk.adOverview],
    },
  );

  if (support.isLoading) return <LoadingCard label="Loading tickets…" />;
  if (support.isError)
    return (
      <LoadError message={(support.error as Error)?.message} retry={() => void support.refetch()} />
    );

  const items = support.data ?? [];
  const open = items.filter((t) => t.status === "Open");

  return (
    <div>
      <SectionHead
        title="Support tickets"
        subtitle="Questions and issues from owners and customers."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open" value={String(open.length)} hint="awaiting reply" />
        <StatCard
          label="Pending"
          value={String(items.filter((t) => t.status === "Pending").length)}
          hint="with requester"
        />
        <StatCard
          label="Resolved"
          value={String(items.filter((t) => t.status === "Resolved").length)}
          hint="closed"
        />
        <StatCard
          label="Oldest"
          value={open.length ? timeAgo(Math.max(...open.map((t) => t.ts))) : "—"}
          hint="in queue"
        />
      </div>
      <div className="mt-6">
        <Panel title="Ticket queue">
          {items.length === 0 ? (
            <EmptyState title="No tickets" body="Support requests will show up here." />
          ) : (
            <div className="space-y-2">
              {items.map((t) => (
                <div key={t.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{t.subject}</p>
                    <Badge variant={t.priority === "High" ? "destructive" : "outline"}>
                      {t.priority}
                    </Badge>
                    <Badge
                      variant={
                        t.status === "Open"
                          ? "secondary"
                          : t.status === "Resolved"
                            ? "default"
                            : "outline"
                      }
                    >
                      {t.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {t.user} • <TimeAgo minutes={t.ts} />
                    </span>
                  </div>
                  {t.status !== "Resolved" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          update.mutate(
                            { id: t.id, status: "Pending" },
                            { onSuccess: () => toast.success("Marked pending") },
                          )
                        }
                      >
                        Reply & mark pending
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          update.mutate(
                            { id: t.id, status: "Resolved" },
                            { onSuccess: () => toast.success("Resolved") },
                          )
                        }
                      >
                        Resolve
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
