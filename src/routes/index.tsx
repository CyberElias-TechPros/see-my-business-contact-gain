import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Inbox,
  Layers,
  MessageCircle,
  Radio,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  CountUp,
  Magnetic,
  Marquee,
  Parallax,
  Reveal,
  Spotlight,
  TextReveal,
} from "@/components/motion";
import { BusinessCard, EmptyState } from "@/components/kit";
import { PreviewNotice, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { directoryQuerySchema } from "@/lib/contracts";
import { getDirectoryResults, getDirectoryTaxonomy } from "@/lib/directory.functions";

export const Route = createFileRoute("/")({
  loader: async () => {
    const [featured, taxonomy] = await Promise.all([
      getDirectoryResults({
        data: {
          ...directoryQuerySchema.parse({}),
          sort: "relevance",
          page: 1,
          pageSize: 6,
        },
      }),
      getDirectoryTaxonomy(),
    ]);
    return { featured, taxonomy };
  },
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

/* -------------------------------------------------------------------------- */
/* Content                                                                    */
/* -------------------------------------------------------------------------- */

const process = [
  {
    number: "01",
    icon: Search,
    title: "Search with intent",
    body: "Start with the job, product or service — not a maze of categories. Add your city when it matters, then filter by what actually changes your decision.",
  },
  {
    number: "02",
    icon: ShieldCheck,
    title: "Read the signals",
    body: "See location, opening hours, services, price range and a plainly explained verification state. Reviews you can open and read, not an unexplained score.",
  },
  {
    number: "03",
    icon: MessageCircle,
    title: "Start the conversation",
    body: "Move into WhatsApp with context intact, or send a structured enquiry the business sees in its workspace and can act on.",
  },
];

const ownerTools = [
  {
    icon: Store,
    title: "One profile, real details",
    body: "Publish the services, hours, areas and contact routes a customer needs before deciding to reach out — and edit them whenever they change.",
  },
  {
    icon: Inbox,
    title: "Every enquiry in one place",
    body: "Consented enquiries land in your workspace attached to the listing, with a status you control from first contact to closed.",
  },
  {
    icon: Radio,
    title: "See what you actually gained",
    body: "Contacts gained are counted per listing and per channel, so you can tell which profile is producing conversations — without invented reach numbers.",
  },
];

/* -------------------------------------------------------------------------- */
/* Hero constellation                                                         */
/* -------------------------------------------------------------------------- */

/** Deterministic node positions — identical on server and client, so no hydration shift. */
const NODES: Array<{ x: number; y: number; r: number; delay: number }> = [
  { x: 92, y: 300, r: 9, delay: 0 },
  { x: 210, y: 188, r: 6, delay: 0.4 },
  { x: 318, y: 262, r: 12, delay: 0.8 },
  { x: 246, y: 372, r: 5, delay: 1.2 },
  { x: 404, y: 150, r: 7, delay: 1.6 },
  { x: 468, y: 286, r: 10, delay: 2.0 },
  { x: 366, y: 396, r: 6, delay: 2.4 },
  { x: 520, y: 200, r: 5, delay: 2.8 },
];

const EDGES: Array<[number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [1, 4],
  [4, 5],
  [5, 2],
  [2, 6],
  [4, 7],
  [7, 5],
];

function Constellation() {
  return (
    <div className="network-stage grain vignette relative aspect-[6/5] w-full overflow-hidden rounded-[2rem] shadow-lift">
      <div className="aurora opacity-70" aria-hidden="true" />

      <svg
        viewBox="0 0 580 460"
        role="img"
        aria-label="Illustration of customers connecting with local businesses across a Nigerian city"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="home-route" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7ce49a" />
            <stop offset="100%" stopColor="#f7bd51" />
          </linearGradient>
          <filter id="home-glow">
            <feGaussianBlur stdDeviation="3.4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {EDGES.map(([from, to], index) => {
          const a = NODES[from]!;
          const b = NODES[to]!;
          return (
            <line
              key={`${from}-${to}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke="url(#home-route)"
              strokeWidth={index % 3 === 0 ? 2 : 1.1}
              strokeOpacity={index % 3 === 0 ? 0.55 : 0.24}
              filter={index % 3 === 0 ? "url(#home-glow)" : undefined}
            >
              <animate
                attributeName="stroke-opacity"
                values={index % 3 === 0 ? "0.15;0.62;0.15" : "0.08;0.3;0.08"}
                dur={`${5 + (index % 4)}s`}
                begin={`${index * 0.35}s`}
                repeatCount="indefinite"
              />
            </line>
          );
        })}

        {NODES.map((node, index) => (
          <g key={`${node.x}-${node.y}`}>
            <circle cx={node.x} cy={node.y} r={node.r + 14} fill="#7ce49a" fillOpacity="0.06" />
            <circle
              cx={node.x}
              cy={node.y}
              r={node.r}
              fill={index === 2 ? "#f7bd51" : "#7ce49a"}
              stroke="#0d2b20"
              strokeWidth="3"
            >
              <animate
                attributeName="r"
                values={`${node.r};${node.r + 2.2};${node.r}`}
                dur="4s"
                begin={`${node.delay}s`}
                repeatCount="indefinite"
              />
            </circle>
          </g>
        ))}
      </svg>

      {/* Floating proof card — reinforces the product promise inside the artwork. */}
      <div className="absolute bottom-6 left-6 right-6 rounded-2xl border border-white/12 bg-white/8 p-4 backdrop-blur-md sm:right-auto sm:w-[20rem]">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <MessageCircle className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-ink-foreground">Search became a conversation</p>
            <p className="mt-1 text-xs leading-5 text-ink-foreground/62">
              Service detail, location and hours travel with the customer, so the first message
              starts with context.
            </p>
          </div>
        </div>
      </div>

      <span className="signal-ring left-[24%] top-[34%] size-44" aria-hidden="true" />
      <span
        className="signal-ring left-[24%] top-[34%] size-44 [animation-delay:1.6s]"
        aria-hidden="true"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero search                                                                */
/* -------------------------------------------------------------------------- */

function HeroSearch() {
  const [value, setValue] = useState("");

  return (
    <form
      action="/search"
      method="get"
      role="search"
      className="group relative mt-9 flex max-w-2xl flex-col gap-2 rounded-2xl border border-border/70 bg-card/85 p-2.5 shadow-lift backdrop-blur-xl transition-[box-shadow,border-color] duration-500 focus-within:border-primary/45 focus-within:shadow-glow sm:flex-row"
    >
      <label className="flex min-h-12 flex-1 items-center gap-3 px-3">
        <Search
          className="size-5 shrink-0 text-primary transition-transform duration-500 group-focus-within:scale-110"
          aria-hidden="true"
        />
        <span className="sr-only">What are you looking for?</span>
        <input
          name="q"
          type="search"
          autoComplete="off"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder='Try "phone repair in Ikeja"'
          className="h-12 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/60"
        />
      </label>
      <Magnetic strength={0.18}>
        <Button type="submit" size="lg" className="shrink-0 px-7">
          Find a business <ArrowRight />
        </Button>
      </Magnetic>
    </form>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

function Home() {
  const { featured, taxonomy } = Route.useLoaderData();
  const { items: businesses, pagination } = featured.result;
  const { categories, locations } = taxonomy.taxonomy;
  const totalPublished = pagination.total;
  const totalReviews = businesses.reduce((sum, item) => sum + item.reviewCount, 0);

  return (
    <PublicShell>
      {/* ================= HERO ================= */}
      <section className="grain relative overflow-hidden bg-ink text-ink-foreground">
        <div className="aurora" aria-hidden="true" />
        <div
          className="absolute -left-40 top-24 size-[34rem] rounded-full border border-white/8"
          aria-hidden="true"
        />
        <div
          className="absolute -right-32 -top-28 size-[26rem] rounded-full border border-sidebar-primary/16"
          aria-hidden="true"
        />

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 lg:grid-cols-[1.06fr_0.94fr] lg:gap-10 lg:pb-28 lg:pt-24">
          <div>
            <div style={{ animation: "reveal-up 700ms var(--ease-out-expo) both" }}>
              <Badge
                variant="secondary"
                className="gap-2 border border-white/12 bg-white/8 px-3 py-1.5 text-ink-foreground backdrop-blur"
              >
                <Sparkles className="size-3.5 text-sidebar-primary" />
                Local discovery, rebuilt around conversation
              </Badge>
            </div>

            <h1 className="display-xl mt-7 text-ink-foreground">
              <TextReveal>Find better.</TextReveal>
              <br />
              <TextReveal delay={180}>
                <span className="bg-gradient-to-r from-[#7ce49a] via-[#a8e86a] to-[#f7bd51] bg-clip-text text-transparent">
                  Talk sooner.
                </span>
              </TextReveal>
            </h1>

            <p
              className="mt-7 max-w-xl text-lg leading-8 text-ink-foreground/68"
              style={{ animation: "reveal-up 800ms var(--ease-out-expo) 420ms both" }}
            >
              Search for what you need, see the signals that matter, then reach the right Nigerian
              business without the usual runaround.
            </p>

            <div style={{ animation: "reveal-up 800ms var(--ease-out-expo) 520ms both" }}>
              <HeroSearch />

              <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-foreground/55">
                <span className="font-bold text-ink-foreground/85">Start with:</span>
                {categories.slice(0, 4).map((category) => (
                  <Link
                    key={category.slug}
                    to="/category/$slug"
                    params={{ slug: category.slug }}
                    className="link-underline transition-colors hover:text-sidebar-primary"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Live counters. Every number is derived from published data — never a
                decorative figure invented for the layout. */}
            <dl
              className="mt-11 grid max-w-xl grid-cols-3 gap-5 border-t border-white/10 pt-7"
              style={{ animation: "reveal-up 800ms var(--ease-out-expo) 640ms both" }}
            >
              <div>
                <dt className="sr-only">Published businesses</dt>
                <dd>
                  <span className="block font-display text-3xl font-extrabold text-ink-foreground">
                    <CountUp value={totalPublished} />
                  </span>
                  <span className="mt-1 block text-xs leading-4 text-ink-foreground/50">
                    Published listings
                  </span>
                </dd>
              </div>
              <div>
                <dt className="sr-only">City hubs</dt>
                <dd>
                  <span className="block font-display text-3xl font-extrabold text-ink-foreground">
                    <CountUp value={locations.length} />
                  </span>
                  <span className="mt-1 block text-xs leading-4 text-ink-foreground/50">
                    City hubs
                  </span>
                </dd>
              </div>
              <div>
                <dt className="sr-only">Reviews published</dt>
                <dd>
                  <span className="block font-display text-3xl font-extrabold text-ink-foreground">
                    <CountUp value={totalReviews} />
                  </span>
                  <span className="mt-1 block text-xs leading-4 text-ink-foreground/50">
                    Reviews visible
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div style={{ animation: "reveal-up 1000ms var(--ease-out-expo) 260ms both" }}>
            <Parallax distance={26}>
              <Constellation />
            </Parallax>
          </div>
        </div>

        <a
          href="#how-it-works"
          className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 items-center gap-2 text-xs font-bold text-ink-foreground/45 transition-colors hover:text-sidebar-primary xl:flex"
        >
          Follow the route <ArrowDown className="size-3.5" />
        </a>
      </section>

      {/* ================= CATEGORY RAIL ================= */}
      {categories.length ? (
        <Marquee speed={48} className="border-y border-border/60 bg-muted/40 py-3.5">
          {categories.map((category) => (
            <span
              key={category.slug}
              className="flex items-center gap-5 px-5 text-xs font-bold uppercase tracking-[0.13em] text-muted-foreground"
            >
              {category.name}
              <span className="size-1.5 rounded-full bg-primary/60" aria-hidden="true" />
            </span>
          ))}
        </Marquee>
      ) : null}

      {/* ================= HOW IT WORKS ================= */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr]">
          <div className="lg:sticky lg:top-32 lg:self-start">
            <Reveal>
              <p className="eyebrow text-primary">A shorter distance to yes</p>
              <h2 className="display-lg mt-4">Local search should lead somewhere.</h2>
              <p className="mt-5 max-w-md leading-7 text-muted-foreground">
                GainHub keeps discovery practical: enough information to decide, enough context to
                ask a useful question, and a direct route to the business.
              </p>
            </Reveal>
          </div>

          <ol className="divide-y border-y border-border/60">
            {process.map((item, index) => (
              <Reveal as="li" key={item.number} delay={index + 1} className="group">
                <div className="grid gap-5 py-9 sm:grid-cols-[4.5rem_1fr] sm:py-11">
                  <span className="font-display text-3xl font-extrabold text-primary/35 transition-colors duration-500 group-hover:text-primary">
                    {item.number}
                  </span>
                  <div className="grid gap-4 sm:grid-cols-[1fr_1.35fr] sm:items-start">
                    <h3 className="flex items-center gap-3 text-2xl font-bold">
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                        <item.icon className="size-5" aria-hidden="true" />
                      </span>
                      {item.title}
                    </h3>
                    <p className="leading-7 text-muted-foreground">{item.body}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= LIVE DIRECTORY ================= */}
      <section className="border-y border-border/60 bg-muted/45">
        <PreviewNotice>
          Every profile below is a reviewed, published listing served live from the directory. No
          paid placement changes the order.
        </PreviewNotice>

        <div className="mx-auto max-w-7xl px-5 py-20">
          <Reveal>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow text-primary">Live directory</p>
                <h2 className="display-lg mt-4">See what useful looks like.</h2>
                <p className="mt-3 max-w-2xl text-muted-foreground">
                  Clear services, opening hours, location, contact options and verification language
                  — without mystery metrics.
                </p>
              </div>
              <Magnetic>
                <Button asChild variant="outline" size="lg">
                  <Link to="/search">
                    Explore the directory <ArrowRight />
                  </Link>
                </Button>
              </Magnetic>
            </div>
          </Reveal>

          <div className="mt-11">
            {!featured.available ? (
              <EmptyState
                icon={<Store className="size-7" />}
                title="The live directory is temporarily unavailable"
                body="No preview records are substituted for live listings. Please try again shortly."
                action={
                  <Button asChild variant="outline">
                    <Link to="/search">Try the search page</Link>
                  </Button>
                }
              />
            ) : businesses.length ? (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {businesses.map((business, index) => (
                  <Reveal key={business.id} delay={index % 3} className="h-full">
                    <BusinessCard business={business} />
                  </Reveal>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={<Store className="size-7" />}
                title="The directory is opening"
                body="Published listings appear here the moment they pass review. Suggest a business your area needs, or list your own — it is free."
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button asChild>
                      <Link to="/join">List your business</Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/suggest-business">Suggest a business</Link>
                    </Button>
                  </div>
                }
              />
            )}
          </div>
        </div>
      </section>

      {/* ================= OWNER VALUE ================= */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <div className="aurora opacity-45" aria-hidden="true" />
        <div className="relative mx-auto max-w-7xl px-5 py-20 md:py-28">
          <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
            <Reveal className="lg:sticky lg:top-32">
              <p className="eyebrow text-sidebar-primary">For business owners</p>
              <h2 className="display-lg mt-4">Give every enquiry a clear home.</h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-ink-foreground/65">
                A complete profile is only the start. The owner workspace keeps authorised listings,
                their enquiries and the contacts they gained together — without invented reach or
                revenue.
              </p>
              <Magnetic>
                <Button asChild variant="secondary" size="lg" className="mt-7">
                  <Link to="/join">Build your free profile</Link>
                </Button>
              </Magnetic>
            </Reveal>

            <ol className="grid gap-4">
              {ownerTools.map((tool, index) => (
                <Reveal as="li" key={tool.title} delay={index + 1}>
                  <Spotlight color="var(--color-sidebar-primary)" className="h-full rounded-3xl">
                    <div className="flex h-full gap-5 rounded-3xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-sm transition-colors duration-500 hover:border-sidebar-primary/35 sm:p-7">
                      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-sidebar-primary/15 text-sidebar-primary">
                        <tool.icon className="size-5" aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="text-xl font-bold">{tool.title}</h3>
                        <p className="mt-2 max-w-lg text-sm leading-6 text-ink-foreground/62">
                          {tool.body}
                        </p>
                      </div>
                    </div>
                  </Spotlight>
                </Reveal>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* ================= CIRCLES + TRUST ================= */}
      <section className="mx-auto max-w-7xl px-5 py-20 md:py-28">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Reveal>
            <div className="grain relative h-full overflow-hidden rounded-[2rem] bg-primary p-8 text-primary-foreground md:p-12">
              <div
                className="absolute -right-24 -top-24 size-72 rounded-full border border-white/15"
                aria-hidden="true"
              />
              <div className="relative">
                <p className="eyebrow text-primary-foreground/70">Opt-in contact circles</p>
                <h2 className="display-md mt-4 max-w-lg">
                  Shared contact lists, with consent built in.
                </h2>
                <p className="mt-4 max-w-md text-sm leading-7 text-primary-foreground/80">
                  Join a circle to be discoverable to its members, or propose one for your trade.
                  Every member opts in, sees the rules first, and can leave at any time.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="bg-background text-foreground hover:bg-background/90"
                  >
                    <Link to="/contact-gain">
                      Browse circles <ArrowRight />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
                  >
                    <Link to="/contact-gain/create">Propose a circle</Link>
                  </Button>
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal delay={2}>
            <div className="flex h-full flex-col justify-between rounded-[2rem] border border-border/70 bg-card p-8 md:p-12">
              <div>
                <span className="grid size-12 place-items-center rounded-2xl bg-secondary text-primary">
                  <BadgeCheck className="size-6" aria-hidden="true" />
                </span>
                <h2 className="display-md mt-6">Verification, described honestly.</h2>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                  A verification label records what our review team checked. It is not a warranty,
                  not a ranking purchase, and not a promise about how a business will treat you.
                </p>
              </div>
              <ul className="mt-7 space-y-3 text-sm">
                {[
                  ["Email checked", "We confirmed control of the listed address."],
                  ["Phone checked", "We confirmed control of the listed number."],
                  ["Documents checked", "Ownership documents were reviewed by a person."],
                ].map(([label, detail]) => (
                  <li key={label} className="flex gap-3">
                    <Layers className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span>
                      <strong className="font-semibold">{label}</strong> — {detail}
                    </span>
                  </li>
                ))}
              </ul>
              <Button asChild variant="ghost" className="mt-7 self-start px-0">
                <Link to="/trust-safety">
                  How trust and safety works <ArrowUpRight />
                </Link>
              </Button>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ================= CLOSING CTA ================= */}
      <section className="mx-auto max-w-7xl px-5 pb-8">
        <Reveal direction="scale">
          <div className="paper-grid relative overflow-hidden rounded-[2rem] bg-accent p-8 text-accent-foreground md:p-14">
            <div
              className="absolute -right-20 -top-28 size-80 rounded-full border border-accent-foreground/15"
              aria-hidden="true"
            />
            <div className="relative grid gap-10 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="eyebrow">Ready when your customers are</p>
                <h2 className="display-lg mt-4 max-w-3xl">
                  Put your business on a route people can trust.
                </h2>
                <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
                  <span className="flex items-center gap-2">
                    <Users className="size-4" aria-hidden="true" /> Free to list
                  </span>
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="size-4" aria-hidden="true" /> Reviewed before publishing
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Magnetic>
                  <Button
                    asChild
                    size="lg"
                    className="bg-ink px-8 text-ink-foreground hover:bg-ink/90"
                  >
                    <Link to="/join">
                      List free <ArrowRight />
                    </Link>
                  </Button>
                </Magnetic>
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
        </Reveal>
      </section>
    </PublicShell>
  );
}
