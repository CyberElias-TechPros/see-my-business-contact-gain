import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/api";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/claims")({
  component: AdminClaims,
});

function AdminClaims() {
  const claims = useAd(qk.adClaims, (b) => b.adminClaims());
  const update = useAdMutation(
    (b, vars: { id: string; status: string }) => b.adminUpdateClaim(vars.id, vars.status),
    {
      invalidate: [qk.adClaims, qk.adOverview],
    },
  );

  if (claims.isLoading) return <LoadingCard label="Loading claims…" />;
  if (claims.isError)
    return (
      <LoadError message={(claims.error as Error)?.message} retry={() => void claims.refetch()} />
    );

  const items = claims.data ?? [];
  const pending = items.filter((c) => c.status === "Pending");
  const decide = (id: string, status: string) =>
    update.mutate(
      { id, status },
      { onSuccess: () => toast.success(`Claim ${status.toLowerCase()}`) },
    );

  return (
    <div>
      <SectionHead
        title="Ownership claims"
        subtitle="Verify documents, then approve or reject ownership requests."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value={String(pending.length)} hint="awaiting review" />
        <StatCard
          label="Approved"
          value={String(items.filter((c) => c.status === "Approved").length)}
          hint="transferred"
        />
        <StatCard
          label="Rejected"
          value={String(items.filter((c) => c.status === "Rejected").length)}
          hint="this period"
        />
        <StatCard
          label="Oldest"
          value={pending.length ? timeAgo(Math.max(...pending.map((c) => c.ts))) : "—"}
          hint="in queue"
        />
      </div>
      <div className="mt-6">
        <Panel title="Claim queue">
          {items.length === 0 ? (
            <EmptyState
              title="No claims"
              body="Ownership claims submitted from listing pages appear here."
            />
          ) : (
            <div className="space-y-2">
              {items.map((c) => (
                <div key={c.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{c.businessName || "Unlinked business"}</p>
                    <Badge
                      variant={
                        c.status === "Approved"
                          ? "default"
                          : c.status === "Rejected"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {c.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      submitted <TimeAgo minutes={c.ts} />
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {c.claimant}
                    {c.role ? ` (${c.role})` : ""} • {c.contact}
                  </p>
                  {c.evidence ? <p className="mt-1 text-sm">Evidence: {c.evidence}</p> : null}
                  {c.notes ? (
                    <p className="mt-1 text-sm text-muted-foreground">Notes: {c.notes}</p>
                  ) : null}
                  {c.status === "Pending" ? (
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" onClick={() => decide(c.id, "Approved")}>
                        Approve ownership
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-destructive"
                        onClick={() => decide(c.id, "Rejected")}
                      >
                        Reject
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
