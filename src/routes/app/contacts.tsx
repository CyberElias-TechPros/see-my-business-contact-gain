import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { leads } from "@/data/mock";

export const Route = createFileRoute("/app/contacts")({
  component: WorkspaceContacts,
});

function WorkspaceContacts() {
  return (
    <div>
      <SectionHead title="Contacts" subtitle="Every person who has ever contacted your business, deduplicated." action={<Button>Import CSV</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total contacts" value="5,210" delta="+120" hint="this week" />
        <StatCard label="Saved back" value="4,109" delta="79%" hint="of contacts" />
        <StatCard label="Customers" value="912" delta="+34" hint="this month" />
        <StatCard label="Opted out" value="41" delta="" hint="do not message" />
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
        <Panel title="Contacts" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Lead", "Name", "Channel", "Source", "Stage", "Agent"]} rows={leads.map((l) => [l.id, l.name, l.channel, l.source, l.stage, l.agent])} />
        </Panel>
      </div>
    </div>
  );
}
