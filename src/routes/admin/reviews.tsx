import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviews,
});

function AdminReviews() {
  return (
    <div>
      <SectionHead
        title="Reviews"
        subtitle="Published reviews, disputes and fake-review detection."
        action={<Button>Run detection</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Reviews" value="221,400" delta="+4%" hint="this month" />
        <StatCard label="Disputed" value="94" delta="" hint="under review" />
        <StatCard label="Removed" value="1,204" delta="" hint="all time" />
        <StatCard label="Avg rating" value="4.4" delta="+0.1" hint="platform" />
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
        <Panel title="Flagged reviews" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Review", "Business", "Rating", "Flag", "Age"]}
            rows={[
              ["R-8812", "SwiftFix Gadgets", "5", "Suspected fake", "1 hour"],
              ["R-8811", "Glow by Tola", "1", "Disputed by owner", "6 hours"],
              ["R-8810", "Crown Events", "2", "Abusive language", "1 day"],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
