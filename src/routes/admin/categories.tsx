import { createFileRoute } from "@tanstack/react-router";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Panel, SimpleTable, StatCard, BarTrend, SourceBars } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { trendData, sourceData } from "@/data/mock";
import { categories } from "@/data/mock";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

function AdminCategories() {
  return (
    <div>
      <SectionHead title="Categories & attributes" subtitle="Taxonomy, filters and category-specific profile requirements." action={<Button>New category</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Categories" value="148" delta="+4" hint="this quarter" />
        <StatCard label="Attributes" value="912" delta="" hint="defined" />
        <StatCard label="Templates" value="148" delta="" hint="profile templates" />
        <StatCard label="Pending merges" value="2" delta="" hint="review" />
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
        <Panel title="Taxonomy" action={<Badge variant="outline">Demo data</Badge>}>
          <SimpleTable columns={["Category", "Slug", "Listings", "Attributes"]} rows={categories.map((c) => [c.name, c.slug, c.count.toLocaleString(), "12"])} />
        </Panel>
      </div>
    </div>
  );
}
