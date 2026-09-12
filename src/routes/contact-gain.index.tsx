import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CircleUserRound, Search, ShieldCheck, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
      <div className="mx-auto max-w-7xl space-y-12 px-5 py-12 lg:py-16">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              icon: CircleUserRound,
              title: "Explicit opt-in",
              body: "Every member applies with an authenticated account and accepts the published rules.",
            },
            {
              icon: ShieldCheck,
              title: "Private by default",
              body: "Public pages show capacity and policy—not member phone numbers or a downloadable contact list.",
            },
            {
              icon: UsersRound,
              title: "Capacity with purpose",
              body: "Limits keep each circle relevant and give moderation a manageable scope.",
            },
          ].map((item) => (
            <Card key={item.title} className="card-surface">
              <CardContent className="p-6">
                <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-primary">
                  <item.icon className="size-5" />
                </span>
                <h2 className="mt-5 text-xl font-bold">{item.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <section aria-labelledby="room-list-heading">
          <div className="flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-primary">Published circles</p>
              <h2 id="room-list-heading" className="mt-2 text-3xl font-bold">
                Find a relevant room
              </h2>
            </div>
            <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border bg-card px-3 sm:max-w-sm">
              <Search className="size-4 text-primary" />
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

          {rooms.isLoading ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div className="card-surface h-64 animate-pulse bg-muted" />
              <div className="card-surface h-64 animate-pulse bg-muted" />
            </div>
          ) : rooms.isError ? (
            <div className="mt-6 rounded-2xl border border-destructive/25 bg-destructive/5 p-6 text-sm">
              <p className="font-bold">Live circles are unavailable right now.</p>
              <p className="mt-1 text-muted-foreground">
                No fictional room data has been substituted.
              </p>
            </div>
          ) : filtered.length ? (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {filtered.map((room) => (
                <Card
                  key={room.id}
                  className="card-surface group transition-transform duration-300 hover:-translate-y-1"
                >
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-2xl font-bold">{room.name}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {room.purpose} · {room.state}
                        </p>
                      </div>
                      <Badge variant={room.verifiedOnly ? "default" : "secondary"}>
                        {room.verifiedOnly ? "Verified only" : "Open criteria"}
                      </Badge>
                    </div>
                    <div className="mt-6 grid grid-cols-3 gap-2 rounded-2xl bg-muted/70 p-4 text-center">
                      <div>
                        <p className="font-display text-xl font-bold">{room.memberCount}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Members</p>
                      </div>
                      <div>
                        <p className="font-display text-xl font-bold">{room.slotsLeft}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Open slots</p>
                      </div>
                      <div>
                        <p className="font-display text-xl font-bold">{room.slotLimit}</p>
                        <p className="mt-1 text-[10px] text-muted-foreground">Capacity</p>
                      </div>
                    </div>
                    <Button asChild className="mt-5 w-full" variant="outline">
                      <Link to="/contact-gain/$id" params={{ id: room.id }}>
                        Read rules <ArrowRight />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed p-10 text-center">
              <h3 className="text-2xl font-bold">No published circle matches</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Clear the filter or propose a carefully scoped room for review.
              </p>
              {query ? (
                <Button variant="outline" className="mt-5" onClick={() => setQuery("")}>
                  Clear filter
                </Button>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </PublicShell>
  );
}
