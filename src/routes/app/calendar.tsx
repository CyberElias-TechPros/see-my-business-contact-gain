import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";

export const Route = createFileRoute("/app/calendar")({
  component: WorkspaceCalendar,
});

function WorkspaceCalendar() {
  return (
    <div>
      <SectionHead
        title="Calendar"
        subtitle="Appointments, callbacks and site visits."
        action={<Button>New appointment</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Today" value="4" delta="" hint="appointments" />
        <StatCard label="This week" value="19" delta="+3" hint="booked" />
        <StatCard label="No-shows" value="1" delta="" hint="this week" />
        <StatCard label="Confirmed" value="17" delta="89%" hint="rate" />
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
        <Panel title="Upcoming" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["Time", "Customer", "Type", "Agent", "Status"]}
            rows={[
              ["9:00 AM", "Blessing Eze", "Screen repair", "Amina B.", "Confirmed"],
              ["11:30 AM", "Musa Ibrahim", "Diagnostics", "Chidi O.", "Confirmed"],
              ["2:00 PM", "Ngozi Umeh", "Site visit", "Amina B.", "Pending"],
            ]}
          />
        </Panel>
      </div>
    </div>
  );
}
