import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/trust-safety")({
  head: () => ({
    meta: [
      { title: "Trust & safety — verification, moderation and reporting" },
      { name: "description", content: "How we verify businesses, pre-screen media, review reports and act on scams and impersonation." },
      { property: "og:title", content: "Trust & safety — verification, moderation and reporting" },
      { property: "og:description", content: "How we verify businesses, pre-screen media, review reports and act on scams and impersonation." },
    ],
  }),
  component: Page9298,
});

function Page9298() {
  return (
    <PublicShell>
      <PageHead eyebrow="Trust" title="Trust & safety" subtitle="How we verify businesses, pre-screen media, review reports and act on scams and impersonation." />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Verification levels</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Unverified — self-listed</li><li>Email verified</li><li>Phone/WhatsApp verified</li><li>Documents verified (CAC, utility bill)</li><li>Premium verified with physical check</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Moderation</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>AI pre-screening for nudity, violence and scam keywords</li><li>Human review queue with risk ranking</li><li>Published response-time SLA</li><li>Repeat-offender bans across rooms and listings</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
