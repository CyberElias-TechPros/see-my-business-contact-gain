import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Inbox,
  MapPin,
  MessageCircle,
  Building2,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { BusinessCard } from "@/components/kit";
import { PreviewNotice, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { businesses, categories, locations } from "@/data/mock";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GainHub NG — Find the right local business, then start talking" },
      {
        name: "description",
        content:
          "Search Nigerian businesses by what you need and where you are. Compare useful details, look for verification, and start a WhatsApp conversation.",
      },
      { property: "og:title", content: "GainHub NG — Local discovery built around conversation" },
      {
        property: "og:description",
        content:
          "A clearer route from local search to a real conversation with the right Nigerian business.",
      },
    ],
  }),
  component: Home,
});

const process = [
  {
    number: "01",
    icon: Search,
    title: "Search with intent",
    body: "Start with the job, product or service—not a maze of categories. Add your city when it matters.",
  },
  {
    number: "02",
    icon: ShieldCheck,
    title: "Check the signals",
    body: "Review location, availability, service detail and a clearly explained verification level before you act.",
  },
  {
    number: "03",
    icon: MessageCircle,
    title: "Start the conversation",
    body: "Move into WhatsApp with context intact, or send a structured enquiry the business can actually respond to.",
  },
];

const businessTools = [
  {
    icon: Building2,
    title: "One profile, clear public facts",
    body: "Publish the service, location and contact details a customer needs before deciding to reach out.",
  },
  {
    icon: Inbox,
    title: "Keep enquiries with the listing",
    body: "See structured enquiries attached only to businesses your authenticated account is authorised to manage.",
  },
  {
    icon: BadgeCheck,
    title: "Use trust labels carefully",
    body: "Show the recorded verification state while keeping its limits visible to every potential customer.",
  },
];

function SignalMap() {
  return (
    <div className="network-stage relative min-h-[31rem] rounded-[2rem] p-6 text-ink-foreground shadow-lift sm:p-8">
      <div className="flex items-center justify-between">
        <p className="eyebrow text-sidebar-primary">Connection sketch</p>
        <span className="flex items-center gap-2 text-xs text-ink-foreground/60">
          <span className="size-2 rounded-full bg-sidebar-primary shadow-[0_0_16px_currentColor]" />{" "}
          Route illustrated
        </span>
      </div>
      <svg
        viewBox="0 0 560 420"
        role="img"
        aria-label="Illustration of customers connecting to local businesses across a city"
        className="absolute inset-x-4 top-16 h-[22rem] w-[calc(100%-2rem)]"
      >
        <defs>
          <linearGradient id="route-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#78e28e" />
            <stop offset="1" stopColor="#f7bd51" />
          </linearGradient>
          <filter id="route-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d="M48 322 C120 252 160 302 218 214 S340 92 506 122"
          fill="none"
          stroke="url(#route-gradient)"
          strokeWidth="2.5"
          className="route-line"
          filter="url(#route-glow)"
        />
        <path
          d="M82 80 C156 144 190 128 254 198 S390 318 510 286"
          fill="none"
          stroke="rgba(255,255,255,.22)"
          strokeWidth="1.5"
          className="route-line"
        />
        {(
          [
            [48, 322, 10],
            [82, 80, 7],
            [218, 214, 12],
            [350, 139, 8],
            [506, 122, 12],
            [510, 286, 8],
          ] as const
        ).map(([cx, cy, radius], index) => (
          <g key={`${cx}-${cy}`}>
            <circle cx={cx} cy={cy} r={radius + 11} fill="rgba(119,226,142,.08)" />
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill={index === 2 ? "#f7bd51" : "#78e28e"}
              stroke="#12372a"
              strokeWidth="4"
            />
          </g>
        ))}
      </svg>
      <div className="signal-ring left-[27%] top-[31%] size-40" aria-hidden="true" />
      <div
        className="signal-ring left-[27%] top-[31%] size-40 [animation-delay:1.4s]"
        aria-hidden="true"
      />
      <div className="signal-dot left-[43%] top-[47%]" aria-hidden="true" />
      <div className="ambient-float absolute bottom-7 left-6 right-6 rounded-2xl border border-white/10 bg-white/8 p-4 backdrop-blur-md sm:left-auto sm:w-[19rem]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <MessageCircle className="size-5" />
          </span>
          <div>
            <p className="text-sm font-bold">Search became a conversation</p>
            <p className="mt-1 text-xs leading-5 text-ink-foreground/60">
              Service detail and location travel with the customer, so the first message starts with
              context.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Home() {
  return (
    <PublicShell>
      <section className="paper-grid relative overflow-hidden border-b bg-hero-mesh">
        <div
          className="absolute -left-32 top-32 size-80 rounded-full border border-primary/10"
          aria-hidden="true"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
          <div className="reveal-up">
            <Badge
              variant="secondary"
              className="mb-6 gap-2 border border-primary/15 bg-background/70 px-3 py-1.5"
            >
              <Sparkles className="size-3.5 text-primary" /> Local discovery, rebuilt around
              conversation
            </Badge>
            <h1 className="max-w-3xl text-[clamp(3.2rem,7vw,6.6rem)] font-extrabold leading-[0.86] tracking-[-0.065em]">
              Find better.
              <br />
              <span className="text-gradient-brand">Talk sooner.</span>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-8 text-muted-foreground">
              Search for what you need, see the signals that matter, then reach the right Nigerian
              business without the usual runaround.
            </p>
            <form
              action="/search"
              method="get"
              role="search"
              className="mt-8 flex max-w-2xl flex-col gap-2 rounded-2xl border border-foreground/10 bg-card/90 p-2.5 shadow-lift sm:flex-row"
            >
              <label className="flex min-h-12 flex-1 items-center gap-3 px-3">
                <Search className="size-5 shrink-0 text-primary" aria-hidden="true" />
                <span className="sr-only">What are you looking for?</span>
                <input
                  name="q"
                  type="search"
                  autoComplete="off"
                  placeholder="Try “phone repair in Ikeja”"
                  className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/65"
                />
              </label>
              <Button type="submit" size="lg" className="shrink-0 px-7">
                Find a business <ArrowRight />
              </Button>
            </form>
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted-foreground">
              <span className="font-bold text-foreground">Start with:</span>
              {categories.slice(0, 4).map((category) => (
                <Link
                  key={category.slug}
                  to="/category/$slug"
                  params={{ slug: category.slug }}
                  className="underline decoration-border underline-offset-4 hover:text-primary"
                >
                  {category.name}
                </Link>
              ))}
            </div>
            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-5 border-t border-foreground/10 pt-6">
              <div>
                <dt className="font-display text-2xl font-extrabold">{categories.length}</dt>
                <dd className="mt-1 text-xs leading-4 text-muted-foreground">Launch categories</dd>
              </div>
              <div>
                <dt className="font-display text-2xl font-extrabold">{locations.length}</dt>
                <dd className="mt-1 text-xs leading-4 text-muted-foreground">Initial city hubs</dd>
              </div>
              <div>
                <dt className="font-display text-2xl font-extrabold">Review</dt>
                <dd className="mt-1 text-xs leading-4 text-muted-foreground">
                  Required before publication
                </dd>
              </div>
            </dl>
          </div>
          <div className="reveal-up reveal-up-delay-2 lg:pl-3">
            <SignalMap />
          </div>
        </div>
        <a
          href="#how-it-works"
          className="absolute bottom-5 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs font-bold text-muted-foreground xl:flex"
        >
          Follow the route <ArrowDown className="size-3.5" />
        </a>
      </section>

      <div className="overflow-hidden border-b bg-ink py-3 text-ink-foreground" aria-hidden="true">
        <div className="ticker-track">
          {[...categories, ...categories].map((category, index) => (
            <span
              key={`${category.slug}-${index}`}
              className="flex items-center gap-5 px-5 text-xs font-bold uppercase tracking-[0.13em]"
            >
              {category.name} <span className="size-1.5 rounded-full bg-sidebar-primary" />
            </span>
          ))}
        </div>
      </div>

      <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="lg:sticky lg:top-36 lg:self-start">
            <p className="eyebrow text-primary">A shorter distance to yes</p>
            <h2 className="mt-4 text-4xl font-extrabold leading-[0.98] sm:text-5xl">
              Local search should lead somewhere.
            </h2>
            <p className="mt-5 max-w-md leading-7 text-muted-foreground">
              GainHub keeps discovery practical: enough information to decide, enough context to ask
              a useful question, and a direct route to the business.
            </p>
          </div>
          <ol className="divide-y border-y">
            {process.map((item) => (
              <li
                key={item.number}
                className="group grid gap-5 py-8 sm:grid-cols-[4rem_1fr] sm:py-10"
              >
                <span className="font-display text-2xl font-extrabold text-primary/45 transition-colors group-hover:text-primary">
                  {item.number}
                </span>
                <div className="grid gap-4 sm:grid-cols-[1fr_1.3fr] sm:items-start">
                  <h3 className="flex items-center gap-3 text-2xl font-bold">
                    <item.icon className="size-5 text-primary" /> {item.title}
                  </h3>
                  <p className="leading-7 text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-y bg-muted/55">
        <PreviewNotice>
          The profiles below are product previews—not live endorsements. Production publishes only
          reviewed business submissions.
        </PreviewNotice>
        <div className="mx-auto max-w-7xl px-5 py-20">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-primary">Profile preview</p>
              <h2 className="mt-4 text-4xl font-extrabold">See what useful looks like.</h2>
              <p className="mt-3 max-w-2xl text-muted-foreground">
                Clear services, location, contact options and verification language—without mystery
                metrics.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/search">
                Explore the directory <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {businesses.slice(0, 6).map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-20 md:py-28">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="network-stage flex min-h-72 flex-col justify-between rounded-[1.75rem] p-7 text-ink-foreground lg:row-span-2 lg:min-h-full">
            <div>
              <p className="eyebrow text-sidebar-primary">For business owners</p>
              <h2 className="mt-4 text-4xl font-extrabold leading-[0.96]">
                Give every enquiry a clear home.
              </h2>
            </div>
            <div>
              <p className="max-w-sm text-sm leading-6 text-ink-foreground/65">
                A complete profile is only the start. The owner workspace keeps authorised listings
                and their latest enquiries together—without invented reach or revenue.
              </p>
              <Button asChild variant="secondary" className="mt-6">
                <Link to="/join">Build your free profile</Link>
              </Button>
            </div>
          </div>
          {businessTools.map((tool, index) => (
            <article
              key={tool.title}
              className={`card-surface group min-h-64 p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-lift ${
                index === 2 ? "lg:col-span-2" : ""
              }`}
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
                <tool.icon className="size-5" />
              </span>
              <h3 className="mt-8 text-2xl font-bold">{tool.title}</h3>
              <p className="mt-3 max-w-lg leading-7 text-muted-foreground">{tool.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-8">
        <div className="paper-grid relative overflow-hidden rounded-[2rem] bg-accent p-8 text-accent-foreground md:p-14">
          <div
            className="absolute -right-20 -top-28 size-80 rounded-full border border-accent-foreground/15"
            aria-hidden="true"
          />
          <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="eyebrow">Ready when your customers are</p>
              <h2 className="mt-4 max-w-3xl text-4xl font-extrabold leading-[0.95] md:text-6xl">
                Put your business on a route people can trust.
              </h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" className="bg-ink text-ink-foreground hover:bg-ink/90">
                <Link to="/join">
                  List free <ArrowRight />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-accent-foreground/25 bg-transparent"
              >
                <Link to="/pricing">See business access</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
