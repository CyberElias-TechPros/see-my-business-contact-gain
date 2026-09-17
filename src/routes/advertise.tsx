import { createFileRoute, Link } from "@tanstack/react-router";
import { BadgeCheck, Eye, MegaphoneOff, Tag } from "lucide-react";
import { Reveal } from "@/components/motion";
import { CtaBand, EditorialSection, FeatureGrid } from "@/components/site/editorial";
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

const standards = [
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
];

function AdvertisePage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Advertising status"
        title="No ad inventory is on sale today."
        subtitle="The current product has no campaign checkout, billing, impression reporting or purchasable search position."
      />
      <div className="mx-auto max-w-5xl px-5 py-16">
        <Reveal>
          <Card className="grain network-stage overflow-hidden rounded-[2rem] text-ink-foreground shadow-lift">
            <CardContent className="relative grid gap-7 p-7 sm:p-9 md:grid-cols-[auto_1fr] md:items-center">
              <span className="grid size-16 place-items-center rounded-2xl bg-white/10 text-sidebar-primary">
                <MegaphoneOff className="size-8" aria-hidden="true" />
              </span>
              <div>
                <p className="eyebrow text-sidebar-primary">Current state</p>
                <h2 className="mt-3 font-display text-3xl font-extrabold tracking-[-0.03em]">
                  Not accepting campaigns
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-ink-foreground/70">
                  An email button is not an advertising product. Until targeting, creative review,
                  billing, reporting, cancellation and support are implemented, GainHub does not
                  claim that businesses can purchase promotion.
                </p>
              </div>
            </CardContent>
          </Card>
        </Reveal>

        <EditorialSection
          id="standards"
          eyebrow="Launch conditions"
          title="If sponsorship arrives, these lines stay bright."
        >
          <FeatureGrid items={standards} columns={3} />
        </EditorialSection>

        <div className="mt-14">
          <CtaBand
            eyebrow="Free to apply"
            title="You do not need an advert to apply for a listing."
            body="Eligible businesses can use the reviewed listing application at no charge. Submission is still subject to moderation and does not buy search position."
            primary={{ to: "/join", label: "Apply for a free listing" }}
          />
        </div>
      </div>
    </PublicShell>
  );
}
