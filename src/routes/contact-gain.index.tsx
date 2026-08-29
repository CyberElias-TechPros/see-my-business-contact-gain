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
import {
  useJoinRoom,
  useMe,
  useRooms,
  useListings,
  useCreateListing,
  useDeleteListing,
  useTrackListingAdd,
  useMyListings,
} from "@/lib/queries";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { waLink } from "@/lib/api";
import { Phone, Plus, UserRound, Handshake } from "lucide-react";

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

        <Tabs defaultValue="rooms" className="space-y-6">
          <TabsList>
            <TabsTrigger value="rooms">Rooms</TabsTrigger>
            <TabsTrigger value="people">People</TabsTrigger>
          </TabsList>
          <TabsContent value="rooms" className="space-y-6">
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
                          <p className="font-display text-lg font-bold">
                            {r.members.toLocaleString()}
                          </p>
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
          </TabsContent>
          <TabsContent value="people">
            <PeopleListings me={me} />
          </TabsContent>
        </Tabs>
      </div>
    </PublicShell>
  );
}

// ---------------------------------------------------------------------------
// People — the classic Nigerian "post a number" contact-gain layer. One active
// listing per account; others one-tap-add you on WhatsApp. Trust comes from
// real accounts + reports instead of paid OTP SMS (see DEPLOYMENT.md).
// ---------------------------------------------------------------------------

const PEOPLE_CATEGORIES = [
  "Business networking",
  "Jobs & hiring",
  "Buy & sell",
  "Comedy & entertainment",
  "Study groups",
  "Community & region",
  "Other",
];

const ADD_LIMIT_ANON = 30;
const ADD_LIMIT_USER = 100;

function addsToday(): number {
  const key = `gainhub.adds.${new Date().toISOString().slice(0, 10)}`;
  return Number(localStorage.getItem(key) ?? 0);
}

function bumpAddsToday(): number {
  const key = `gainhub.adds.${new Date().toISOString().slice(0, 10)}`;
  const n = addsToday() + 1;
  localStorage.setItem(key, String(n));
  return n;
}

function PeopleListings({ me }: { me: { name: string } | null | undefined }) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("all");
  const listings = useListings({
    q: q || undefined,
    category: category === "all" ? undefined : category,
  });
  const myListings = useMyListings();
  const createListing = useCreateListing();
  const deleteListing = useDeleteListing();
  const trackAdd = useTrackListingAdd();
  const [postOpen, setPostOpen] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [listingCategory, setListingCategory] = useState(PEOPLE_CATEGORIES[0] ?? "Other");
  const [listingState, setListingState] = useState("Lagos");
  const [bio, setBio] = useState("");

  const limit = me ? ADD_LIMIT_USER : ADD_LIMIT_ANON;
  const used = addsToday();

  const addOnWhatsApp = (id: string, name: string, number: string) => {
    if (used >= limit) {
      toast.error(
        me
          ? `Daily limit of ${limit} adds reached — try again tomorrow`
          : `Daily limit of ${limit} reached — sign in for ${ADD_LIMIT_USER}/day`,
      );
      return;
    }
    bumpAddsToday();
    void trackAdd.mutateAsync({ id });
    window.open(
      `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(
        `Hi ${name}! I found your contact on GainHub NG contact gain.`,
      )}`,
      "_blank",
      "noopener",
    );
  };

  const mine = myListings.data ?? [];

  return (
    <div className="space-y-6">
      <Card className="card-surface">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <Input
            placeholder="Search people by name, bio or category"
            className="flex-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {PEOPLE_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={() => {
              if (!me) {
                toast.error("Sign in to post your number");
                return;
              }
              setPostOpen(true);
            }}
          >
            <Plus className="size-4" /> Post your number
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">
          {used}/{limit} adds today
        </Badge>
        <span>
          One active listing per account • every listing is tied to a real account and can be
          reported
        </span>
      </div>

      {listings.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <LoadingCard key={i} />
          ))}
        </div>
      ) : (listings.data ?? []).length === 0 ? (
        <EmptyState
          title="No listings here yet"
          body="Be the first to post your number — people searching this category will find you."
          action={
            <Button
              onClick={() => (me ? setPostOpen(true) : toast.error("Sign in to post your number"))}
            >
              Post your number
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {(listings.data ?? []).map((l) => (
            <Card key={l.id} className="card-surface">
              <CardContent className="space-y-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-11 place-items-center rounded-full bg-secondary font-semibold">
                      {l.displayName.slice(0, 1).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-medium">{l.displayName}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.category} {l.state ? `• ${l.state}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="secondary">
                    <Handshake className="mr-1 size-3" />
                    {l.adds} adds
                  </Badge>
                </div>
                {l.bio ? <p className="text-sm text-muted-foreground">{l.bio}</p> : null}
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={() => addOnWhatsApp(l.id, l.displayName, l.whatsapp)}>
                    <Phone className="size-3.5" /> Add on WhatsApp
                  </Button>
                  {me && mine.some((m) => m.id === l.id) ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() =>
                        deleteListing.mutate(l.id, {
                          onSuccess: () => toast.success("Listing removed"),
                        })
                      }
                    >
                      Delete my listing
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {mine.length > 0 ? (
        <Card className="card-surface border-primary/40">
          <CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
            <UserRound className="size-4 text-primary" />
            <span>
              Your listing is live: <strong>{mine[0]?.displayName}</strong> ({mine[0]?.adds} adds)
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto text-destructive"
              onClick={() =>
                deleteListing.mutate(mine[0]!.id, {
                  onSuccess: () => toast.success("Listing removed"),
                })
              }
            >
              Remove
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* Post-a-number dialog */}
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post your number</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="pl-name">Display name</Label>
                <Input
                  id="pl-name"
                  className="mt-2"
                  placeholder="Hauwa Braids"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pl-wa">WhatsApp number</Label>
                <Input
                  id="pl-wa"
                  className="mt-2"
                  placeholder="0803…"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={listingCategory} onValueChange={setListingCategory}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PEOPLE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="pl-state">State</Label>
                <Input
                  id="pl-state"
                  className="mt-2"
                  value={listingState}
                  onChange={(e) => setListingState(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pl-bio">Short bio</Label>
              <Textarea
                id="pl-bio"
                className="mt-2"
                placeholder="Braids and gele in Surulere — DM for prices. Save me and mention GainHub for 10% off."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              One active listing per account. Listings linked to reports or scam behaviour are
              removed by moderators — see the trust &amp; safety policy.
            </p>
          </div>
          <Button
            disabled={
              createListing.isPending ||
              displayName.trim().length < 2 ||
              whatsapp.replace(/\D/g, "").length < 10
            }
            onClick={() =>
              createListing.mutate(
                {
                  displayName,
                  whatsapp,
                  category: listingCategory,
                  state: listingState,
                  bio,
                },
                {
                  onSuccess: () => {
                    toast.success("Your number is live — share your profile link to gain contacts");
                    setPostOpen(false);
                    setDisplayName("");
                    setWhatsapp("");
                    setBio("");
                  },
                },
              )
            }
          >
            {createListing.isPending ? "Publishing…" : "Publish listing"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
