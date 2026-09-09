import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "Cookie policy — GainHub NG" },
      {
        name: "description",
        content:
          "The cookies and similar technologies we use for sessions, preferences and attribution.",
      },
      { property: "og:title", content: "Cookie policy — GainHub NG" },
      {
        property: "og:description",
        content:
          "The cookies and similar technologies we use for sessions, preferences and attribution.",
      },
    ],
  }),
  component: Page7549,
});

function Page7549() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Legal"
        title="Cookie policy"
        subtitle="The cookies and similar technologies we use for sessions, preferences and attribution."
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Categories</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Essential session cookies</li>
                <li>Preference cookies</li>
                <li>Analytics and attribution cookies</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Your choices</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Manage cookie categories in settings</li>
                <li>Attribution can be disabled</li>
                <li>Essential cookies cannot be turned off</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
