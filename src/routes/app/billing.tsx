import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { invoices } from "@/data/mock";

export const Route = createFileRoute("/app/billing")({
  component: WorkspaceBilling,
});

function WorkspaceBilling() {
  return (
    <div>
      <SectionHead title="Billing" subtitle="Plan, invoices and payment method." action={<Button>Upgrade plan</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Plan" value="Growth" delta="" hint="₦12,500/mo" />
        <StatCard label="Next charge" value="1 Sep 2026" delta="" hint="auto-renew" />
        <StatCard label="Seats" value="4 / 5" delta="" hint="in use" />
        <StatCard label="Balance" value="₦0" delta="" hint="nothing due" />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Weekly contacts vs leads" className="lg:col-span-2">
          <BarTrend data={trendData} />
        </Panel>
        <Panel title="Attribution by source">
          <SourceBars data={sourceData} />
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Invoices" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Invoice", "Plan", "Amount", "Date", "Status"]} rows={invoices.map((i) => [i.id, i.plan, i.amount, i.date, i.status])} />
        </Panel>
      </div>
    </div>
  );
}
