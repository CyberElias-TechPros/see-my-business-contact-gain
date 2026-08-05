import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { invoices } from "@/data/mock";

export const Route = createFileRoute("/admin/subscriptions")({
  component: AdminSubscriptions,
});

function AdminSubscriptions() {
  return (
    <div>
      <SectionHead title="Subscriptions & payments" subtitle="Plans, invoices, refunds and dunning." action={<Button>Export ledger</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="MRR" value="₦96.2M" delta="+8%" hint="this month" />
        <StatCard label="Paying businesses" value="11,420" delta="+6%" hint="this month" />
        <StatCard label="Churn" value="2.4%" delta="-0.3pts" hint="this month" />
        <StatCard label="Overdue" value="318" delta="" hint="in dunning" />
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
        <Panel title="Recent invoices" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Invoice", "Plan", "Amount", "Date", "Status"]} rows={invoices.map((i) => [i.id, i.plan, i.amount, i.date, i.status])} />
        </Panel>
      </div>
    </div>
  );
}
