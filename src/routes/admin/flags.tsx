import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";

export const Route = createFileRoute("/admin/flags")({
  component: AdminFlags,
});

function AdminFlags() {
  return (
    <div>
      <SectionHead
        title="Feature flags"
        subtitle="Roll features out by state, plan or cohort."
        action={<Button>New flag</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Flags" value="28" delta="" hint="defined" />
        <StatCard label="Enabled" value="19" delta="" hint="live" />
        <StatCard label="Canary" value="4" delta="" hint="partial rollout" />
        <StatCard label="Stale" value="2" delta="" hint="review needed" />
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
        <Panel title="Flags" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Flag", "Rollout", "Audience", "Status"]}
            rows={[
              ["contact_gain_rooms_v2", "50%", "Lagos businesses", "Canary"],
              ["ai_review_screening", "100%", "All", "Enabled"],
              ["sponsored_room_banner", "10%", "Pro plan", "Canary"],
              ["multi_branch_profiles", "0%", "Internal", "Disabled"],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
