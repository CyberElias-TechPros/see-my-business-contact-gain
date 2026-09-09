import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";

export const Route = createFileRoute("/admin/jobs")({
  component: AdminJobs,
});

function AdminJobs() {
  return (
    <div>
      <SectionHead
        title="System jobs & queues"
        subtitle="Scheduled jobs, queues and automation monitoring."
        action={<Button>Retry failed</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Queues healthy" value="6 / 6" delta="" hint="all green" />
        <StatCard label="Jobs today" value="1.8M" delta="" hint="processed" />
        <StatCard label="Failures" value="12" delta="-40%" hint="today" />
        <StatCard label="Backlog" value="0" delta="" hint="messages" />
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
        <Panel title="Jobs" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Job", "Schedule", "Last run", "Duration", "Status"]}
            rows={[
              ["Stale lead detection", "Hourly", "8 min ago", "12s", "OK"],
              ["Analytics aggregation", "Every 15 min", "3 min ago", "48s", "OK"],
              ["Search reindex", "Nightly", "02:00", "6m 20s", "OK"],
              ["Verification reminders", "Daily", "07:00", "31s", "OK"],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
