import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard, TimeAgo } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { timeAgo } from "@/lib/api";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/verification")({
  component: AdminVerification,
});

function AdminVerification() {
  const businesses = useAd(qk.adBusinesses(""), (b) => b.adminBusinesses(""));
  const claims = useAd(qk.adClaims, (b) => b.adminClaims());
  const verifyBusiness = useAdMutation(
    (b, vars: { id: string; verified: string }) =>
      b.adminUpdateBusiness(vars.id, { verified: vars.verified }),
    { invalidate: [qk.adBusinesses(""), qk.adOverview] },
  );
  const updateClaim = useAdMutation(
    (b, vars: { id: string; status: string }) => b.adminUpdateClaim(vars.id, vars.status),
    {
      invalidate: [qk.adClaims, qk.adOverview],
    },
  );

  if (businesses.isLoading || claims.isLoading)
    return <LoadingCard label="Loading verification queue…" />;
  if (businesses.isError)
    return (
      <LoadError
        message={(businesses.error as Error)?.message}
        retry={() => void businesses.refetch()}
      />
    );

  const pendingClaims = (claims.data ?? []).filter((c) => c.status === "Pending");
  const startedVerification = (businesses.data ?? []).filter(
    (b) => b.verified === "email" || b.verified === "phone",
  );

  const approveClaim = (claimId: string, businessId: string | null) => {
    updateClaim.mutate(
      { id: claimId, status: "Approved" },
      {
        onSuccess: () => {
          toast.success("Claim approved");
          if (businessId) {
            verifyBusiness.mutate(
              { id: businessId, verified: "documents" },
              { onSuccess: () => toast.success("Business marked document-verified") },
            );
          }
        },
      },
    );
  };

  return (
    <div>
      <SectionHead
        title="Verification"
        subtitle="Claims carrying documents, plus listings that started verification."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Claims pending"
          value={String(pendingClaims.length)}
          hint="ownership requests"
        />
        <StatCard
          label="In progress"
          value={String(startedVerification.length)}
          hint="email/phone verified"
        />
        <StatCard
          label="Documents verified"
          value={String(
            (businesses.data ?? []).filter(
              (b) => b.verified === "documents" || b.verified === "premium",
            ).length,
          )}
          hint="trust badge live"
        />
        <StatCard
          label="Oldest claim"
          value={pendingClaims.length ? timeAgo(Math.max(...pendingClaims.map((c) => c.ts))) : "—"}
          hint="in queue"
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Claims with evidence">
          {pendingClaims.length === 0 ? (
            <EmptyState title="Queue clear" body="No claims awaiting document review." />
          ) : (
            <div className="space-y-2">
              {pendingClaims.map((c) => (
                <div key={c.id} className="rounded-xl border p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{c.businessName || c.businessId || "Unlinked"}</p>
                    <Badge variant="secondary">pending</Badge>
                    <span className="text-xs text-muted-foreground">
                      <TimeAgo minutes={c.ts} />
                    </span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {c.claimant} • {c.contact}
                  </p>
                  {c.evidence ? <p className="mt-1">Evidence: {c.evidence}</p> : null}
                  <div className="mt-2 flex gap-2">
                    <Button
                      size="sm"
                      disabled={updateClaim.isPending}
                      onClick={() => approveClaim(c.id, c.businessId)}
                    >
                      Approve & verify
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() =>
                        updateClaim.mutate(
                          { id: c.id, status: "Rejected" },
                          { onSuccess: () => toast.success("Claim rejected") },
                        )
                      }
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Listings mid-verification">
          {startedVerification.length === 0 ? (
            <EmptyState title="None" body="No listings between email and document verification." />
          ) : (
            <div className="space-y-2">
              {startedVerification.map((b) => (
                <div
                  key={b.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{b.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      current level: {b.verified} • {b.id}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      verifyBusiness.mutate(
                        { id: b.id, verified: "documents" },
                        { onSuccess: () => toast.success(`${b.name} verified`) },
                      )
                    }
                  >
                    Mark verified
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() =>
                      verifyBusiness.mutate(
                        { id: b.id, verified: "unverified" },
                        { onSuccess: () => toast.success(`${b.name} reset`) },
                      )
                    }
                  >
                    Reset
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
