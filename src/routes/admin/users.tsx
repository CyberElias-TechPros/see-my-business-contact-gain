import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { adminUsers } from "@/data/mock";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  return (
    <div>
      <SectionHead title="Users" subtitle="Consumers, owners, managers, agents and staff." action={<Button>Invite admin</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total users" value="412,900" delta="+3%" hint="this month" />
        <StatCard label="Business users" value="58,412" delta="" hint="accounts" />
        <StatCard label="Suspended" value="318" delta="" hint="enforcement" />
        <StatCard label="New today" value="1,204" delta="+7%" hint="vs yesterday" />
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
        <Panel title="User records" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["ID", "Name", "Email", "Role", "State", "Status"]} rows={adminUsers.map((u) => [u.id, u.name, u.email, u.role, u.state, u.status])} />
        </Panel>
      </div>
    </div>
  );
}
