import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { campaigns } from "@/data/mock";

export const Route = createFileRoute("/app/campaigns")({
  component: WorkspaceCampaigns,
});

function WorkspaceCampaigns() {
  return (
    <div>
      <SectionHead title="Campaigns" subtitle="Every acquisition initiative with cost per lead." action={<Button>New campaign</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live campaigns" value="3" delta="" hint="running" />
        <StatCard label="Leads" value="1,636" delta="+18%" hint="30 days" />
        <StatCard label="Spend" value="₦113,000" delta="" hint="30 days" />
        <StatCard label="Cost per lead" value="₦69" delta="-12%" hint="30 days" />
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
        <Panel title="Campaign performance" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["ID", "Campaign", "Channel", "Scans/clicks", "Leads", "Spend", "CPL", "Status"]} rows={campaigns.map((c) => [c.id, c.name, c.channel, String(c.scans), String(c.leads), c.cost, c.cpl, c.status])} />
        </Panel>
      </div>
    </div>
  );
}
