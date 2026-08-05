import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About GainHub NG — built for Nigerian businesses" },
      { name: "description", content: "We connect Nigerian customers with businesses they can trust, and give every business the tools to turn WhatsApp chats into customers." },
      { property: "og:title", content: "About GainHub NG — built for Nigerian businesses" },
      { property: "og:description", content: "We connect Nigerian customers with businesses they can trust, and give every business the tools to turn WhatsApp chats into customers." },
    ],
  }),
  component: Page523,
});

function Page523() {
  return (
    <PublicShell>
      <PageHead eyebrow="Company" title="About GainHub NG" subtitle="We connect Nigerian customers with businesses they can trust, and give every business the tools to turn WhatsApp chats into customers." />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Why we exist</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Contact gain already works in Nigeria — it just needed structure</li><li>Small businesses deserve real attribution, not guesswork</li><li>Customers deserve verified information before they pay</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">How we work</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Nigeria-first product decisions</li><li>Moderation with published response times</li><li>NDPR-aligned data handling</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
