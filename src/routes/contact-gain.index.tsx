import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ShieldCheck, Users } from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { EmptyState, LoadingCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useJoinRoom, useMe, useRooms } from "@/lib/queries";

export const Route = createFileRoute("/contact-gain/")({
  validateSearch: (search: Record<string, unknown>): { q?: string; state?: string } => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    state: typeof search["state"] === "string" ? search["state"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "WhatsApp contact-gain rooms in Nigeria — GainHub NG" },
      {
        name: "description",
        content:
          "Join moderated WhatsApp contact-gain rooms with published save-back rules, slot limits and verified-only options. Grow your status reach safely.",
      },
    ],
  }),
  component: ContactGainPage,
});

function ContactGainPage() {
  const params = Route.useSearch();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const rooms = useRooms({ q: params.q, state: params.state });
  const join = useJoinRoom();
  const [q, setQ] = useState(params.q ?? "");
  const [state, setState] = useState(params.state ?? "all");

  const applyFilters = (nextQ: string, nextState: string) => {
    void navigate({
      to: "/contact-gain",
      search: {
        q: nextQ || undefined,
        state: nextState && nextState !== "all" ? nextState : undefined,
      },
    });
  };

  return (
    <PublicShell>
      <PageHead
        eyebrow="Contact gain"
        title="Grow your WhatsApp contacts, safely"
        subtitle="Contact gain is how many Nigerians advertise: get saved, then your status reaches thousands. Our rooms add moderation, slot limits, save-back tracking and reporting."
        action={
          <Button asChild>
            <Link to="/contact-gain/create">Create a room</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              icon: Users,
              t: "Save-back score",
              d: "Members who never save back lose access. Your score is visible before you join.",
            },
            {
              icon: ShieldCheck,
              t: "Moderated content",
              d: "AI pre-screening plus human review for nudity, scams and impersonation.",
            },
            {
              icon: Users,
              t: "Slot limits",
              d: "Rooms cap membership so status reach stays useful and phones stay usable.",
            },
          ].map((x) => (
            <Card key={x.t} className="card-surface">
              <CardContent className="p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <x.icon className="size-5" />
                </span>
                <h2 className="mt-4 font-semibold">{x.t}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="card-surface">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row">
            <form
              className="flex flex-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                applyFilters(q, state);
              }}
            >
              <Input
                placeholder="Search rooms by name or niche"
                className="flex-1"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Select
                value={state}
                onValueChange={(v) => {
                  setState(v);
                  applyFilters(q, v);
                }}
              >
                <SelectTrigger className="sm:w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All states</SelectItem>
                  <SelectItem value="Lagos">Lagos</SelectItem>
                  <SelectItem value="Abuja">Abuja</SelectItem>
                  <SelectItem value="Nationwide">Nationwide</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit">Find rooms</Button>
            </form>
          </CardContent>
        </Card>

        {rooms.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <LoadingCard key={i} />
            ))}
          </div>
        ) : (rooms.data ?? []).length === 0 ? (
          <EmptyState
            title="No rooms match that search"
            body="Try a different keyword — or start your own moderated room and set the rules."
            action={
              <Button asChild>
                <Link to="/contact-gain/create">Create a room</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {(rooms.data ?? []).map((r) => (
              <Card key={r.id} className="card-surface">
                <CardContent className="space-y-3 p-6">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-lg font-semibold">{r.name}</h3>
                    {r.verifiedOnly ? (
                      <Badge>Verified only</Badge>
                    ) : (
                      <Badge variant="outline">Open</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.purpose}</p>
                  <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center text-xs">
                    <div>
                      <p className="font-display text-lg font-bold">{r.members.toLocaleString()}</p>
                      <p className="text-muted-foreground">Members</p>
                    </div>
                    <div>
                      <p className="font-display text-lg font-bold">{r.slotsLeft ?? 0}</p>
                      <p className="text-muted-foreground">Slots left</p>
                    </div>
                    <div>
                      <p className="font-display text-lg font-bold">{r.state}</p>
                      <p className="text-muted-foreground">Coverage</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">House rule: {r.rule}</p>
                  <div className="flex gap-2">
                    <Button asChild className="flex-1">
                      <Link to="/contact-gain/$id" params={{ id: r.id }}>
                        Open room
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      disabled={join.isPending}
                      onClick={() =>
                        me
                          ? join.mutate(r.id)
                          : void navigate({
                              to: "/auth",
                              search: { redirect: `/contact-gain/${r.id}` },
                            })
                      }
                    >
                      Join queue
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </PublicShell>
  );
}
