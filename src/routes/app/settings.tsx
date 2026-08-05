import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";


export const Route = createFileRoute("/app/settings")({
  component: WorkspaceSettings,
});

function WorkspaceSettings() {
  return (
    <div>
      <SectionHead title="Settings" subtitle="Channels, pipelines, custom fields and data controls." action={<Button>Save changes</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pipelines" value="2" delta="" hint="configured" />
        <StatCard label="Custom fields" value="7" delta="" hint="in use" />
        <StatCard label="Connected channels" value="3" delta="" hint="WhatsApp, email, SMS" />
        <StatCard label="Data exports" value="1" delta="" hint="this month" />
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
        <Panel title="Configuration" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Setting", "Value", "Scope"]} rows={[["Default pipeline", "Sales — repair jobs", "Business"], ["Lead assignment", "Round robin", "Team"], ["Auto acknowledgement", "On — 30 second delay", "WhatsApp"], ["Stale lead threshold", "24 hours", "Automation"], ["Data retention", "24 months", "NDPR"]]} />
        </Panel>
      </div>
    </div>
  );
}
