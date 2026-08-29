import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of use — GainHub NG" },
      {
        name: "description",
        content: "The rules for using the directory, the workspace and contact-gain rooms.",
      },
      { property: "og:title", content: "Terms of use — GainHub NG" },
      {
        property: "og:description",
        content: "The rules for using the directory, the workspace and contact-gain rooms.",
      },
    ],
  }),
  component: Page5610,
});

function Page5610() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Legal"
        title="Terms of use"
        subtitle="The rules for using the directory, the workspace and contact-gain rooms."
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Platform rules</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>No scam, adult or illegal listings</li>
                <li>No impersonation or fake reviews</li>
                <li>No harvesting member numbers for spam</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Business obligations</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Keep listing information accurate</li>
                <li>Honour published prices where stated</li>
                <li>Respond to enquiries you accept</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
