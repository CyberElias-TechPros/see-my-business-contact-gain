import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, SimpleTable, StatCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { qk, useAd } from "@/lib/queries";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptions,
});

function AdminSubscriptions() {
  const subs = useAd(qk.adSubscriptions, (b) => b.adminSubscriptions());

  if (subs.isLoading) return <LoadingCard label="Loading subscriptions…" />;
  if (subs.isError)
    return <LoadError message={(subs.error as Error)?.message} retry={() => void subs.refetch()} />;

  const items = subs.data?.items ?? [];
  const byPlan = subs.data?.byPlan ?? [];
  const mrr = items
    .filter((i) => i.status === "Paid")
    .reduce((acc, i) => acc + Number(i.amount.replace(/\D/g, "") || 0), 0);

  return (
    <div>
      <SectionHead title="Subscriptions" subtitle="Plan mix, invoices and churn risk." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Paying invoices"
          value={String(items.filter((i) => i.status === "Paid").length)}
          hint="collected"
        />
        <StatCard
          label="Revenue (period)"
          value={`₦${mrr.toLocaleString()}`}
          hint="paid invoices"
        />
        <StatCard
          label="Overdue"
          value={String(items.filter((i) => i.status !== "Paid").length)}
          hint="needs dunning"
        />
        <StatCard
          label="Businesses"
          value={String(byPlan.reduce((acc, p) => acc + p.businesses, 0))}
          hint="on plans"
        />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Plan mix">
          {byPlan.length === 0 ? (
            <EmptyState title="No data" body="No subscriptions yet." />
          ) : (
            <div className="space-y-3">
              {byPlan.map((p) => {
                const total = byPlan.reduce((acc, x) => acc + x.businesses, 0) || 1;
                const pct = Math.round((p.businesses / total) * 100);
                return (
                  <div key={p.plan}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium">{p.plan}</span>
                      <span className="text-muted-foreground">
                        {p.businesses} ({pct}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
        <Panel title="Invoices">
          {items.length === 0 ? (
            <EmptyState title="No invoices" body="Invoices appear as businesses subscribe." />
          ) : (
            <SimpleTable
              columns={["Invoice", "Business", "Amount", "Status", ""]}
              rows={items.map((i) => [
                i.id,
                i.business ?? "—",
                i.amount,
                <Badge variant={i.status === "Paid" ? "default" : "secondary"}>{i.status}</Badge>,
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => toast.success("Reminder email queued")}
                >
                  Remind
                </Button>,
              ])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
