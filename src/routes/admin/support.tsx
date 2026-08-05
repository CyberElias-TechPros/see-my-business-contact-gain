import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { tickets } from "@/data/mock";

export const Route = createFileRoute("/admin/support")({
  component: AdminSupport,
});

function AdminSupport() {
  return (
    <div>
      <SectionHead title="Support tickets" subtitle="Account, verification, billing and technical cases." action={<Button>New ticket</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open" value="3" delta="" hint="tickets" />
        <StatCard label="First response" value="18m" delta="-4m" hint="median" />
        <StatCard label="Resolved today" value="41" delta="" hint="tickets" />
        <StatCard label="CSAT" value="94%" delta="+1pt" hint="this month" />
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
        <Panel title="Tickets" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["ID", "Subject", "User", "Priority", "Status", "Age"]} rows={tickets.map((t) => [t.id, t.subject, t.user, t.priority, t.status, t.age])} />
        </Panel>
      </div>
    </div>
  );
}
