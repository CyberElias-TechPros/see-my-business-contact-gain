import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { businesses } from "@/data/mock";

export const Route = createFileRoute("/admin/businesses")({
  component: AdminBusinesses,
});

function AdminBusinesses() {
  return (
    <div>
      <SectionHead title="Businesses" subtitle="Every listing, its plan and its quality signals." action={<Button>Add listing</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Listings" value="58,412" delta="+2.1%" hint="this month" />
        <StatCard label="Verified" value="31,204" delta="53%" hint="of listings" />
        <StatCard label="Incomplete" value="9,880" delta="" hint="below 60%" />
        <StatCard label="Suspended" value="412" delta="" hint="policy" />
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
        <Panel title="Listings" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Business", "Category", "City", "Plan", "Rating", "Verification"]} rows={businesses.map((b) => [b.name, b.category, b.city, b.plan, b.rating.toFixed(1), b.verified])} />
        </Panel>
      </div>
    </div>
  );
}
