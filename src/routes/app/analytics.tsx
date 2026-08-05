import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";


export const Route = createFileRoute("/app/analytics")({
  component: WorkspaceAnalytics,
});

function WorkspaceAnalytics() {
  return (
    <div>
      <SectionHead title="Analytics" subtitle="Discovery, contact, conversion and retention in one view." action={<Button>Export report</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Contacts gained" value="5,210" delta="+12%" hint="this week" />
        <StatCard label="New leads" value="412" delta="+8%" hint="this week" />
        <StatCard label="Reply time" value="4m 20s" delta="-18%" hint="average" />
        <StatCard label="Won deals" value="₦2.4M" delta="+21%" hint="this month" />
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
        <Panel title="Outcome by source" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Source", "Chats", "Leads", "Won", "Revenue"]} rows={[["Directory profile", "2,140", "412", "88", "₦980,000"], ["QR codes", "1,180", "233", "61", "₦640,000"], ["Campaign links", "960", "301", "44", "₦520,000"], ["Contact-gain rooms", "700", "690", "31", "₦210,000"], ["Referrals", "230", "84", "19", "₦150,000"]]} />
        </Panel>
      </div>
    </div>
  );
}
