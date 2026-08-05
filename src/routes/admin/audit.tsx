import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { auditLog } from "@/data/mock";

export const Route = createFileRoute("/admin/audit")({
  component: AdminAudit,
});

function AdminAudit() {
  return (
    <div>
      <SectionHead title="Audit logs" subtitle="Every privileged action on the platform." action={<Button>Export</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Events today" value="18,400" delta="" hint="logged" />
        <StatCard label="Admin actions" value="412" delta="" hint="today" />
        <StatCard label="Suspensions" value="31" delta="" hint="today" />
        <StatCard label="Retention" value="36 months" delta="" hint="policy" />
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
        <Panel title="Events" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["ID", "Actor", "Event", "Time"]} rows={auditLog.map((a) => [a.id, a.who, a.what, a.when])} />
        </Panel>
      </div>
    </div>
  );
}
