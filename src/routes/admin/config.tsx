import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";

export const Route = createFileRoute("/admin/config")({
  component: AdminConfig,
});

function AdminConfig() {
  return (
    <div>
      <SectionHead
        title="Configuration"
        subtitle="Platform-wide settings, limits and policy thresholds."
        action={<Button>Save</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Environments" value="3" delta="" hint="dev, preview, prod" />
        <StatCard label="Rate limits" value="12" delta="" hint="policies" />
        <StatCard label="Locales" value="2" delta="" hint="en-NG, pidgin" />
        <StatCard label="Data region" value="Nigeria" delta="" hint="primary" />
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
        <Panel title="Settings" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Setting", "Value", "Notes"]}
            rows={[
              ["Max gallery images", "30", "Per listing"],
              ["Room slot ceiling", "5,000", "Per contact-gain room"],
              ["Report auto-hide threshold", "5 reports", "Pending review"],
              ["NDPR retention", "24 months", "Then anonymised"],
              ["Moderation SLA", "30 minutes", "High-risk items"],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
