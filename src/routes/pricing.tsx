import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
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
      { title: "Plans & pricing for Nigerian businesses — GainHub NG" },
      {
        name: "description",
        content:
          "Start free, upgrade for tracked campaigns, team seats, automation and premium verification. Naira pricing, no hidden fees.",
      },
      { property: "og:title", content: "Plans & pricing — GainHub NG" },
      {
        property: "og:description",
        content: "Free listing, Growth and Pro plans in Naira for Nigerian businesses.",
      },
    ],
  }),
  component: PricingPage,
});

const plans = [
  {
    name: "Free",
    price: "₦0",
    note: "For getting listed",
    features: ["Public profile", "WhatsApp button", "3 photos", "Basic analytics", "1 team seat"],
    missing: ["Campaigns & QR", "Automation", "Priority ranking"],
  },
  {
    name: "Growth",
    price: "₦12,500/mo",
    note: "Most popular",
    highlight: true,
    features: [
      "Everything in Free",
      "Unlimited photos & products",
      "QR codes & tracked links",
      "CRM inbox + pipeline",
      "5 team seats",
      "Automation rules",
    ],
    missing: ["Sponsored placement"],
  },
  {
    name: "Pro",
    price: "₦35,000/mo",
    note: "For teams & multi-branch",
    features: [
      "Everything in Growth",
      "Multi-branch profiles",
      "Sponsored placement credits",
      "Round-robin assignment",
      "20 team seats",
      "Priority verification & support",
    ],
    missing: [],
  },
];

function PricingPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Pricing"
        title="Plans that fit Nigerian budgets"
        subtitle="Pay monthly in Naira. Cancel anytime. Your listing never disappears when you downgrade."
      />
      <div className="mx-auto max-w-7xl space-y-12 px-4 py-12">
        <div className="grid gap-4 lg:grid-cols-3">
          {plans.map((p) => (
            <Card
              key={p.name}
              className={`card-surface ${p.highlight ? "ring-2 ring-primary" : ""}`}
            >
              <CardContent className="space-y-4 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{p.name}</h2>
                  {p.highlight ? <Badge>Popular</Badge> : null}
                </div>
                <p className="font-display text-3xl font-bold">{p.price}</p>
                <p className="text-sm text-muted-foreground">{p.note}</p>
                <Button asChild className="w-full" variant={p.highlight ? "default" : "outline"}>
                  <Link to="/join">Choose {p.name}</Link>
                </Button>
                <ul className="space-y-2 pt-2 text-sm">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="size-4 text-primary" /> {f}
                    </li>
                  ))}
                  {p.missing.map((f) => (
                    <li key={f} className="flex gap-2 text-muted-foreground">
                      <X className="size-4" /> {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
        <Card className="card-surface">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">Frequently asked</h2>
            <Accordion type="single" collapsible className="mt-3">
              {(
                [
                  [
                    "Can I use my personal WhatsApp number?",
                    "Yes. Most Nigerian businesses do. You can switch to a business number later without losing your leads.",
                  ],
                  [
                    "What happens if I stop paying?",
                    "Your profile stays public, but campaigns, automation and extra seats pause until you renew.",
                  ],
                  ["Do you take a commission on jobs?", "No. We charge a flat subscription only."],
                  [
                    "How do you handle my customers' data?",
                    "We follow NDPR: data minimisation, consent screens, export and delete requests.",
                  ],
                ] as [string, string][]
              ).map(([q, a]) => (
                <AccordionItem key={q} value={q}>
                  <AccordionTrigger className="text-left text-sm">{q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
