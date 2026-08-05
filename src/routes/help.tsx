import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help centre — guides for customers and businesses" },
      { name: "description", content: "Step-by-step guides on listing, verification, WhatsApp setup, campaigns, billing and reporting problems." },
      { property: "og:title", content: "Help centre — guides for customers and businesses" },
      { property: "og:description", content: "Step-by-step guides on listing, verification, WhatsApp setup, campaigns, billing and reporting problems." },
    ],
  }),
  component: Page9622,
});

function Page9622() {
  return (
    <PublicShell>
      <PageHead eyebrow="Support" title="Help centre" subtitle="Step-by-step guides on listing, verification, WhatsApp setup, campaigns, billing and reporting problems." />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">For customers</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>How to search and filter businesses</li><li>Saving businesses and enquiry history</li><li>Leaving a review</li><li>Reporting a scam listing</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">For businesses</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Creating and completing your profile</li><li>Getting verified</li><li>Setting up QR codes and tracked links</li><li>Managing your team and permissions</li><li>Billing and invoices</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
