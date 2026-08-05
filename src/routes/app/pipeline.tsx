import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";


export const Route = createFileRoute("/app/pipeline")({
  component: WorkspacePipeline,
});

function WorkspacePipeline() {
  return (
    <div>
      <SectionHead title="Pipeline" subtitle="Drag leads through your configurable stages." action={<Button>Add stage</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open value" value="₦4.1M" delta="+9%" hint="in pipeline" />
        <StatCard label="Win rate" value="32%" delta="+2pts" hint="this month" />
        <StatCard label="Avg deal" value="₦86,000" delta="" hint="last 30 days" />
        <StatCard label="Stale deals" value="3" delta="" hint="no activity 7 days" />
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
        <Panel title="Deals by stage" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Stage", "Deals", "Value", "Avg age"]} rows={[["New", "23", "₦640,000", "1 day"], ["Qualified", "18", "₦1.2M", "3 days"], ["Quotation", "9", "₦1.4M", "6 days"], ["Follow up", "7", "₦860,000", "9 days"], ["Won", "12", "₦2.4M", "—"], ["Lost", "5", "₦310,000", "—"]]} />
        </Panel>
      </div>
    </div>
  );
}
