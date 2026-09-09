import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { leads } from "@/data/mock";

export const Route = createFileRoute("/app/")({
  component: WorkspaceDashboard,
});

function WorkspaceDashboard() {
  return (
    <div>
      <SectionHead
        title="Dashboard"
        subtitle="Everything happening across your listings, leads and campaigns."
        action={<Button>New campaign</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contacts gained" value="5,210" delta="+12%" hint="this week" />
        <StatCard label="New leads" value="412" delta="+8%" hint="this week" />
        <StatCard label="Reply time" value="4m 20s" delta="-18%" hint="average" />
        <StatCard label="Won deals" value="₦2.4M" delta="+21%" hint="this month" />
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
        <Panel title="Latest leads" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Lead", "Name", "Source", "Stage", "Value", "Agent", "Updated"]}
            rows={leads.map((l) => [l.id, l.name, l.source, l.stage, l.value, l.agent, l.updated])}
          />
        </Panel>
      </div>
    </div>
  );
}
