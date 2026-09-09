import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/legal/data-request")({
  head: () => ({
    meta: [
      { title: "Data access & delete requests — GainHub NG" },
      {
        name: "description",
        content:
          "Request an export of your data or ask us to delete your account, as provided under the NDPR.",
      },
      { property: "og:title", content: "Data access & delete requests — GainHub NG" },
      {
        property: "og:description",
        content:
          "Request an export of your data or ask us to delete your account, as provided under the NDPR.",
      },
    ],
  }),
  component: Page5590,
});

function Page5590() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Legal"
        title="Data access & delete requests"
        subtitle="Request an export of your data or ask us to delete your account, as provided under the NDPR."
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Export</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Profile and account data</li>
                <li>Saved businesses and enquiry history</li>
                <li>Reviews you have written</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Deletion</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Account and login removed</li>
                <li>Personal data erased or anonymised</li>
                <li>Some records kept where the law requires</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
