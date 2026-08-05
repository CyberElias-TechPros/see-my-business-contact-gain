import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/report")({
  head: () => ({
    meta: [
      { title: "Report a listing, review or member — GainHub NG" },
      { name: "description", content: "Tell us what happened. Reports go straight to the moderation queue with risk ranking." },
      { property: "og:title", content: "Report a listing, review or member — GainHub NG" },
      { property: "og:description", content: "Tell us what happened. Reports go straight to the moderation queue with risk ranking." },
    ],
  }),
  component: Page1094,
});

function Page1094() {
  return (
    <PublicShell>
      <PageHead eyebrow="Safety" title="Report a listing, review or member" subtitle="Tell us what happened. Reports go straight to the moderation queue with risk ranking." />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">What to report</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Scam or advance-fee requests</li><li>Impersonation of another business</li><li>Fake reviews</li><li>Adult or violent images</li><li>Wrong or closed listing</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">What happens next</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Automatic risk scoring on submission</li><li>Human moderator review</li><li>Action: warning, hide, suspend or ban</li><li>You get notified of the outcome</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
