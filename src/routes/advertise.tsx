import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Eye, MegaphoneOff, Tag } from "lucide-react";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/advertise")({
  head: () => ({
    meta: [
      { title: "Advertising status — GainHub NG" },
      {
        name: "description",
        content:
          "GainHub NG is not currently selling ad inventory or paid directory placement. Read the standards that must apply before sponsorship launches.",
      },
      { property: "og:title", content: "Advertising status — GainHub NG" },
      {
        property: "og:description",
        content:
          "No live advertising checkout, campaign manager or paid placement is currently offered.",
      },
    ],
  }),
  component: AdvertisePage,
});

function AdvertisePage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Advertising status"
        title="No ad inventory is on sale today."
        subtitle="The current product has no campaign checkout, billing, impression reporting or purchasable search position."
      />
      <div className="mx-auto max-w-5xl space-y-12 px-4 py-14">
        <Card className="network-stage overflow-hidden text-ink-foreground shadow-lift">
          <CardContent className="grid gap-7 p-7 sm:p-9 md:grid-cols-[auto_1fr] md:items-center">
            <span className="grid size-16 place-items-center rounded-2xl bg-white/10 text-sidebar-primary">
              <MegaphoneOff className="size-8" aria-hidden="true" />
            </span>
            <div>
              <p className="eyebrow text-sidebar-primary">Current state</p>
              <h2 className="mt-3 text-3xl font-bold">Not accepting campaigns</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-foreground/70">
                An email button is not an advertising product. Until targeting, creative review,
                billing, reporting, cancellation and support are implemented, GainHub does not claim
                that businesses can purchase promotion.
              </p>
            </div>
          </CardContent>
        </Card>

        <section aria-labelledby="standards-heading">
          <p className="eyebrow">Launch conditions</p>
          <h2 id="standards-heading" className="mt-3 text-3xl font-bold">
            If sponsorship arrives, these lines stay bright.
          </h2>
          <div className="mt-7 grid gap-4 sm:grid-cols-3">
            {[
              {
                icon: Tag,
                title: "Visible labels",
                text: "Sponsored results must say so in plain language and remain distinguishable from organic listings.",
              },
              {
                icon: Eye,
                title: "Explain delivery",
                text: "Buyers need the placement, audience, period and reporting method before they pay.",
              },
              {
                icon: BadgeCheck,
                title: "No trust for sale",
                text: "Payment must not assign a verification label or imply independent endorsement.",
              },
            ].map((standard) => (
              <Card key={standard.title} className="card-surface h-full">
                <CardContent className="p-6">
                  <standard.icon className="size-6 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 font-semibold">{standard.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{standard.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section
          className="rounded-[2rem] bg-secondary/55 p-7 text-center sm:p-10"
          aria-labelledby="organic-heading"
        >
          <h2 id="organic-heading" className="text-2xl font-bold">
            You do not need an advert to apply for a listing.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Eligible businesses can use the reviewed listing application at no charge. Submission is
            still subject to moderation and does not buy search position.
          </p>
          <Button asChild className="mt-6">
            <Link to="/join">Apply for a free listing</Link>
          </Button>
        </section>
      </div>
    </PublicShell>
  );
}
