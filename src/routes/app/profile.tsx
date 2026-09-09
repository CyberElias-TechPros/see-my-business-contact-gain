import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";

export const Route = createFileRoute("/app/profile")({
  component: WorkspaceProfile,
});

function WorkspaceProfile() {
  return (
    <div>
      <SectionHead
        title="Business profile"
        subtitle="What customers see publicly. Complete every section to rank higher."
        action={<Button>Preview profile</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Completion" value="82%" delta="+10" hint="this month" />
        <StatCard label="Profile views" value="12,480" delta="+14%" hint="30 days" />
        <StatCard label="Chats started" value="5,210" delta="+12%" hint="30 days" />
        <StatCard label="Saved by" value="312" delta="+18" hint="people" />
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
        <Panel title="Profile sections" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Section", "Status", "Public", "Last updated"]}
            rows={[
              ["Basics & tagline", "Complete", "Yes", "2 days ago"],
              ["Category attributes", "Complete", "Yes", "1 week ago"],
              ["Hours", "Complete", "Yes", "Yesterday"],
              ["Gallery", "Missing 2 images", "Yes", "3 days ago"],
              ["Verification documents", "Approved", "Badge only", "1 month ago"],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
