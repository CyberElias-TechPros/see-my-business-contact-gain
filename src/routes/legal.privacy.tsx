import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy (NDPR) — GainHub NG" },
      { name: "description", content: "How we collect, use, store and delete personal data, in line with the Nigeria Data Protection Regulation." },
      { property: "og:title", content: "Privacy policy (NDPR) — GainHub NG" },
      { property: "og:description", content: "How we collect, use, store and delete personal data, in line with the Nigeria Data Protection Regulation." },
    ],
  }),
  component: Page7808,
});

function Page7808() {
  return (
    <PublicShell>
      <PageHead eyebrow="Legal" title="Privacy policy (NDPR)" subtitle="How we collect, use, store and delete personal data, in line with the Nigeria Data Protection Regulation." />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">What we collect</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Account details and phone numbers</li><li>Enquiry and conversation metadata</li><li>Attribution data such as source links and QR scans</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Your rights</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Access a copy of your data</li><li>Correct inaccurate data</li><li>Delete your account and data</li><li>Withdraw consent for marketing</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
