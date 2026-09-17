import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CircleUserRound, Search, ShieldCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Reveal } from "@/components/motion";
import { EmptyState } from "@/components/kit";
import { CtaBand, FeatureGrid } from "@/components/site/editorial";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/api";

type Room = {
  id: string;
  name: string;
  purpose: string;
  state: string;
  slotLimit: number;
  slotsLeft: number;
  rules: string;
  verifiedOnly: boolean;
  memberCount: number;
};

export const Route = createFileRoute("/contact-gain/")({
  head: () => ({
    meta: [
      { title: "Opt-in business contact circles — GainHub NG" },
      {
        name: "description",
        content:
          "Browse moderated, opt-in business contact circles with published rules, membership limits and explicit participation requirements.",
      },
    ],
  }),
  component: ContactGainPage,
});

const pillars = [
  {
    icon: CircleUserRound,
    title: "Explicit opt-in",
    text: "Every member applies with an authenticated account and accepts the published rules.",
  },
  {
    icon: ShieldCheck,
    title: "Private by default",
    text: "Public pages show capacity and policy—not member phone numbers or a downloadable contact list.",
  },
  {
    icon: UsersRound,
    title: "Capacity with purpose",
    text: "Limits keep each circle relevant and give moderation a manageable scope.",
  },
];

function ContactGainPage() {
  const [query, setQuery] = useState("");
  const rooms = useQuery({
    queryKey: ["contact-rooms"],
    queryFn: () => apiRequest<{ items: Room[] }>("/v1/rooms"),
    retry: false,
  });
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return rooms.data?.items ?? [];
    return (rooms.data?.items ?? []).filter((room) =>
      [room.name, room.purpose, room.state].some((value) => value.toLowerCase().includes(term)),
    );
  }, [query, rooms.data?.items]);

  return (
    <PublicShell>
      <PageHead
        eyebrow="Opt-in contact circles"
        title="Reach grows better with consent"
        subtitle="Business circles are moderated spaces for people who explicitly choose to exchange professional contacts. No scraped numbers, invisible member lists or forced save-backs."
        action={
          <Button asChild>
            <Link to="/contact-gain/create">Propose a circle</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-14 px-5 py-16">
        <FeatureGrid items={pillars} columns={3} />

        <section aria-labelledby="room-list-heading">
          <Reveal>
            <div className="flex flex-col gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow text-primary">Published circles</p>
                <h2 id="room-list-heading" className="display-md mt-3">
                  Find a relevant room
                </h2>
              </div>
              <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border/70 bg-card px-4 transition-colors focus-within:border-primary/45 sm:max-w-sm">
                <Search className="size-4 text-primary" aria-hidden="true" />
                <span className="sr-only">Filter contact circles</span>
                <Input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Name, purpose or state"
                  className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"
                />
              </label>
            </div>
          </Reveal>

          {rooms.isLoading ? (
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <div key={index} className="h-64 animate-pulse rounded-3xl bg-muted" />
              ))}
            </div>
          ) : rooms.isError ? (
            <div
              className="mt-7 rounded-3xl border border-destructive/25 bg-destructive/5 p-6 text-sm"
              role="alert"
            >
              <p className="font-bold">Live circles are unavailable right now.</p>
              <p className="mt-1 text-muted-foreground">
                No fictional room data has been substituted.
              </p>
            </div>
          ) : filtered.length ? (
            <div className="mt-7 grid gap-5 md:grid-cols-2">
              {filtered.map((room, index) => (
                <Reveal key={room.id} delay={index % 2} className="h-full">
                  <Card className="group h-full rounded-3xl border-border/70 transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-lift">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-2xl font-bold leading-tight">{room.name}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {room.purpose} · {room.state}
                          </p>
                        </div>
                        <Badge variant={room.verifiedOnly ? "default" : "secondary"}>
                          {room.verifiedOnly ? "Verified only" : "Open criteria"}
                        </Badge>
                      </div>

                      <dl className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-muted/60 p-4 text-center">
                        <div>
                          <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            Members
                          </dt>
                          <dd className="mt-1 font-display text-xl font-extrabold tabular-nums">
                            {room.memberCount}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            Open slots
                          </dt>
                          <dd className="mt-1 font-display text-xl font-extrabold tabular-nums">
                            {room.slotsLeft}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">
                            Capacity
                          </dt>
                          <dd className="mt-1 font-display text-xl font-extrabold tabular-nums">
                            {room.slotLimit}
                          </dd>
                        </div>
                      </dl>

                      <Button asChild className="mt-5 w-full" variant="outline">
                        <Link to="/contact-gain/$id" params={{ id: room.id }}>
                          Read rules <ArrowRight />
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<UsersRound className="size-7" />}
              title="No published circle matches"
              body="Clear the filter or propose a carefully scoped room for review."
              action={
                query ? (
                  <Button variant="outline" onClick={() => setQuery("")}>
                    Clear filter
                  </Button>
                ) : (
                  <Button asChild>
                    <Link to="/contact-gain/create">Propose a circle</Link>
                  </Button>
                )
              }
            />
          )}
        </section>

        <CtaBand
          eyebrow="Start one properly"
          title="Have a circle your trade actually needs?"
          body="Propose it with a stated purpose, published rules and a capacity you can moderate. Every proposal is reviewed before it appears here."
          primary={{ to: "/contact-gain/create", label: "Propose a circle" }}
        />
      </div>
    </PublicShell>
  );
}
