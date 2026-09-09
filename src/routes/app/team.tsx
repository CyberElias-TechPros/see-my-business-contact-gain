import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { teamMembers } from "@/data/mock";

export const Route = createFileRoute("/app/team")({
  component: WorkspaceTeam,
});

function WorkspaceTeam() {
  return (
    <div>
      <SectionHead
        title="Team & permissions"
        subtitle="Owners, managers, agents, marketing and limited staff."
        action={<Button>Invite member</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Seats used" value="4 / 5" delta="" hint="Growth plan" />
        <StatCard label="Active now" value="2" delta="" hint="online" />
        <StatCard label="Avg reply time" value="4m" delta="-18%" hint="this week" />
        <StatCard label="Pending invites" value="1" delta="" hint="sent" />
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
        <Panel title="Members" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Name", "Email", "Role", "Status", "Last seen"]}
            rows={teamMembers.map((m) => [m.name, m.email, m.role, m.status, m.lastSeen])}
          />
        </Panel>
      </div>
    </div>
  );
}
