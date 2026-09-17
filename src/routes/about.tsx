import { createFileRoute } from "@tanstack/react-router";
import { Eye, MessageCircle, ShieldCheck, Store } from "lucide-react";
import { Reveal } from "@/components/motion";
import { CtaBand, EditorialSection, StepList } from "@/components/site/editorial";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
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

const surface = [
  ["Directory", "Current published profiles"],
  ["Workspace", "Owned listings and enquiries"],
  ["Circles", "Explicit opt-in membership"],
  ["Moderation", "Evidence and accountable queues"],
] as const;

const flow = [
  {
    title: "Apply with consent",
    text: "Businesses apply with public profile details and consent to the listing terms.",
  },
  {
    title: "Review before publishing",
    text: "The directory publishes reviewed records; preview records remain visibly separate.",
  },
  {
    title: "Search with intent",
    text: "Customers filter by need and city, then enquire or choose an available contact route.",
  },
  {
    title: "Owners see their own",
    text: "Owners see only their own listings and enquiries in an authenticated workspace.",
  },
  {
    title: "Moderation stays bounded",
    text: "Reports, corrections, claims and circle applications enter bounded moderation workflows.",
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

      <div className="mx-auto max-w-6xl px-5 py-16">
        <EditorialSection
          eyebrow="Why this exists"
          title="Local recommendations already travel through conversation. Discovery should make that conversation better."
          aside={
            <Reveal delay={1}>
              <Card className="grain relative overflow-hidden rounded-3xl bg-ink text-ink-foreground shadow-lift">
                <CardContent className="relative p-7">
                  <p className="eyebrow text-sidebar-primary">The product boundary</p>
                  <p className="mt-4 font-display text-2xl font-extrabold leading-tight">
                    Enough signal to choose. No invented certainty.
                  </p>
                  <div className="mt-7 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10">
                    {surface.map(([label, value]) => (
                      <div key={label} className="bg-ink/80 p-4">
                        <p className="text-xs font-bold uppercase tracking-widest text-sidebar-primary">
                          {label}
                        </p>
                        <p className="mt-2 text-sm leading-5 text-ink-foreground/72">{value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Reveal>
          }
        >
          <div className="max-w-2xl space-y-5 text-base leading-8 text-muted-foreground">
            <p>
              People often know the service they need but not which nearby business is suitable.
              Businesses, meanwhile, struggle to tell which calls and chats came from a directory.
              GainHub connects those two moments without pretending the directory completes the
              transaction itself.
            </p>
            <p>
              Search narrows the field. A profile provides context. An enquiry or deliberate contact
              action creates the hand-off. The business and customer still decide whether, and how,
              to work together.
            </p>
          </div>
        </EditorialSection>

        <EditorialSection
          id="principles"
          eyebrow="Product principles"
          title="The rules behind the routes"
        >
          <ul className="grid gap-4 md:grid-cols-2">
            {principles.map((principle, index) => (
              <Reveal as="li" key={principle.title} delay={index % 2} className="h-full">
                <Card className="group h-full rounded-3xl border-border/70 transition-[border-color,box-shadow] duration-500 hover:border-primary/30 hover:shadow-lift">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-primary transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                        <principle.icon className="size-5" aria-hidden="true" />
                      </span>
                      <span className="font-display text-3xl font-extrabold text-border">
                        0{index + 1}
                      </span>
                    </div>
                    <h3 className="mt-5 text-lg font-bold">{principle.title}</h3>
                    <p className="mt-2.5 text-sm leading-6 text-muted-foreground">
                      {principle.text}
                    </p>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </ul>
        </EditorialSection>

        <EditorialSection
          id="how"
          eyebrow="How it works today"
          title="Small surface. Real workflows."
        >
          <StepList steps={flow} />
        </EditorialSection>

        <div className="mt-14">
          <CtaBand
            eyebrow="Choose your route"
            title="Find help, or put your work on the map."
            primary={{ to: "/search", label: "Search the directory" }}
            secondary={{ to: "/join", label: "Apply for a free listing" }}
          />
        </div>
      </div>
    </PublicShell>
  );
}
