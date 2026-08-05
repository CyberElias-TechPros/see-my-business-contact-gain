import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { claims } from "@/data/mock";

export const Route = createFileRoute("/admin/claims")({
  component: AdminClaims,
});

function AdminClaims() {
  return (
    <div>
      <SectionHead title="Claims" subtitle="Ownership requests and contested listings." action={<Button>Assign reviewer</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pending" value="3" delta="" hint="claims" />
        <StatCard label="Approved" value="1,204" delta="" hint="all time" />
        <StatCard label="Rejected" value="188" delta="" hint="all time" />
        <StatCard label="Avg decision" value="31h" delta="-4h" hint="this month" />
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
        <Panel title="Claim requests" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["ID", "Business", "Claimant", "Evidence", "Submitted", "Status"]} rows={claims.map((c) => [c.id, c.business, c.claimant, c.evidence, c.submitted, c.status])} />
        </Panel>
      </div>
    </div>
  );
}
