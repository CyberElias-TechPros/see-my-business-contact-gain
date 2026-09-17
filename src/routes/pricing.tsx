import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CircleDashed, ShieldCheck } from "lucide-react";
import { Magnetic, Reveal } from "@/components/motion";
import { CtaBand, EditorialSection, FaqList } from "@/components/site/editorial";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "List a Nigerian business — current access and future plans | GainHub NG" },
      {
        name: "description",
        content:
          "GainHub NG currently accepts free business listing applications. See exactly what is available now and what has not launched.",
      },
      { property: "og:title", content: "For business owners — GainHub NG" },
      {
        property: "og:description",
        content:
          "Apply for a free reviewed listing and understand the current owner workspace without hidden paid-plan claims.",
      },
    ],
  }),
  component: PricingPage,
});

const included = [
  "Reviewed public profile application",
  "Business name, description, category and supported city",
  "Public phone, WhatsApp and website fields when supplied",
  "Recorded availability signal and verification state on published profiles",
  "Authenticated view of your own listings and enquiries",
  "Ownership claim and factual-correction routes",
];

const pricingFaqs = [
  {
    q: "Will I be charged when I submit?",
    a: "No. The listing application has no payment field and submission does not create a subscription. Never send card details or a transfer because someone claims it is required by this form.",
  },
  {
    q: "Does a free application publish instantly?",
    a: "No. It enters a moderation state. Only published listings appear in live directory search, and there is no guaranteed review time.",
  },
  {
    q: "Can I pay for verification or first position?",
    a: "Not in the current product. Verification records a defined check and is not an endorsement. If sponsored placement ever launches, it must be clearly labelled rather than disguised as an organic result.",
  },
  {
    q: "What can an owner see?",
    a: "After signing in, an authorised owner workspace shows only that account's linked businesses and enquiries. It does not invent campaign reach or expose other owners' data.",
  },
];

function PricingPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="For business owners"
        title="One launch offer: apply for a listing at no charge."
        subtitle="No card form, trial countdown or fictional subscription. Publication still depends on review and eligibility."
      />
      <div className="mx-auto max-w-6xl px-5 py-16">
        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]" aria-labelledby="current-plan">
          <Reveal className="h-full">
            <Card className="grain relative h-full overflow-hidden rounded-[2rem] border-primary/30 shadow-lift">
              <div className="network-stage relative p-6 text-ink-foreground sm:p-8">
                <div className="relative flex flex-wrap items-center justify-between gap-3">
                  <Badge className="border-sidebar-primary/40 bg-sidebar-primary/15 text-sidebar-primary">
                    Available now
                  </Badge>
                  <ShieldCheck className="size-6 text-sidebar-primary" aria-hidden="true" />
                </div>
                <h2
                  id="current-plan"
                  className="relative mt-6 font-display text-3xl font-extrabold"
                >
                  Reviewed listing
                </h2>
                <p className="relative mt-2 text-sm text-ink-foreground/70">
                  For eligible Nigerian businesses
                </p>
                <p className="relative mt-7 font-display text-6xl font-extrabold tracking-[-0.04em]">
                  ₦0{" "}
                  <span className="font-sans text-base font-medium text-ink-foreground/60">
                    at launch
                  </span>
                </p>
              </div>
              <CardContent className="p-6 sm:p-8">
                <ul className="grid gap-3 sm:grid-cols-2">
                  {included.map((item) => (
                    <li key={item} className="flex gap-2.5 text-sm leading-6 text-muted-foreground">
                      <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
                <Magnetic>
                  <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
                    <Link to="/join">Apply for a free listing</Link>
                  </Button>
                </Magnetic>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">
                  Application receipt is not approval. Search position and verification state are
                  not for sale through this offer.
                </p>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={1} className="h-full">
            <Card className="h-full rounded-[2rem] border-dashed border-border/70">
              <CardContent className="p-6 sm:p-8">
                <div className="flex items-center justify-between gap-3">
                  <Badge variant="outline">Not active</Badge>
                  <CircleDashed className="size-6 text-muted-foreground" aria-hidden="true" />
                </div>
                <h2 className="mt-6 text-2xl font-bold">Paid growth tools</h2>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  The current application does not take subscription payments or unlock a paid tier.
                  Campaign management, invoices, recurring billing, paid placement and priority
                  support are not represented as available.
                </p>
                <div className="mt-6 rounded-xl border border-border/70 bg-secondary/45 p-4">
                  <p className="text-sm font-semibold">Why show this boundary?</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    A pricing page should describe a product someone can actually buy. Any future
                    paid service needs published prices, taxes, renewal, cancellation and refund
                    terms before checkout goes live.
                  </p>
                </div>
              </CardContent>
            </Card>
          </Reveal>
        </section>

        <EditorialSection
          id="pricing-faq"
          eyebrow="No small print maze"
          title="What “free” means here"
        >
          <FaqList items={pricingFaqs} />
        </EditorialSection>

        <div className="mt-14">
          <CtaBand
            eyebrow="Already on the map?"
            title="Claim the exact published profile."
            body="Use an authenticated claim with relevant private evidence instead of submitting a duplicate listing."
            primary={{ to: "/claim", label: "Start a claim" }}
          />
        </div>
      </div>
    </PublicShell>
  );
}
