import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, MessageCircle, QrCode, Search, ShieldCheck, Users, Zap } from "lucide-react";
import { PublicShell } from "@/components/site/PublicShell";
import { BusinessCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useBusinesses, useMeta, useRooms } from "@/lib/queries";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GainHub NG — WhatsApp Contact Gain & Nigerian Business Directory" },
      {
        name: "description",
        content:
          "Find verified Nigerian businesses, chat on WhatsApp instantly, and grow your contacts with tracked links, QR codes and a built-in CRM.",
      },
      { property: "og:title", content: "GainHub NG — WhatsApp Contact Gain & Business Directory" },
      {
        property: "og:description",
        content:
          "Nigeria's WhatsApp-first business directory and contact-gain network. Get found, get saved, get customers.",
      },
    ],
  }),
  component: Home,
});

const pillars = [
  {
    icon: Search,
    title: "Public discovery",
    body: "SEO-friendly profiles, category and location landing pages, near-me search and map view.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp-first contact",
    body: "One tap opens a chat. Every conversation is attributed to the exact listing or campaign.",
  },
  {
    icon: Users,
    title: "Contact-gain rooms",
    body: "Moderated save-back circles so vendors grow status reach without dropping numbers in random groups.",
  },
  {
    icon: Zap,
    title: "Automation engine",
    body: "Auto-tag, auto-assign, follow-up reminders and stale-lead detection out of the box.",
  },
  {
    icon: QrCode,
    title: "Tracked links & QR",
    body: "Print a QR for your shop, put a link in your bio, and see which one brings customers.",
  },
  {
    icon: ShieldCheck,
    title: "Trust & safety",
    body: "Verification levels, AI pre-screening, report flows and NDPR-aligned data handling.",
  },
];

function Home() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const { data: meta } = useMeta();
  const featured = useBusinesses({ sort: "relevance", pageSize: 8 });
  const rooms = useRooms({});
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
            <form
              className="mt-8 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void navigate({ to: "/search", search: query ? { q: query } : {} });
              }}
            >
              <div className="flex flex-1 items-center gap-2 rounded-xl border bg-card p-2 shadow-soft">
                <Search className="ml-2 size-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Phone repair in Ikeja…"
                  className="border-0 shadow-none focus-visible:ring-0"
                  aria-label="Search businesses"
                />
                <Button type="submit">Search</Button>
              </div>
            </form>
            <div className="mt-5 flex flex-wrap gap-2">
              {(meta?.categories ?? []).slice(0, 5).map((c) => (
                <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }}>
                  <Badge variant="outline" className="bg-card">
                    {c.name}
                  </Badge>
                </Link>
              ))}
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-4 max-w-md">
              {[
                [(meta?.stats.businesses ?? 58400).toLocaleString(), "Listed businesses"],
                [meta?.stats.chats ?? "1.2M", "WhatsApp chats started"],
                [String(meta?.stats.states ?? 36), "States covered"],
              ].map(([v, l]) => (
                <div key={l}>
                  <dt className="font-display text-2xl font-bold">{v}</dt>
                  <dd className="text-xs text-muted-foreground">{l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <Card className="card-surface self-center">
            <CardContent className="space-y-4 p-6">
              <p className="text-sm font-semibold">Live lead feed (demo)</p>
              {[
                ["SwiftFix Gadgets", "New WhatsApp lead from Ikeja QR", "now"],
                ["Adire Atelier", "Quote requested — aso-oke set", "2m"],
                ["Rapid Dispatch NG", "Lead assigned to Amina B.", "5m"],
                ["Glow by Tola", "New 5★ review published", "9m"],
              ].map(([n, t, w]) => (
                <div key={t} className="flex items-start gap-3 rounded-xl border bg-background p-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <MessageCircle className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{n}</p>
                    <p className="truncate text-xs text-muted-foreground">{t}</p>
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">{w}</span>
                </div>
              ))}
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
          {pillars.map((p) => (
            <Card key={p.title} className="card-surface">
              <CardContent className="p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <p.icon className="size-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold">{p.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold md:text-3xl">Featured businesses</h2>
          <Button asChild variant="ghost" className="gap-1">
            <Link to="/search">
              See all <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(featured.data?.items ?? []).slice(0, 8).map((b) => (
            <BusinessCard key={b.id} business={b} />
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
                options.
              </p>
            </div>
            <Button asChild variant="outline">
              <Link to="/contact-gain">Browse rooms</Link>
            </Button>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {(rooms.data ?? []).map((r) => (
              <Card key={r.id} className="card-surface">
                <CardContent className="space-y-3 p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{r.name}</h3>
                    {r.verifiedOnly ? <Badge variant="secondary">Verified only</Badge> : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.purpose}</p>
                  <p className="text-xs text-muted-foreground">Rule: {r.rule}</p>
                  <div className="flex items-center justify-between text-xs">
                    <span>{r.members.toLocaleString()} members</span>
                    <span className="text-primary">{r.slotsLeft ?? 0} slots left</span>
                  </div>
                  <Button asChild size="sm" variant="outline" className="w-full">
                    <Link to="/contact-gain/$id" params={{ id: r.id }}>
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
          {(meta?.locations ?? []).map((l) => (
            <Link
              key={l.slug}
              to="/locations/$slug"
              params={{ slug: l.slug }}
              className="card-surface flex items-center justify-between p-5 transition-shadow hover:shadow-lift"
            >
              <div>
                <p className="font-semibold">{l.name}</p>
                <p className="text-sm text-muted-foreground">{l.areas.slice(0, 3).join(" • ")}</p>
              </div>
              <span className="text-sm text-primary">{l.count.toLocaleString()}</span>
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
