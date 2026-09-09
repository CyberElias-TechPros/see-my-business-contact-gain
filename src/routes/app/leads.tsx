import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { leads } from "@/data/mock";

export const Route = createFileRoute("/app/leads")({
  component: WorkspaceLeads,
});

function WorkspaceLeads() {
  return (
    <div>
      <SectionHead
        title="Leads"
        subtitle="Scored, deduplicated and routed to the right agent."
        action={<Button>Add lead</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New today" value="23" delta="+4" hint="vs yesterday" />
        <StatCard label="Qualified" value="61" delta="" hint="this week" />
        <StatCard label="Avg score" value="74" delta="+3" hint="points" />
        <StatCard label="Unassigned" value="2" delta="" hint="needs routing" />
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
        <Panel title="All leads" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Lead", "Name", "Source", "Stage", "Score", "Value", "Agent"]}
            rows={leads.map((l) => [
              l.id,
              l.name,
              l.source,
              l.stage,
              String(l.score),
              l.value,
              l.agent,
            ])}
          />
        </Panel>
      </div>
    </div>
  );
}
