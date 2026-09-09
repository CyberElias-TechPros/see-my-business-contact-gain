import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MessageCircle, QrCode, Search, ShieldCheck, Users, Zap } from "lucide-react";
import { PublicShell } from "@/components/site/PublicShell";
import { BusinessCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  directoryQuery,
  roomsQuery,
  taxonomyQuery,
  toCardBusiness,
  type Taxonomy,
} from "@/lib/queries.ts";
import type { RoomTile } from "@/lib/queries.ts";
import type { DirectoryResponse } from "../../shared/api.ts";

/**
 * The homepage reads the same endpoints as `/search`, so the numbers below can never disagree
 * with the listing pages, and none of them is typed into this file.
 */
type LoaderData = {
  taxonomy: Taxonomy;
  featured: DirectoryResponse;
  newest: DirectoryResponse;
  rooms: { items: RoomTile[]; total: number };
};

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GainHub NG — WhatsApp Contact Gain & Nigerian Business Directory" },
      {
        name: "description",
        content:
          "Find verified Nigerian businesses, chat on WhatsApp instantly, and grow your contacts with tracked links, QR codes and a built-in workspace.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "GainHub NG" },
      { property: "og:title", content: "GainHub NG — WhatsApp Contact Gain & Business Directory" },
      {
        property: "og:description",
        content:
          "Nigeria's WhatsApp-first business directory and contact-gain network. Get found, get saved, get customers.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index,follow,max-snippet:-1,max-image-preview:large" },
    ],
    links: [{ rel: "canonical", href: "/" }],
    scripts: [
      {
        type: "application/ld+json" as const,
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "GainHub NG",
          url: "https://gainhub.ng/",
          // Tells Google it may render a sitelinks search box that jumps straight to /search.
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: "https://gainhub.ng/search?q={search_term_string}",
            },
            "query-input": "required name=search_term_string",
          },
        }),
      },
    ],
  }),
  loader: async ({ context }): Promise<LoaderData> => {
    const [taxonomy, featured, newest, rooms] = await Promise.all([
      context.queryClient.ensureQueryData(taxonomyQuery()),
      context.queryClient.ensureQueryData(directoryQuery({ sort: "rating", perPage: 8 })),
      context.queryClient.ensureQueryData(directoryQuery({ sort: "newest", perPage: 4 })),
      context.queryClient.ensureQueryData(roomsQuery()),
    ]);
    return { taxonomy, featured, newest, rooms };
  },
  component: Home,
});

const pillars = [
  {
    icon: Search,
    title: "Public discovery",
    body: "Listing, category and location pages with real opening hours, ratings and a canonical URL each.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp-first contact",
    body: "One tap opens a chat. Every conversation is attributed to the exact listing or campaign.",
  },
  {
    icon: Users,
    title: "Contact-gain rooms",
    body: "Moderated save-back circles with published rules, so vendors grow status reach in the open.",
  },
  {
    icon: Zap,
    title: "A workspace, not a spreadsheet",
    body: "Leads, follow-up reminders, tracked links and QR codes for the shop counter.",
  },
  {
    icon: QrCode,
    title: "Tracked links & QR",
    body: "Print a QR for your shop, put a link in your bio, and see which one brings customers.",
  },
  {
    icon: ShieldCheck,
    title: "Trust & safety",
    body: "Verification levels, risk-scored reports, review replies that stay on the record.",
  },
];

function Home() {
  const { taxonomy, featured, newest, rooms } = Route.useLoaderData();

  const citiesWithListings = taxonomy.locations.filter((location) => location.count > 0).length;
  const busyCategories = taxonomy.categories.filter((category) => category.count > 0).length;
  const stats: [string, string][] = [
    [featured.meta.total.toLocaleString("en-NG"), "Published listings"],
    [String(busyCategories), "Categories with stock"],
    [String(citiesWithListings), "Cities covered"],
  ];

  return (
    <PublicShell>
      <section className="border-b bg-hero-mesh">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <div>
            <Badge variant="secondary" className="mb-5">
              Nigeria-first • WhatsApp-first
            </Badge>
            <h1 className="text-4xl font-bold leading-[1.05] md:text-6xl">
              Get found. Get saved. <span className="text-gradient-brand">Get customers.</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-muted-foreground">
              A business directory and WhatsApp contact-gain network built for how Nigerians
              actually buy — search, check the photos, then chat.
            </p>
            {/* A real GET form: it works before JavaScript loads, on a 2G connection, and in a
                browser that blocks scripts — and it is exactly what /search parses. */}
            <form action="/search" method="get" className="mt-8 flex flex-col gap-3 sm:flex-row">
              <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card p-2 shadow-soft focus-within:ring-2 focus-within:ring-ring">
                <Search className="ml-2 size-4 text-muted-foreground" aria-hidden="true" />
                <Input
                  name="q"
                  placeholder="Phone repair in Ikeja…"
                  className="border-0 shadow-none focus-visible:ring-0"
                  aria-label="Search businesses by trade, area or city"
                />
                <Button type="submit">Search</Button>
              </div>
            </form>
            <nav aria-label="Popular categories" className="mt-5 flex flex-wrap gap-2">
              {taxonomy.categories
                .filter((category) => category.count > 0)
                .slice(0, 5)
                .map((category) => (
                  <Link key={category.slug} to="/category/$slug" params={{ slug: category.slug }}>
                    <Badge variant="outline" className="bg-card">
                      {category.name}
                    </Badge>
                  </Link>
                ))}
            </nav>
            <dl className="mt-10 grid max-w-md grid-cols-3 gap-4">
              {stats.map(([value, label]) => (
                <div key={label}>
                  <dt className="font-display text-2xl font-bold">{value}</dt>
                  <dd className="text-xs text-muted-foreground">{label}</dd>
                </div>
              ))}
            </dl>
          </div>

          <Card className="card-surface self-center">
            <CardContent className="space-y-4 p-6">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Newest listings</p>
                <Link
                  to="/search"
                  search={{ sort: "newest" }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  See all
                </Link>
              </div>
              {newest.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No published listings yet — the first one takes about six minutes to write.
                </p>
              ) : (
                newest.items.map((item) => (
                  <Link
                    key={item.id}
                    to="/business/$id"
                    params={{ id: item.slug }}
                    className="flex items-start gap-3 rounded-xl border bg-background p-3 transition-shadow hover:shadow-lift"
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg text-white ${toCardBusiness(item).cover}`}
                      aria-hidden="true"
                    >
                      <MessageCircle className="size-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{item.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {item.tagline}
                      </span>
                    </span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                      {item.area ?? item.city}
                    </span>
                  </Link>
                ))
              )}
              <Button asChild variant="outline" className="w-full">
                <Link to="/app">Open business workspace</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-2xl font-bold md:text-3xl">Two connected worlds, one platform</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          A public discovery network for customers, and a private workspace where every business
          manages the contacts it gains.
        </p>
        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pillars.map((pillar) => (
            <Card key={pillar.title} className="card-surface">
              <CardContent className="p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <pillar.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{pillar.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{pillar.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold md:text-3xl">Top-rated right now</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Ranked on the rating customers actually left — the review count is printed on every
              card, so a 5.0 from one review never outranks a 4.7 from forty.
            </p>
          </div>
          <Button asChild variant="ghost" className="gap-1">
            <Link to="/search" search={{ sort: "rating" }}>
              See all <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featured.items.map((item) => (
            <BusinessCard key={item.id} business={toCardBusiness(item)} />
          ))}
        </div>
      </section>

      <section className="border-y bg-muted/50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold md:text-3xl">Contact-gain rooms</h2>
              <p className="mt-2 max-w-2xl text-muted-foreground">
                Moderated save-back circles with published rules, slot limits and verified-only
                options.{" "}
                {rooms.total === 0 ? "None are open yet — start one." : `${rooms.total} open now.`}
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/contact-gain">Browse rooms</Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {rooms.items.slice(0, 4).map((room) => (
              <Card key={room.id} className="card-surface">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{room.name}</h3>
                    {room.verifiedOnly ? <Badge variant="secondary">Verified only</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{room.purpose.replace(/-/g, " ")}</p>
                  <p className="text-xs text-muted-foreground">Rule: {room.houseRule}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span>
                      {room.memberCount.toLocaleString("en-NG")} of{" "}
                      {room.capacity.toLocaleString("en-NG")} members
                    </span>
                    <span className={room.slotsLeft > 0 ? "text-primary" : "text-muted-foreground"}>
                      {room.slotsLeft > 0 ? `${room.slotsLeft} slots left` : "Full"}
                    </span>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to="/contact-gain/$id" params={{ id: room.slug }}>
                      View room
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="text-2xl font-bold md:text-3xl">Browse by location</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {taxonomy.locations.map((location) => (
            <Link
              key={location.id}
              to="/locations/$slug"
              params={{ slug: location.slug }}
              className="card-surface flex items-center justify-between gap-3 p-5 transition-shadow hover:shadow-lift"
            >
              <div className="min-w-0">
                <p className="font-semibold">{location.name}</p>
                <p className="truncate text-sm text-muted-foreground">
                  {location.areas.slice(0, 3).join(" • ")}
                </p>
              </div>
              <span
                className="shrink-0 text-sm text-primary"
                title={`${location.count} published listings`}
              >
                {location.count.toLocaleString("en-NG")}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20">
        <div className="overflow-hidden rounded-3xl bg-ink-mesh p-10 text-ink-foreground md:p-14">
          <h2 className="max-w-2xl text-3xl font-bold md:text-4xl">
            Ready to turn WhatsApp chats into a real customer list?
          </h2>
          <p className="mt-4 max-w-xl text-ink-foreground/75">
            Create your profile in minutes, publish your services and products, and let every
            enquiry land in one inbox.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/join">List your business free</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-white/25 bg-white/5">
              <Link to="/pricing">Compare plans</Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicShell>
  );
}
