import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, CircleDashed, ShieldCheck, Sparkles } from "lucide-react";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

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

function PricingPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="For business owners"
        title="One launch offer: apply for a listing at no charge."
        subtitle="No card form, trial countdown or fictional subscription. Publication still depends on review and eligibility."
      />
      <div className="mx-auto max-w-6xl space-y-14 px-4 py-14">
        <section className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]" aria-labelledby="current-plan">
          <Card className="card-surface overflow-hidden border-primary/30 shadow-lift">
            <div className="network-stage p-6 text-ink-foreground sm:p-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Badge className="border-sidebar-primary/40 bg-sidebar-primary/15 text-sidebar-primary">
                  Available now
                </Badge>
                <ShieldCheck className="size-6 text-sidebar-primary" aria-hidden="true" />
              </div>
              <h2 id="current-plan" className="mt-6 text-3xl font-bold">
                Reviewed listing
              </h2>
              <p className="mt-2 text-sm text-ink-foreground/70">
                For eligible Nigerian businesses
              </p>
              <p className="mt-7 font-display text-5xl font-extrabold tracking-tight">
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
              <Button asChild size="lg" className="mt-8 w-full sm:w-auto">
                <Link to="/join">Apply for a free listing</Link>
              </Button>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Application receipt is not approval. Search position and verification state are not
                for sale through this offer.
              </p>
            </CardContent>
          </Card>

          <Card className="card-surface border-dashed">
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
              <div className="mt-6 rounded-xl border bg-secondary/45 p-4">
                <p className="text-sm font-semibold">Why show this boundary?</p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  A pricing page should describe a product someone can actually buy. Any future paid
                  service needs published prices, taxes, renewal, cancellation and refund terms
                  before checkout goes live.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.7fr_1.3fr]" aria-labelledby="pricing-faq">
          <div>
            <p className="eyebrow">No small print maze</p>
            <h2 id="pricing-faq" className="mt-3 text-3xl font-bold">
              What “free” means here
            </h2>
            <Sparkles className="mt-6 size-8 text-primary" aria-hidden="true" />
          </div>
          <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5">
            <AccordionItem value="charge">
              <AccordionTrigger>Will I be charged when I submit?</AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-muted-foreground">
                No. The listing application has no payment field and submission does not create a
                subscription. Never send card details or a transfer because someone claims it is
                required by this form.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="publish">
              <AccordionTrigger>Does a free application publish instantly?</AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-muted-foreground">
                No. It enters a moderation state. Only published listings appear in live directory
                search, and there is no guaranteed review time.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="rank">
              <AccordionTrigger>Can I pay for verification or first position?</AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-muted-foreground">
                Not in the current product. Verification records a defined check and is not an
                endorsement. If sponsored placement ever launches, it must be clearly labelled
                rather than disguised as an organic result.
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="owner">
              <AccordionTrigger>What can an owner see?</AccordionTrigger>
              <AccordionContent className="text-sm leading-6 text-muted-foreground">
                After signing in, an authorised owner workspace shows only that account&apos;s
                linked businesses and enquiries. It does not invent campaign reach or expose other
                owners&apos; data.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        <section
          className="rounded-[2rem] bg-secondary/55 p-7 sm:p-10"
          aria-labelledby="already-listed"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="eyebrow">Already on the map?</p>
              <h2 id="already-listed" className="mt-3 text-2xl font-bold">
                Claim the exact published profile.
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Use an authenticated claim with relevant private evidence instead of submitting a
                duplicate listing.
              </p>
            </div>
            <Button asChild variant="outline" size="lg">
              <Link to="/claim">Start a claim</Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
