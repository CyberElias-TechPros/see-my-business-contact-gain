import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { moderationQueue } from "@/data/mock";

export const Route = createFileRoute("/admin/moderation")({
  component: AdminModeration,
});

function AdminModeration() {
  return (
    <div>
      <SectionHead
        title="Media & content moderation"
        subtitle="AI pre-screening plus human review, ranked by risk."
        action={<Button>Review next</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="In queue" value="48" delta="" hint="items" />
        <StatCard label="High risk" value="12" delta="" hint="priority" />
        <StatCard label="Actioned today" value="96" delta="" hint="items" />
        <StatCard label="SLA" value="under 30m" delta="on target" hint="median" />
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
        <Panel title="Moderation queue" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["ID", "Type", "Item", "Reason", "Risk", "Age"]}
            rows={moderationQueue.map((m) => [m.id, m.type, m.item, m.reason, m.risk, m.age])}
          />
        </Panel>
      </div>
    </div>
  );
}
