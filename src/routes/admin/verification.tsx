import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";


export const Route = createFileRoute("/admin/verification")({
  component: AdminVerification,
});

function AdminVerification() {
  return (
    <div>
      <SectionHead title="Verification" subtitle="Document review and badge levels." action={<Button>Open queue</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="In queue" value="112" delta="" hint="submissions" />
        <StatCard label="Approved today" value="64" delta="" hint="documents" />
        <StatCard label="Rejected today" value="9" delta="" hint="documents" />
        <StatCard label="Premium checks" value="12" delta="" hint="site visits" />
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
        <Panel title="Verification queue" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["ID", "Business", "Level requested", "Documents", "Waiting"]} rows={[["V-901", "Mama Ope Kitchen", "Documents", "CAC, utility bill", "2 days"], ["V-900", "AutoPlug Mechanics", "Phone", "OTP pending", "1 day"], ["V-899", "KeyHomes Realty", "Premium", "CAC, site photos", "4 hours"]]} />
        </Panel>
      </div>
    </div>
  );
}
