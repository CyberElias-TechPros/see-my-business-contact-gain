import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Eye, MessageCircle, ShieldCheck, Store } from "lucide-react";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About GainHub NG — practical local business discovery" },
      {
        name: "description",
        content:
          "GainHub NG helps people find Nigerian businesses, assess useful profile details and start a direct conversation without turning contact data into a commodity.",
      },
      { property: "og:title", content: "About GainHub NG" },
      {
        property: "og:description",
        content:
          "A practical, conversation-first directory designed around Nigerian cities and businesses.",
      },
    ],
  }),
  component: AboutPage,
});

const principles = [
  {
    icon: Eye,
    title: "Show the state of the data",
    text: "Live records, unavailable services and fictional previews are different things. The interface should never blur them together.",
  },
  {
    icon: MessageCircle,
    title: "Help a useful conversation start",
    text: "A directory earns its place when someone can understand a provider, ask a specific question and keep a traceable route back.",
  },
  {
    icon: ShieldCheck,
    title: "Make trust labels narrow",
    text: "A reviewed contact or document is not a guarantee of quality. Every label should say only what was actually checked.",
  },
  {
    icon: Store,
    title: "Give small businesses clear attribution",
    text: "Owners should see the enquiries and contact intent attached to their own published profile—not invented reach or vanity metrics.",
  },
];

function AboutPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="About"
        title="A clearer path from “who can help?” to “let’s talk.”"
        subtitle="GainHub NG is a Nigerian local-business directory built around practical information, honest trust signals and direct conversation."
      />
      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14">
        <section
          className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start"
          aria-labelledby="why-heading"
        >
          <div>
            <p className="eyebrow">Why this exists</p>
            <h2
              id="why-heading"
              className="mt-3 max-w-2xl text-3xl font-bold leading-tight sm:text-4xl"
            >
              Local recommendations already travel through conversation. Discovery should make that
              conversation better.
            </h2>
            <div className="mt-6 max-w-2xl space-y-4 text-base leading-8 text-muted-foreground">
              <p>
                People often know the service they need but not which nearby business is suitable.
                Businesses, meanwhile, struggle to tell which calls and chats came from a directory.
                GainHub connects those two moments without pretending the directory completes the
                transaction itself.
              </p>
              <p>
                Search narrows the field. A profile provides context. An enquiry or deliberate
                contact action creates the hand-off. The business and customer still decide whether,
                and how, to work together.
              </p>
            </div>
          </div>
          <Card className="network-stage overflow-hidden text-ink-foreground shadow-lift">
            <CardContent className="p-7 sm:p-8">
              <p className="eyebrow text-sidebar-primary">The product boundary</p>
              <p className="mt-5 font-display text-3xl font-bold leading-tight">
                Enough signal to choose. No invented certainty.
              </p>
              <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10">
                {[
                  ["Directory", "Current published profiles"],
                  ["Workspace", "Owned listings and enquiries"],
                  ["Circles", "Explicit opt-in membership"],
                  ["Moderation", "Evidence and accountable queues"],
                ].map(([label, value]) => (
                  <div key={label} className="bg-ink/80 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-sidebar-primary">
                      {label}
                    </p>
                    <p className="mt-2 text-sm leading-5 text-ink-foreground/75">{value}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        <section aria-labelledby="principles-heading">
          <p className="eyebrow">Product principles</p>
          <h2 id="principles-heading" className="mt-3 text-3xl font-bold">
            The rules behind the routes
          </h2>
          <div className="mt-7 grid gap-4 md:grid-cols-2">
            {principles.map((principle, index) => (
              <Card key={principle.title} className="card-surface h-full">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                      <principle.icon className="size-5" aria-hidden="true" />
                    </span>
                    <span className="font-display text-3xl font-bold text-border">
                      0{index + 1}
                    </span>
                  </div>
                  <h3 className="mt-5 text-lg font-semibold">{principle.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{principle.text}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section
          className="rounded-[2rem] border bg-secondary/45 p-7 sm:p-10"
          aria-labelledby="how-heading"
        >
          <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
            <div>
              <p className="eyebrow">How it works today</p>
              <h2 id="how-heading" className="mt-3 text-3xl font-bold">
                Small surface. Real workflows.
              </h2>
            </div>
            <ol className="space-y-5">
              {[
                "Businesses apply with public profile details and consent to the listing terms.",
                "The directory publishes reviewed records; preview records remain visibly separate.",
                "Customers filter by need and city, then enquire or choose an available contact route.",
                "Owners see only their own listings and enquiries in an authenticated workspace.",
                "Reports, corrections, claims and circle applications enter bounded moderation workflows.",
              ].map((step, index) => (
                <li key={step} className="flex gap-4 text-sm leading-6">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink font-bold text-ink-foreground">
                    {index + 1}
                  </span>
                  <p className="pt-1 text-muted-foreground">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="text-center" aria-labelledby="next-heading">
          <p className="eyebrow">Choose your route</p>
          <h2 id="next-heading" className="mt-3 text-3xl font-bold">
            Find help, or put your work on the map.
          </h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/search">
                Search the directory <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/join">Apply for a free listing</Link>
            </Button>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
