import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { conversations } from "@/data/mock";

export const Route = createFileRoute("/app/inbox")({
  component: WorkspaceInbox,
});

function WorkspaceInbox() {
  return (
    <div>
      <SectionHead title="Inbox" subtitle="Every WhatsApp conversation, tagged and assigned automatically." action={<Button>Compose</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Unread" value="3" delta="" hint="conversations" />
        <StatCard label="Assigned to me" value="12" delta="" hint="open" />
        <StatCard label="Awaiting reply" value="5" delta="" hint="over 1 hour" />
        <StatCard label="Resolved today" value="28" delta="+6" hint="vs yesterday" />
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
        <Panel title="Conversations" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Contact", "Last message", "Tag", "Assigned", "Time"]} rows={conversations.map((c) => [c.name, c.last, c.tag, c.assigned, c.time])} />
        </Panel>
      </div>
    </div>
  );
}
