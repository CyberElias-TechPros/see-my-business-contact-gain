import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";


export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  return (
    <div>
      <SectionHead title="Platform dashboard" subtitle="Growth, quality and risk across the whole platform." action={<Button>Export snapshot</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Businesses" value="58,412" delta="+2.1%" hint="this month" />
        <StatCard label="Chats started" value="1.24M" delta="+9%" hint="this month" />
        <StatCard label="Pending verifications" value="112" delta="" hint="queue" />
        <StatCard label="Open reports" value="24" delta="-6" hint="this week" />
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
        <Panel title="Operations queue" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Queue", "Items", "Oldest", "Owner"]} rows={[["Claims", "3", "3 days", "Support"], ["Verification", "112", "2 days", "Trust & safety"], ["Media moderation", "48", "5 minutes", "Moderators"], ["Support tickets", "3", "1 day", "Support"]]} />
        </Panel>
      </div>
    </div>
  );
}
