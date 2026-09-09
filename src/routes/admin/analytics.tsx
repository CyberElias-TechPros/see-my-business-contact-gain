import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { categories } from "@/data/mock";

export const Route = createFileRoute("/admin/analytics")({
  component: AdminAnalytics,
});

function AdminAnalytics() {
  return (
    <div>
      <SectionHead
        title="Platform analytics"
        subtitle="Supply, demand, conversion and quality metrics."
        action={<Button>Export</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Searches" value="8.4M" delta="+11%" hint="this month" />
        <StatCard label="Chats started" value="1.24M" delta="+9%" hint="this month" />
        <StatCard label="Listing completion" value="71%" delta="+3pts" hint="average" />
        <StatCard label="Verified share" value="53%" delta="+2pts" hint="of listings" />
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
        <Panel title="Demand by category" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Category", "Searches", "Chats", "Conversion"]}
            rows={categories.slice(0, 8).map((c) => [c.name, "412,000", "88,400", "21%"])}
          />
        </Panel>
      </div>
    </div>
  );
}
