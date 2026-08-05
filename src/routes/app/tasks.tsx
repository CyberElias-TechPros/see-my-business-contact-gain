import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { tasks } from "@/data/mock";

export const Route = createFileRoute("/app/tasks")({
  component: WorkspaceTasks,
});

function WorkspaceTasks() {
  return (
    <div>
      <SectionHead title="Tasks" subtitle="Follow-ups created by you and by automation rules." action={<Button>New task</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Due today" value="2" delta="" hint="tasks" />
        <StatCard label="Overdue" value="0" delta="" hint="great" />
        <StatCard label="Completed" value="18" delta="+5" hint="this week" />
        <StatCard label="Auto-created" value="9" delta="" hint="by automation" />
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
        <Panel title="Task list" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["ID", "Task", "Due", "Owner", "Priority", "Status"]} rows={tasks.map((t) => [t.id, t.title, t.due, t.owner, t.priority, t.done ? "Done" : "Open"])} />
        </Panel>
      </div>
    </div>
  );
}
