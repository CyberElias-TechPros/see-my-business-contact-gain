import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";

export const Route = createFileRoute("/admin/ads")({
  component: AdminAds,
});

function AdminAds() {
  return (
    <div>
      <SectionHead
        title="Ads & promotions"
        subtitle="Sponsored inventory, pacing and advertiser billing."
        action={<Button>New placement</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live placements" value="64" delta="" hint="running" />
        <StatCard label="Revenue" value="₦18.4M" delta="+12%" hint="this month" />
        <StatCard label="Fill rate" value="78%" delta="+5pts" hint="this month" />
        <StatCard label="Avg CPC" value="₦42" delta="-8%" hint="this month" />
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
        <Panel title="Placements" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["ID", "Advertiser", "Inventory", "Spend", "Chats", "Status"]}
            rows={[
              ["AD-221", "SwiftFix Gadgets", "Category spotlight", "₦120,000", "1,840", "Live"],
              ["AD-220", "KeyHomes Realty", "Location feature", "₦240,000", "980", "Live"],
              ["AD-219", "Crown Events", "Room banner", "₦60,000", "410", "Paused"],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
