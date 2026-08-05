import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";


export const Route = createFileRoute("/admin/reports")({
  component: AdminReports,
});

function AdminReports() {
  return (
    <div>
      <SectionHead title="Reports" subtitle="Scam, impersonation and content reports from users." action={<Button>Assign batch</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open" value="24" delta="-6" hint="this week" />
        <StatCard label="Scam reports" value="11" delta="" hint="open" />
        <StatCard label="Impersonation" value="6" delta="" hint="open" />
        <StatCard label="Resolved" value="4,120" delta="" hint="all time" />
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
        <Panel title="Report queue" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["ID", "Target", "Reason", "Reporter", "Risk", "Age"]} rows={[["RP-501", "Quick Loans Naija", "Advance-fee scam", "Consumer", "High", "22m"], ["RP-500", "Profile #4412", "Impersonation", "Business owner", "Medium", "3h"], ["RP-499", "Room banner", "Adult content", "Moderator", "High", "5h"]]} />
        </Panel>
      </div>
    </div>
  );
}
