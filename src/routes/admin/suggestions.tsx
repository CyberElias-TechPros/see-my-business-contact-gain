import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/suggestions")({
  component: AdminSuggestions,
});

function AdminSuggestions() {
  const suggestions = useAd(qk.adSuggestions, (b) => b.adminSuggestions());
  const update = useAdMutation(
    (b, vars: { id: string; status: string }) => b.adminUpdateSuggestion(vars.id, vars.status),
    {
      invalidate: [qk.adSuggestions, qk.adOverview],
    },
  );

  if (suggestions.isLoading) return <LoadingCard label="Loading suggestions…" />;
  if (suggestions.isError)
    return (
      <LoadError
        message={(suggestions.error as Error)?.message}
        retry={() => void suggestions.refetch()}
      />
    );

  const items = suggestions.data ?? [];
  const pending = items.filter((s) => s.status === "New");

  return (
    <div>
      <SectionHead
        title="Suggestions"
        subtitle="New-business tips, advertising enquiries and community feedback."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New" value={String(pending.length)} hint="unread" />
        <StatCard
          label="Accepted"
          value={String(items.filter((s) => s.status === "Accepted").length)}
          hint="added to backlog"
        />
        <StatCard
          label="Dismissed"
          value={String(items.filter((s) => s.status === "Dismissed").length)}
          hint="closed"
        />
        <StatCard label="Total" value={String(items.length)} hint="all time" />
      </div>
      <div className="mt-6">
        <Panel title="Inbox">
          {items.length === 0 ? (
            <EmptyState title="Inbox empty" body="Suggestions from the community arrive here." />
          ) : (
            <div className="space-y-2">
              {items.map((s) => (
                <div key={s.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{s.type}</Badge>
                    <p className="font-medium">{s.name}</p>
                    {s.categorySlug ? <Badge variant="secondary">{s.categorySlug}</Badge> : null}
                    <Badge variant={s.status === "New" ? "default" : "outline"}>{s.status}</Badge>
                    <span className="text-xs text-muted-foreground">
                      <TimeAgo minutes={s.ts} />
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">{s.details}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.contact ? `Contact: ${s.contact}` : "No contact"}{" "}
                    {s.address ? `• ${s.address}` : ""}
                  </p>
                  {s.status === "New" ? (
                    <div className="mt-2 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() =>
                          update.mutate(
                            { id: s.id, status: "Accepted" },
                            { onSuccess: () => toast.success("Accepted") },
                          )
                        }
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          update.mutate(
                            { id: s.id, status: "Dismissed" },
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
