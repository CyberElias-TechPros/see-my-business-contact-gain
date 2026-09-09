import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";

export const Route = createFileRoute("/app/products")({
  component: WorkspaceProducts,
});

function WorkspaceProducts() {
  return (
    <div>
      <SectionHead
        title="Products & services"
        subtitle="Published price lists, packages and offers."
        action={<Button>Add item</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Products" value="24" delta="+3" hint="live" />
        <StatCard label="Services" value="9" delta="" hint="live" />
        <StatCard label="Offers" value="2" delta="" hint="running" />
        <StatCard label="Quote requests" value="61" delta="+11" hint="this week" />
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
        <Panel title="Catalogue" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Item", "Type", "Price", "Status", "Requests"]}
            rows={[
              ["iPhone screen replacement", "Service", "₦45,000", "Live", "182"],
              ["Laptop battery", "Product", "₦38,000", "Live", "64"],
              ["Diagnostics", "Service", "Free", "Live", "241"],
              ["Back-to-school bundle", "Offer", "₦60,000", "Draft", "0"],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
