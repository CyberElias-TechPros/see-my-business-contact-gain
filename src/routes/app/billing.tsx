import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, SimpleTable, StatCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { timeAgo } from "@/lib/api";
import { qk, useWs, useWsMutation } from "@/lib/queries";

export const Route = createFileRoute("/app/billing")({
  component: WorkspaceBilling,
});

const PLANS = [
  {
    id: "Free",
    price: "₦0",
    period: "forever",
    features: ["Directory listing", "WhatsApp button", "Basic analytics", "1 tracked link"],
  },
  {
    id: "Growth",
    price: "₦9,500",
    period: "per month",
    features: [
      "Everything in Free",
      "10 tracked links + QR",
      "Automation rules",
      "Team seats (3)",
      "Priority ranking",
    ],
  },
  {
    id: "Pro",
    price: "₦24,500",
    period: "per month",
    features: [
      "Everything in Growth",
      "Unlimited links",
      "10 team seats",
      "Verified fast-track",
      "Account manager",
    ],
  },
];

function WorkspaceBilling() {
  const billing = useWs(qk.wsInvoices, (b) => b.workspaceInvoices());
  const [target, setTarget] = useState<string | null>(null);

  const upgrade = useWsMutation((b, plan: string) => b.requestUpgrade(plan), {
    success: "Upgrade request received — we'll confirm by email shortly",
    invalidate: [qk.wsInvoices, qk.wsProfile, qk.wsSummary],
  });

  if (billing.isLoading) return <LoadingCard label="Loading billing…" />;
  if (billing.isError)
    return (
      <LoadError message={(billing.error as Error)?.message} retry={() => void billing.refetch()} />
    );

  const data = billing.data!;
  const currentPlan = data.plan;
  const invoices = data.items;
  const paid = invoices.filter((i) => i.status === "Paid");

  return (
    <div>
      <SectionHead
        title="Billing"
        subtitle={`You're on the ${currentPlan} plan. Upgrade for more links, seats and automation.`}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Current plan" value={currentPlan} hint="active" />
        <StatCard label="Invoices" value={String(invoices.length)} hint="all time" />
        <StatCard label="Paid" value={String(paid.length)} hint="collected" />
        <StatCard
          label="Outstanding"
          value={String(invoices.filter((i) => i.status !== "Paid").length)}
          hint="due"
        />
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === currentPlan;
          return (
            <Card
              key={plan.id}
              className={`card-surface ${isCurrent ? "border-primary ring-1 ring-primary" : ""}`}
            >
              <CardContent className="flex h-full flex-col p-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{plan.id}</h3>
                  {isCurrent ? <Badge>Current</Badge> : null}
                </div>
                <p className="mt-3 text-2xl font-bold">
                  {plan.price}{" "}
                  <span className="text-sm font-normal text-muted-foreground">/{plan.period}</span>
                </p>
                <ul className="mt-4 flex-1 space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="mt-5"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={isCurrent || upgrade.isPending}
                  onClick={() => setTarget(plan.id)}
                >
                  {isCurrent ? "Current plan" : `Upgrade to ${plan.id}`}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Panel title="Payment methods">
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-xl border p-3">
              <span>Visa •••• 4321</span>
              <Badge variant="outline">Default</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Cards are charged in Naira. Downgrade anytime — your listing stays live on the Free
              plan.
            </p>
          </div>
        </Panel>
        <Panel title="Invoices">
          {invoices.length === 0 ? (
            <EmptyState
              title="No invoices yet"
              body="Your first invoice appears after your next renewal."
            />
          ) : (
            <SimpleTable
              columns={["Invoice", "Plan", "Amount", "Status", "Date"]}
              rows={invoices.map((inv) => [
                inv.id,
                inv.plan,
                inv.amount,
                <Badge variant={inv.status === "Paid" ? "default" : "secondary"}>
                  {inv.status}
                </Badge>,
                timeAgo(inv.ts),
              ])}
            />
          )}
        </Panel>
      </div>
      <Dialog open={target != null} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade to {target}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            We'll confirm your upgrade and send a payment link by email. Your workspace unlocks as
            soon as payment clears.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button
              disabled={upgrade.isPending}
              onClick={() =>
                target &&
                upgrade.mutate(target, {
                  onSuccess: () => setTarget(null),
                })
              }
            >
              {upgrade.isPending ? "Sending…" : "Request upgrade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
