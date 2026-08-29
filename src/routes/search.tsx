import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  ListPlus,
  MapPin,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { BusinessCard, EmptyState, LoadError, LoadingCard } from "@/components/kit";
import { useMe, useHubLists, useCreateList, useAddToList } from "@/lib/queries";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinesses, useMeta } from "@/lib/queries";
import type { SearchParams } from "@/lib/types";

type SearchSearch = {
  q?: string | undefined;
  category?: string | undefined;
  location?: string | undefined;
  area?: string | undefined;
  minRating?: number | undefined;
  openNow?: boolean | undefined;
  verifiedOnly?: boolean | undefined;
  delivery?: boolean | undefined;
  card?: boolean | undefined;
  homeService?: boolean | undefined;
  sort?: string | undefined;
  page?: number | undefined;
};

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchSearch => {
    const out: SearchSearch = {};
    for (const key of ["q", "category", "location", "area", "sort"] as const) {
      const v = search[key];
      if (typeof v === "string" && v) out[key] = v;
    }
    for (const key of ["openNow", "verifiedOnly", "delivery", "card", "homeService"] as const) {
      const v = search[key];
      if (v === "true" || v === true) out[key] = true;
    }
    if (typeof search["minRating"] === "string" && Number(search["minRating"]) > 0)
      out.minRating = Number(search["minRating"]);
    if (typeof search["page"] === "string" && Number(search["page"]) > 1)
      out.page = Number(search["page"]);
    return out;
  },
  head: () => ({
    meta: [
      { title: "Search Nigerian businesses — GainHub NG Directory" },
      {
        name: "description",
        content:
          "Search verified businesses by category, city, rating and opening hours. Filter, compare and start a WhatsApp chat in one tap.",
      },
      { property: "og:title", content: "Search Nigerian businesses — GainHub NG" },
      {
        property: "og:description",
        content: "Filter by category, location, verification and rating, then chat on WhatsApp.",
      },
    ],
  }),
  component: SearchPage,
});

const QUICK_FILTERS = [
  { key: "openNow", label: "Open now" },
  { key: "verifiedOnly", label: "Verified only" },
  { key: "delivery", label: "Offers delivery" },
  { key: "card", label: "Accepts card" },
  { key: "homeService", label: "Home service" },
] as const;

function SearchPage() {
  const params = Route.useSearch();
  const navigate = useNavigate();
  const { data: meta } = useMeta();
  const [keyword, setKeyword] = useState(params.q ?? "");
  const [ratingDraft, setRatingDraft] = useState<number>(params.minRating ?? 0);
  const [view, setView] = useState<"grid" | "areas">("grid");

  const page = params.page ?? 1;
  const query: SearchParams = {
    q: params.q,
    category: params.category,
    location: params.location,
    area: params.area,
    minRating: params.minRating,
    openNow: params.openNow,
    verifiedOnly: params.verifiedOnly,
    delivery: params.delivery,
    card: params.card,
    homeService: params.homeService,
    sort: (params.sort as SearchParams["sort"]) ?? "relevance",
    page,
    pageSize: 12,
  };
  const results = useBusinesses(query);

  const setParams = (patch: Partial<SearchSearch>) => {
    navigate({
      to: "/search",
      search: (prev: SearchSearch) => {
        const next = { ...prev, ...patch };
        for (const k of Object.keys(next) as (keyof SearchSearch)[]) {
          if (next[k] === undefined || next[k] === false || next[k] === "") delete next[k];
        }
        if (!("page" in patch)) delete next.page;
        return next;
      },
    });
  };

  const activeChips: { label: string; clear: () => void }[] = [];
  if (params.q)
    activeChips.push({ label: `“${params.q}”`, clear: () => setParams({ q: undefined }) });
  if (params.category)
    activeChips.push({
      label: meta?.categories.find((c) => c.slug === params.category)?.name ?? params.category,
      clear: () => setParams({ category: undefined }),
    });
  if (params.location)
    activeChips.push({
      label: meta?.locations.find((l) => l.slug === params.location)?.name ?? params.location,
      clear: () => setParams({ location: undefined }),
    });
  for (const f of QUICK_FILTERS) {
    if (params[f.key])
      activeChips.push({ label: f.label, clear: () => setParams({ [f.key]: undefined }) });
  }
  if (params.minRating)
    activeChips.push({
      label: `${params.minRating}+ stars`,
      clear: () => setParams({ minRating: undefined }),
    });

  const items = results.data?.items ?? [];
  const total = results.data?.total ?? 0;

  // ---- contact-gain selection mode: tick businesses, save the batch to a list
  const { data: me } = useMe();
  const hubLists = useHubLists();
  const createList = useCreateList();
  const [selected, setSelected] = useState<string[]>([]);
  const [saveOpen, setSaveOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [selectedListId, setSelectedListId] = useState<string>("");
  const [selecting, setSelecting] = useState(false);
  const addToList = useAddToList(selectedListId);
  const toggleSelect = (id: string) =>
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : sel.length < 50 ? [...sel, id] : sel,
    );

  return (
    <PublicShell>
      <PageHead
        eyebrow="Directory"
        title="Search businesses, products & services"
        subtitle={
          meta
            ? `${meta.stats.businesses.toLocaleString()} listings across ${meta.stats.states} states. Ranked by relevance, responsiveness and verification level.`
            : "Nigeria's WhatsApp-first business directory."
        }
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/compare">Compare selected</Link>
            </Button>
            <Button asChild>
              <Link to="/join">List your business</Link>
            </Button>
          </div>
        }
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[260px_1fr]">
        <aside className="card-surface h-fit p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="size-4" /> Filters
          </div>
          <div className="space-y-6">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setParams({ q: keyword || undefined });
              }}
            >
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Keyword
              </Label>
              <div className="mt-2 flex gap-2">
                <Input
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  placeholder="e.g. iPhone screen"
                />
                <Button type="submit" size="sm" variant="secondary">
                  Go
                </Button>
              </div>
            </form>
            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Location
              </Label>
              <Select
                value={params.location ?? "any"}
                onValueChange={(v) => setParams({ location: v === "any" ? undefined : v })}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Anywhere in Nigeria</SelectItem>
                  {(meta?.locations ?? []).map((l) => (
                    <SelectItem key={l.slug} value={l.slug}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
              <div className="mt-3 space-y-2">
                {(meta?.categories ?? []).map((c) => (
                  <label key={c.slug} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={params.category === c.slug}
                      onCheckedChange={(checked) =>
                        setParams({ category: checked ? c.slug : undefined })
                      }
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>
            <Separator />
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick filters</p>
              {QUICK_FILTERS.map((f) => (
                <label key={f.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={Boolean(params[f.key])}
                    onCheckedChange={(checked) =>
                      setParams({ [f.key]: checked ? true : undefined })
                    }
                  />
                  {f.label}
                </label>
              ))}
            </div>
            <Separator />
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                Minimum rating
              </p>
              <Slider
                value={[ratingDraft]}
                min={0}
                max={5}
                step={0.5}
                className="mt-4"
                onValueChange={(v) => setRatingDraft(v[0] ?? 0)}
                onValueCommit={(v) =>
                  setParams({ minRating: (v[0] ?? 0) > 0 ? (v[0] ?? 0) : undefined })
                }
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {ratingDraft > 0 ? `${ratingDraft}+ stars` : "Any rating"}
              </p>
            </div>
            <Button
              variant="ghost"
              className="w-full"
              onClick={() =>
                setParams({
                  q: undefined,
                  category: undefined,
                  location: undefined,
                  openNow: undefined,
                  verifiedOnly: undefined,
                  delivery: undefined,
                  card: undefined,
                  homeService: undefined,
                  minRating: undefined,
                  sort: undefined,
                })
              }
            >
              Reset all filters
            </Button>
          </div>
        </aside>
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Showing{" "}
              <span className="font-semibold text-foreground">
                {results.isFetching
                  ? "…"
                  : `${items.length ? (page - 1) * 12 + 1 : 0}–${(page - 1) * 12 + items.length}`}
              </span>{" "}
              of {total.toLocaleString()} result{total === 1 ? "" : "s"}
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Select
                value={params.sort ?? "relevance"}
                onValueChange={(v) => setParams({ sort: v === "relevance" ? undefined : v })}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Sort: Relevance</SelectItem>
                  <SelectItem value="rating">Sort: Highest rated</SelectItem>
                  <SelectItem value="response">Sort: Fastest response</SelectItem>
                  <SelectItem value="contacts">Sort: Most contacts gained</SelectItem>
                </SelectContent>
              </Select>
              <Tabs value={view} onValueChange={(v) => setView(v as "grid" | "areas")}>
                <TabsList>
                  <TabsTrigger value="grid" className="gap-1">
                    <LayoutGrid className="size-3.5" /> Grid
                  </TabsTrigger>
                  <TabsTrigger value="areas" className="gap-1">
                    <MapPin className="size-3.5" /> Areas
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          {activeChips.length ? (
            <div className="mb-6 flex flex-wrap gap-2">
              {activeChips.map((chip) => (
                <button
                  key={chip.label}
                  onClick={chip.clear}
                  className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-medium transition-colors hover:bg-secondary/70"
                >
                  {chip.label} <X className="size-3" />
                </button>
              ))}
            </div>
          ) : null}

          {results.isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <LoadingCard key={i} />
              ))}
            </div>
          ) : results.isError ? (
            <LoadError
              message={(results.error as Error)?.message}
              retry={() => void results.refetch()}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="No businesses match those filters"
              body="Try removing a filter or broadening your search — new businesses join GainHub every day."
              action={
                <Button
                  variant="outline"
                  onClick={() =>
                    setParams({ q: undefined, category: undefined, location: undefined })
                  }
                >
                  Clear search
                </Button>
              }
            />
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((b) =>
                selecting ? (
                  <label
                    key={b.id}
                    className={`relative block cursor-pointer rounded-2xl border p-3 transition-colors ${
                      selected.includes(b.id)
                        ? "border-primary ring-1 ring-primary"
                        : "hover:bg-muted/40"
                    }`}
                  >
                    <Checkbox
                      className="absolute right-3 top-3 z-10 bg-background"
                      checked={selected.includes(b.id)}
                      onCheckedChange={() => toggleSelect(b.id)}
                      aria-label={`Select ${b.name}`}
                    />
                    <BusinessCard business={b} />
                  </label>
                ) : (
                  <BusinessCard key={b.id} business={b} />
                ),
              )}
            </div>
          ) : (
            <AreaView
              items={items}
              onSelectArea={(area) => setParams({ area: area === params.area ? undefined : area })}
              activeArea={params.area}
            />
          )}

          {items.length > 0 ? (
            <div className="sticky bottom-4 z-20 mt-6">
              {selecting ? (
                <Card className="card-surface border-primary/40 shadow-lg">
                  <CardContent className="flex flex-wrap items-center gap-3 p-3 text-sm">
                    <span className="font-medium">{selected.length} selected</span>
                    <span className="hidden text-muted-foreground sm:inline">
                      Tick up to 50 businesses, then save them to a contact list.
                    </span>
                    <div className="ml-auto flex gap-2">
                      <Button
                        size="sm"
                        disabled={selected.length === 0}
                        onClick={() => {
                          if (!me) {
                            toast.error("Sign in to save contact lists");
                            void navigate({ to: "/auth", search: { redirect: "/search" } });
                            return;
                          }
                          setSaveOpen(true);
                        }}
                      >
                        Save to list
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setSelected([])}>
                        Clear
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelecting(false)}>
                        Done
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    className="shadow-lg"
                    onClick={() => setSelecting(true)}
                  >
                    <ListPlus className="size-4" /> Select &amp; save contacts
                  </Button>
                </div>
              )}
            </div>
          ) : null}

          {results.data && results.data.pages > 1 ? (
            <Card className="card-surface mt-8">
              <CardContent className="flex items-center justify-between p-4 text-sm">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setParams({ page: page > 1 ? page - 1 : undefined })}
                >
                  <ChevronLeft className="size-4" /> Previous
                </Button>
                <span className="text-muted-foreground">
                  Page {page} of {results.data.pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= results.data.pages}
                  onClick={() => setParams({ page: page + 1 })}
                >
                  Next <ChevronRight className="size-4" />
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
      {/* Save selection to a contact list */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save {selected.length} businesses to a list</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Choose a list</Label>
              <Select value={selectedListId} onValueChange={setSelectedListId}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Pick a list…" />
                </SelectTrigger>
                <SelectContent>
                  {(hubLists.data ?? []).map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.name} ({l.businessCount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">or create new</span>
              <Separator className="flex-1" />
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="List name — e.g. Lagos hotels"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
              />
              <Button
                variant="secondary"
                disabled={createList.isPending || newListName.trim().length < 2}
                onClick={() =>
                  createList.mutate(
                    { name: newListName, onSuccess: (id) => setSelectedListId(id) },
                    { onSuccess: () => setNewListName("") },
                  )
                }
              >
                Create
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Saved contacts are private to your account — the businesses never see your notes.
              Manage them in{" "}
              <Link to="/hub" className="text-primary">
                My Contacts
              </Link>
              .
            </p>
          </div>
          <Button
            className="w-full"
            disabled={!selectedListId || addToList.isPending}
            onClick={() =>
              addToList.mutate(
                { businessIds: selected, source: "Directory search" },
                {
                  onSuccess: (r) => {
                    toast.success(
                      r.duplicates > 0
                        ? `Saved ${r.added} — ${r.duplicates} already in the list`
                        : `Saved ${r.added} to your list`,
                    );
                    setSaveOpen(false);
                    setSelected([]);
                    setSelecting(false);
                  },
                },
              )
            }
          >
            {addToList.isPending ? "Saving…" : `Save ${selected.length} to list`}
          </Button>
        </DialogContent>
      </Dialog>
    </PublicShell>
  );
}

function AreaView({
  items,
  onSelectArea,
  activeArea,
}: {
  items: {
    id: string;
    name: string;
    city: string;
    state: string;
    tagline: string;
    rating: number;
  }[];
  onSelectArea: (area: string) => void;
  activeArea?: string;
}) {
  const byCity = new Map<string, typeof items>();
  for (const b of items) {
    const list = byCity.get(b.city) ?? [];
    list.push(b);
    byCity.set(b.city, list);
  }
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        A lightweight map of where these businesses are. Tap an area to focus, then open a profile
        for directions.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {Array.from(byCity.entries()).map(([city, list]) => (
          <Card
            key={city}
            className={`card-surface p-0 ${activeArea === city ? "ring-2 ring-primary" : ""}`}
          >
            <CardContent className="p-4">
              <button
                className="flex w-full items-center justify-between"
                onClick={() => onSelectArea(city)}
              >
                <span className="font-semibold">{city}</span>
                <Badge variant="secondary">{list.length} here</Badge>
              </button>
              <div className="mt-3 space-y-2">
                {list.map((b) => (
                  <Link
                    key={b.id}
                    to="/business/$id"
                    params={{ id: b.id }}
                    className="flex items-center justify-between gap-3 rounded-lg border p-2 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="min-w-0 truncate font-medium">{b.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      ★ {b.rating.toFixed(1)}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
