import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  CircleHelp,
  Flag,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/help")({
  head: () => ({
    meta: [
      { title: "Help centre — GainHub NG" },
      {
        name: "description",
        content:
          "Find the right GainHub NG workflow for directory search, listing applications, ownership claims, account access, corrections and safety reports.",
      },
      { property: "og:title", content: "Help centre — GainHub NG" },
      {
        property: "og:description",
        content: "Clear routes for customers, business owners and people reporting a concern.",
      },
    ],
  }),
  component: HelpPage,
});

const routes = [
  {
    icon: Search,
    title: "Find a business",
    text: "Search current published profiles by service and supported city.",
    to: "/search" as const,
    label: "Open directory",
  },
  {
    icon: Building2,
    title: "Add a business",
    text: "Submit public profile details for review. Submission is not instant publication.",
    to: "/join" as const,
    label: "Start application",
  },
  {
    icon: UserRound,
    title: "Claim a profile",
    text: "Sign in, choose the exact published listing and upload relevant private evidence.",
    to: "/claim" as const,
    label: "Open claim route",
  },
  {
    icon: Flag,
    title: "Report a concern",
    text: "Privately report impersonation, scams, abuse, closure or inaccurate information.",
    to: "/report" as const,
    label: "Open report form",
  },
];

const faqs = [
  {
    q: "Why can I not find a business that was submitted?",
    a: "Listing applications begin in a review state. Only published records appear in live search. A successful submission confirms receipt, not approval or a guaranteed review date.",
  },
  {
    q: "Does a verification label guarantee the business?",
    a: "No. A label records only the narrow check described by that state. It does not promise workmanship, price, licensing, availability or a successful transaction. Use the trust and safety checklist before paying.",
  },
  {
    q: "What happens when I send an enquiry?",
    a: "The selected business owner can see the name, Nigerian phone number and message you submit. You decide whether to continue by phone, WhatsApp or another channel. Do not include passwords, one-time codes or payment-card details.",
  },
  {
    q: "Can I edit a profile I do not own?",
    a: "Use Suggest a correction for factual changes. To access the owner workspace and enquiries for a listing, use the authenticated claim route and provide relevant evidence.",
  },
  {
    q: "Where are contact-circle member phone numbers?",
    a: "They are intentionally not public. Circle pages show purpose, rules, eligibility, capacity and aggregate membership. Participation requires an application by an authenticated owner of a published business.",
  },
  {
    q: "How do I request my personal data or account deletion?",
    a: "Sign in and use the personal-data request form for access, portability, correction or deletion. The request enters a tracked queue and may require identity verification before action.",
  },
  {
    q: "Why does a page say the live directory is unavailable?",
    a: "The application does not silently replace an unavailable API with fictional business records. Wait briefly and try again. Clearly marked preview profiles may still be available on demonstration surfaces, but they cannot receive real enquiries or claims.",
  },
];

function HelpPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Help centre"
        title="Start with what you are trying to do."
        subtitle="Each action has one honest route. Choose below, or read the answers for what happens next."
      />
      <div className="mx-auto max-w-6xl space-y-14 px-4 py-14">
        <section aria-labelledby="routes-heading">
          <h2 id="routes-heading" className="sr-only">
            Help routes
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {routes.map((route) => (
              <Card key={route.title} className="card-surface h-full">
                <CardContent className="flex h-full flex-col p-6">
                  <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                    <route.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{route.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">
                    {route.text}
                  </p>
                  <Link
                    to={route.to}
                    className="mt-5 inline-flex min-h-11 items-center gap-1 self-start rounded-lg font-semibold text-primary hover:gap-2 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                  >
                    {route.label}{" "}
                    <ArrowRight className="size-4 transition-all" aria-hidden="true" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr]" aria-labelledby="faq-heading">
          <div>
            <p className="eyebrow">Straight answers</p>
            <h2 id="faq-heading" className="mt-3 text-3xl font-bold">
              Before you press submit
            </h2>
            <p className="mt-4 text-sm leading-6 text-muted-foreground">
              These answers describe the current product. They do not promise features or response
              times that the application cannot provide.
            </p>
            <Button asChild variant="outline" className="mt-6">
              <Link to="/trust-safety">
                <ShieldCheck aria-hidden="true" /> Read trust guidance
              </Link>
            </Button>
          </div>
          <Accordion type="single" collapsible className="rounded-2xl border bg-card px-5">
            {faqs.map((faq, index) => (
              <AccordionItem key={faq.q} value={`item-${index}`}>
                <AccordionTrigger className="text-left text-base">{faq.q}</AccordionTrigger>
                <AccordionContent className="pr-6 text-sm leading-6 text-muted-foreground">
                  {faq.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>

        <section
          className="rounded-[2rem] bg-secondary/55 p-7 sm:p-9"
          aria-labelledby="still-heading"
        >
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CircleHelp className="size-6 text-primary" aria-hidden="true" />
              <h2 id="still-heading" className="mt-3 text-2xl font-bold">
                Is the listing wrong or unsafe?
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Use a correction for ordinary factual changes. Use a report for fraud,
                impersonation, abuse, closure or another safety concern.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Button asChild variant="outline">
                <Link to="/suggest-business">Suggest correction</Link>
              </Button>
              <Button asChild>
                <Link to="/report">Report concern</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
