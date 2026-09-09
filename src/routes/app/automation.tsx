import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { automations } from "@/data/mock";

export const Route = createFileRoute("/app/automation")({
  component: WorkspaceAutomation,
});

function WorkspaceAutomation() {
  return (
    <div>
      <SectionHead
        title="Automation"
        subtitle="Tenant-scoped, permission-aware and fully auditable rules."
        action={<Button>New rule</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active rules" value="5" delta="" hint="running" />
        <StatCard label="Runs" value="6,886" delta="+9%" hint="30 days" />
        <StatCard label="Tasks created" value="812" delta="" hint="30 days" />
        <StatCard label="Failures" value="0" delta="" hint="30 days" />
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
        <Panel title="Rules" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["ID", "Trigger", "Action", "Runs", "Status"]}
            rows={automations.map((a) => [a.id, a.trigger, a.action, String(a.runs), a.status])}
          />
        </Panel>
      </div>
    </div>
  );
}
