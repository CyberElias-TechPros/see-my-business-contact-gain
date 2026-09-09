import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { contactLinks } from "@/data/mock";

export const Route = createFileRoute("/app/links")({
  component: WorkspaceLinks,
});

function WorkspaceLinks() {
  return (
    <div>
      <SectionHead
        title="QR codes & contact links"
        subtitle="Every tracked destination that starts a WhatsApp chat."
        action={<Button>Generate link</Button>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active links" value="12" delta="" hint="tracked" />
        <StatCard label="Scans" value="8,879" delta="+16%" hint="30 days" />
        <StatCard label="Chats started" value="5,210" delta="+12%" hint="30 days" />
        <StatCard label="Best performer" value="Ikeja QR" delta="24%" hint="conversion" />
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
        <Panel title="Links & QR codes" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable
            columns={["ID", "Label", "Destination", "Source", "Scans"]}
            rows={contactLinks.map((l) => [l.id, l.label, l.url, l.source, String(l.scans)])}
          />
        </Panel>
      </div>
    </div>
  );
}
