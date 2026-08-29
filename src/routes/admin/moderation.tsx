import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/api";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/moderation")({
  component: AdminModeration,
});

function AdminModeration() {
  const moderation = useAd(qk.adModeration, (b) => b.adminModeration());
  const act = useAdMutation(
    (b, vars: { id: string; action: "approve" | "remove" }) =>
      b.adminUpdateModeration(vars.id, vars.action),
    {
      invalidate: [qk.adModeration, qk.adOverview],
    },
  );

  if (moderation.isLoading) return <LoadingCard label="Loading moderation queue…" />;
  if (moderation.isError)
    return (
      <LoadError
        message={(moderation.error as Error)?.message}
        retry={() => void moderation.refetch()}
      />
    );

  const items = moderation.data ?? [];
  const pending = items.filter((m) => m.status === "Pending");

  return (
    <div>
      <SectionHead
        title="Moderation"
        subtitle="Flagged photos, descriptions and messages awaiting a decision."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={String(pending.length)} hint="in queue" />
        <StatCard
          label="Approved today"
          value={String(items.filter((m) => m.status === "Approved").length)}
          hint="kept live"
        />
        <StatCard
          label="Removed"
          value={String(items.filter((m) => m.status === "Removed").length)}
          hint="taken down"
        />
        <StatCard
          label="Queue age"
          value={pending.length ? timeAgo(Math.min(...pending.map((m) => m.ts))) : "—"}
          hint="oldest item"
        />
      </div>
      <div className="mt-6">
        <Panel title="Queue">
          {items.length === 0 ? (
            <EmptyState
              title="Nothing to moderate"
              body="Auto-flagged content will queue here for human review."
            />
          ) : (
            <div className="space-y-2">
              {items.map((m) => (
                <div
                  key={m.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">
                        {m.type}
                      </Badge>
                      <p className="truncate font-medium">{m.item}</p>
                      {m.status !== "Pending" ? (
                        <Badge variant={m.status === "Approved" ? "default" : "destructive"}>
                          {m.status}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {m.reason} • {m.risk} risk • <TimeAgo minutes={m.ts} />
                    </p>
                  </div>
                  {m.status === "Pending" ? (
                    <span className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          act.mutate(
                            { id: m.id, action: "approve" },
                            { onSuccess: () => toast.success("Kept live") },
                          )
                        }
                      >
                        Keep
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() =>
                          act.mutate(
                            { id: m.id, action: "remove" },
                            { onSuccess: () => toast.success("Removed") },
                          )
                        }
                      >
                        Remove
                      </Button>
                    </span>
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
