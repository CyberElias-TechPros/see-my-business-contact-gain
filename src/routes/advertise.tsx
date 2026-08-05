import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/advertise")({
  head: () => ({
    meta: [
      { title: "Advertise & sponsored placement — GainHub NG" },
      { name: "description", content: "Buy sponsored placement in category and location results, room spotlights and homepage features." },
      { property: "og:title", content: "Advertise & sponsored placement — GainHub NG" },
      { property: "og:description", content: "Buy sponsored placement in category and location results, room spotlights and homepage features." },
    ],
  }),
  component: Page5435,
});

function Page5435() {
  return (
    <PublicShell>
      <PageHead eyebrow="Advertisers" title="Advertise & sponsored placement" subtitle="Buy sponsored placement in category and location results, room spotlights and homepage features." />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Inventory</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Category result spotlight</li><li>Location landing feature</li><li>Contact-gain room banner</li><li>Homepage featured card</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Reporting</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Impressions, clicks and WhatsApp chats started</li><li>Cost per contact gained</li><li>Campaign pacing and budget alerts</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
