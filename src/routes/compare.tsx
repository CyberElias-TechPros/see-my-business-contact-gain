import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Check, Compass, Plus, Search, Sparkles, Trash2, WifiOff, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { BusinessMark, Stars, VerifiedBadge } from "@/components/kit";
import { Reveal } from "@/components/motion";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getDirectoryBusiness, getDirectoryResults } from "@/lib/directory.functions";
import type { PublicBusiness } from "@/lib/contracts";

const compareSearchSchema = z.object({
  ids: z.string().max(160).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
});

function parseIds(value: string | undefined): string[] {
  const seen = new Set<string>();
  return (value ?? "")
    .split(",")
    .filter((id) => z.string().uuid().safeParse(id).success)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .slice(0, 3);
}

export const Route = createFileRoute("/compare")({
  validateSearch: (search) => compareSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ ids: search.ids, q: search.q }),
  loader: async ({ deps }) => {
    const ids = parseIds(deps.ids);
    const [profiles, matches, popular] = await Promise.all([
      Promise.all(ids.map((id) => getDirectoryBusiness({ data: id }))),
      deps.q && deps.q.length >= 2
        ? getDirectoryResults({
            data: {
              q: deps.q,
              verified: false,
              openNow: false,
              minRating: 0,
              sort: "relevance",
              page: 1,
              pageSize: 8,
            },
          })
        : Promise.resolve(null),
      // A shortlist is useless if you have to already know what to type. These
      // are the highest-rated published records, offered as a starting point.
      getDirectoryResults({
        data: {
          q: "",
          verified: false,
          openNow: false,
          minRating: 0,
          sort: "rating",
          page: 1,
          pageSize: 6,
        },
      }),
    ]);
    return { ids, profiles, matches, popular };
  },
  head: () => ({
    meta: [
      { title: "Compare published businesses — GainHub NG" },
      {
        name: "description",
        content:
          "Build a shortlist of up to three current GainHub NG profiles and compare their published location, category, ratings, verification state and contact options.",
      },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Compare published businesses — GainHub NG" },
      {
        property: "og:description",
        content: "A URL-based shortlist using current published records, not fabricated providers.",
      },
    ],
  }),
  component: ComparePage,
});

function valueOrDash(value: string): string {
  return value.trim() || "—";
}

/**
 * The discovery picker.
 *
 * The page previously took ids in the URL and nothing else: to compare anything
 * you had to already know the businesses you wanted, which meant the shortlist
 * was really a bookmark tool rather than a way to discover. This combobox reads
 * the live directory as you type and adds straight to the shortlist, with full
 * keyboard support and a no-JavaScript fallback in the server-rendered results
 * further down the page.
 */
function LivePicker({
  selectedIds,
  searchIds,
  onAdd,
  onRemove,
  full,
}: {
  selectedIds: string[];
  searchIds: string;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
  full: boolean;
}) {
  const [value, setValue] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const listId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), 180);
    return () => clearTimeout(timer);
  }, [value]);

  const results = useQuery({
    queryKey: ["compare-picker", debounced],
    queryFn: () =>
      import("@/lib/directory.functions").then((m) =>
        m.getDirectoryResults({
          data: {
            q: debounced,
            verified: false,
            openNow: false,
            minRating: 0,
            sort: "relevance",
            page: 1,
            pageSize: 6,
          },
        }),
      ),
    enabled: debounced.length >= 2 && open,
    staleTime: 30_000,
  });

  const items = (results.data?.available ? results.data.result.items : []).filter(
    (business) => !selectedIds.includes(business.id),
  );

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function add(id: string) {
    if (full) return;
    onAdd(id);
    setValue("");
    setDebounced("");
    setOpen(false);
    setHighlighted(-1);
  }

  return (
    <div ref={containerRef} className="relative">
      {/*
        A real GET form underneath, so this still works with JavaScript off:
        submitting lands on /compare?q=… and the server-rendered results below
        offer the same "Add" links. With JavaScript on, submitting adds the
        highlighted result to the shortlist instead of navigating.
      */}
      <form
        method="get"
        action="/compare"
        role="search"
        onSubmit={(event) => {
          if (items[highlighted]) {
            event.preventDefault();
            add(items[highlighted].id);
          }
        }}
        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 p-2 pl-4 shadow-soft backdrop-blur focus-within:border-primary/45"
      >
        {searchIds ? <input type="hidden" name="ids" value={searchIds} /> : null}
        <Search className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <label className="sr-only" htmlFor="compare-picker">
          Search for a business to add to the comparison
        </label>
        <input
          id="compare-picker"
          name="q"
          type="search"
          autoComplete="off"
          value={value}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="Search by business name or service…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          onChange={(event) => {
            setValue(event.target.value);
            setOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (!open || !items.length) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlighted((index) => (index + 1) % items.length);
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlighted((index) => (index <= 0 ? items.length - 1 : index - 1));
            } else if (event.key === "Escape") {
              setOpen(false);
            }
          }}
        />
        {value ? (
          <button
            type="button"
            onClick={() => {
              setValue("");
              setDebounced("");
            }}
            className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Clear the search field"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        ) : null}
      </form>

      {open && debounced.length >= 2 ? (
        <div
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border/70 bg-popover/95 shadow-lift backdrop-blur-xl"
          role="presentation"
        >
          {results.isFetching && !items.length ? (
            <p className="p-4 text-sm text-muted-foreground">Searching the directory…</p>
          ) : null}

          {!results.data?.available ? (
            <p className="p-4 text-sm text-muted-foreground">
              Search is temporarily unavailable. Your shortlist is untouched.
            </p>
          ) : null}

          {results.data?.available && items.length ? (
            <ul id={listId} role="listbox" aria-label="Businesses you can add">
              {items.map((business, index) => (
                <li key={business.id} role="option" aria-selected={index === highlighted}>
                  <button
                    type="button"
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => add(business.id)}
                    className={`flex w-full items-center gap-3 p-3 text-left transition-colors ${
                      index === highlighted ? "bg-muted/70" : ""
                    }`}
                  >
                    <BusinessMark
                      name={business.name}
                      id={business.id}
                      className="size-9 text-xs"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{business.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {business.categoryName} · {business.city}
                      </span>
                    </span>
                    {business.reviewCount > 0 ? (
                      <Stars rating={business.rating} />
                    ) : (
                      <span className="text-xs text-muted-foreground">No reviews</span>
                    )}
                    <span className="ml-1 inline-flex items-center gap-1 rounded-lg bg-secondary px-2 py-1 text-xs font-semibold text-secondary-foreground">
                      <Plus className="size-3" aria-hidden="true" /> Add
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {results.data?.available && !items.length && !results.isFetching ? (
            <p className="p-4 text-sm text-muted-foreground">
              No published profile matches “{debounced}”.
            </p>
          ) : null}
        </div>
      ) : null}

      {full ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Three profiles is the maximum. Remove one to add another.
        </p>
      ) : null}
    </div>
  );
}

function ComparePage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { ids, profiles, matches, popular } = Route.useLoaderData();
  const selected = profiles.flatMap((result) =>
    result.available && result.business ? [result.business] : [],
  );
  const unavailableCount = profiles.filter((result) => !result.available).length;
  const missingCount = profiles.filter((result) => result.available && !result.business).length;

  const searchIds = ids.join(",");
  const add = (id: string) =>
    [...ids, id]
      .filter((value, index, all) => all.indexOf(value) === index)
      .slice(0, 3)
      .join(",");
  const remove = (id: string) => ids.filter((value) => value !== id).join(",");

  const go = (nextIds: string) => {
    void navigate({
      to: "/compare",
      search: {
        ...(nextIds ? { ids: nextIds } : {}),
        ...(search.q ? { q: search.q } : {}),
      },
      replace: true,
    });
  };

  return (
    <PublicShell>
      <PageHead
        eyebrow="Shortlist"
        title="Compare what profiles actually publish."
        subtitle="Choose up to three live listings. Your selection stays in the page URL, so it can be shared without an account or hidden browser storage."
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <Card className="rounded-3xl border-border/70">
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Compass className="size-4 text-primary" aria-hidden="true" />
              <p className="eyebrow text-muted-foreground">Add to the comparison</p>
              <span className="ml-auto text-xs font-semibold tabular-nums text-muted-foreground">
                {selected.length} of 3 selected
              </span>
            </div>

            <LivePicker
              selectedIds={ids}
              searchIds={searchIds}
              onAdd={(id) => go(add(id))}
              onRemove={(id) => go(remove(id))}
              full={ids.length >= 3}
            />

            {selected.length ? (
              <ul className="mt-4 flex flex-wrap gap-2">
                {selected.map((business) => (
                  <li key={business.id}>
                    <span className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/40 py-1 pl-1 pr-2 text-xs font-semibold">
                      <BusinessMark
                        name={business.name}
                        id={business.id}
                        className="size-6 text-[10px]"
                      />
                      {business.name}
                      <button
                        type="button"
                        onClick={() => go(remove(business.id))}
                        className="grid size-5 cursor-pointer place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/12 hover:text-destructive"
                        aria-label={`Remove ${business.name} from the comparison`}
                      >
                        <X className="size-3" aria-hidden="true" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Comparison includes public profile data only. Verification is a narrow signal, not a
              recommendation or outcome guarantee.
            </p>
          </CardContent>
        </Card>

        {unavailableCount > 0 ? (
          <div
            className="flex gap-3 rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-amber-950"
            role="status"
          >
            <WifiOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {unavailableCount} selected {unavailableCount === 1 ? "profile is" : "profiles are"}
            temporarily unavailable. No preview data has been substituted.
          </div>
        ) : null}
        {missingCount > 0 ? (
          <p
            className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground"
            role="status"
          >
            {missingCount} selected{" "}
            {missingCount === 1 ? "profile no longer exists" : "profiles no longer exist"} or is no
            longer published.
          </p>
        ) : null}

        {selected.length > 0 ? (
          <section aria-labelledby="comparison-heading">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="eyebrow">{selected.length} of 3 selected</p>
                <h2 id="comparison-heading" className="mt-2 text-2xl font-bold">
                  Side-by-side profile facts
                </h2>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/compare" search={{ q: search.q }}>
                  <Trash2 aria-hidden="true" /> Clear shortlist
                </Link>
              </Button>
            </div>
            <div className="mt-5 overflow-x-auto rounded-2xl border bg-card" tabIndex={0}>
              <table className="w-full min-w-[44rem] border-collapse text-left text-sm">
                <caption className="sr-only">Comparison of selected business profiles</caption>
                <thead>
                  <tr className="border-b bg-muted/45 align-top">
                    <th scope="col" className="w-40 p-4 font-semibold">
                      Profile field
                    </th>
                    {selected.map((business) => (
                      <th key={business.id} scope="col" className="min-w-48 p-4">
                        <Link
                          className="font-semibold hover:text-primary"
                          to="/business/$id"
                          params={{ id: business.id }}
                        >
                          {business.name}
                        </Link>
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="mt-2 -ml-3 flex text-muted-foreground"
                        >
                          <Link to="/compare" search={{ ids: remove(business.id), q: search.q }}>
                            <Trash2 aria-hidden="true" /> Remove
                          </Link>
                        </Button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <CompareRow
                    label="Rating"
                    businesses={selected}
                    render={(business) =>
                      business.reviewCount > 0 ? (
                        <Stars rating={business.rating} />
                      ) : (
                        "No reviews yet"
                      )
                    }
                  />
                  <CompareRow
                    label="Reviews"
                    businesses={selected}
                    render={(business) => business.reviewCount.toLocaleString()}
                  />
                  <CompareRow
                    label="Verification"
                    businesses={selected}
                    render={(business) => <VerifiedBadge level={business.verificationLevel} />}
                  />
                  <CompareRow
                    label="Category"
                    businesses={selected}
                    render={(business) => business.categoryName}
                  />
                  <CompareRow
                    label="Location"
                    businesses={selected}
                    render={(business) => `${business.city}, ${business.state}`}
                  />
                  <CompareRow
                    label="Open status"
                    businesses={selected}
                    render={(business) =>
                      business.openNow ? (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <Check className="size-4" aria-hidden="true" /> Recorded as open
                        </span>
                      ) : (
                        "Not confirmed open"
                      )
                    }
                  />
                  <CompareRow
                    label="Phone"
                    businesses={selected}
                    render={(business) => valueOrDash(business.phone)}
                  />
                  <CompareRow
                    label="WhatsApp"
                    businesses={selected}
                    render={(business) => valueOrDash(business.whatsapp)}
                  />
                  <CompareRow
                    label="Website"
                    businesses={selected}
                    render={(business) => (business.website ? "Available" : "—")}
                  />
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <Card className="rounded-3xl border-border/70 border-dashed">
            <CardContent className="p-9 text-center">
              <h2 className="text-xl font-semibold">Your shortlist is empty.</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                Search above by business name or service, then add current published profiles. No
                fictional providers are selected for you.
              </p>
            </CardContent>
          </Card>
        )}

        {/*
          Discovery rail. Shown whenever there is room in the shortlist, because
          "type a business name" is not a discovery flow — it only works if you
          already know who you are comparing.
        */}
        {ids.length < 3 && popular.available && popular.result.items.length ? (
          <section aria-labelledby="popular-heading" className="border-t pt-9">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow inline-flex items-center gap-1.5">
                  <Sparkles className="size-3.5" aria-hidden="true" /> Start here
                </p>
                <h2 id="popular-heading" className="mt-2 text-2xl font-bold">
                  Highest rated right now
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Published profiles ordered by their real average rating.
                </p>
              </div>
              <Button asChild variant="ghost" size="sm">
                <Link to="/search">Browse all</Link>
              </Button>
            </div>

            <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {popular.result.items
                .filter((business) => !ids.includes(business.id))
                .slice(0, 6)
                .map((business, index) => (
                  <Reveal as="li" key={business.id} delay={index % 3}>
                    <Card className="h-full rounded-2xl border-border/70 transition-colors hover:border-primary/40">
                      <CardContent className="flex h-full items-center gap-3 p-4">
                        <BusinessMark
                          name={business.name}
                          id={business.id}
                          className="size-11 text-sm"
                        />
                        <div className="min-w-0 flex-1">
                          <Link
                            to="/business/$id"
                            params={{ id: business.slug }}
                            className="block truncate text-sm font-semibold hover:text-primary"
                          >
                            {business.name}
                          </Link>
                          <p className="truncate text-xs text-muted-foreground">
                            {business.categoryName} · {business.city}
                          </p>
                          <div className="mt-1">
                            {business.reviewCount > 0 ? (
                              <Stars rating={business.rating} />
                            ) : (
                              <span className="text-xs text-muted-foreground">No reviews yet</span>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="secondary" onClick={() => go(add(business.id))}>
                          <Plus aria-hidden="true" /> Add
                        </Button>
                      </CardContent>
                    </Card>
                  </Reveal>
                ))}
            </ul>
          </section>
        ) : null}

        {matches?.available ? (
          <section aria-labelledby="matches-heading" className="border-t pt-9">
            <p className="eyebrow">Search results</p>
            <h2 id="matches-heading" className="mt-2 text-2xl font-bold">
              {matches.result.pagination.total}{" "}
              {matches.result.pagination.total === 1 ? "match" : "matches"} for “{search.q}”
            </h2>
            {matches.result.items.length > 0 ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {matches.result.items.map((business) => {
                  const isSelected = ids.includes(business.id);
                  const full = ids.length >= 3;
                  return (
                    <Card key={business.id} className="rounded-3xl border-border/70">
                      <CardContent className="flex items-center justify-between gap-4 p-5">
                        <div className="min-w-0">
                          <Link
                            className="font-semibold hover:text-primary"
                            to="/business/$id"
                            params={{ id: business.id }}
                          >
                            {business.name}
                          </Link>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {business.categoryName} · {business.city}
                          </p>
                        </div>
                        {isSelected ? (
                          <Button asChild variant="outline" size="sm">
                            <Link to="/compare" search={{ ids: remove(business.id), q: search.q }}>
                              <Check aria-hidden="true" /> Added
                            </Link>
                          </Button>
                        ) : (
                          <Button asChild size="sm" variant="secondary" aria-disabled={full}>
                            {full ? (
                              <span title="Remove a profile before adding another">
                                Shortlist full
                              </span>
                            ) : (
                              <Link to="/compare" search={{ ids: add(business.id), q: search.q }}>
                                <Plus aria-hidden="true" /> Add
                              </Link>
                            )}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No published profiles matched that search.
              </p>
            )}
          </section>
        ) : matches && !matches.available ? (
          <p
            className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm text-amber-950"
            role="status"
          >
            Search is temporarily unavailable. Existing available shortlist entries remain above.
          </p>
        ) : null}
      </div>
    </PublicShell>
  );
}

function CompareRow({
  label,
  businesses,
  render,
}: {
  label: string;
  businesses: PublicBusiness[];
  render: (business: PublicBusiness) => React.ReactNode;
}) {
  return (
    <tr className="border-b last:border-0">
      <th scope="row" className="p-4 font-semibold text-muted-foreground">
        {label}
      </th>
      {businesses.map((business) => (
        <td key={business.id} className="p-4 align-top">
          {render(business)}
        </td>
      ))}
    </tr>
  );
}
