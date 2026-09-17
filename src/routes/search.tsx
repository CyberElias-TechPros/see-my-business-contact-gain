import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Clock3,
  Filter,
  MapPin,
  Search,
  SlidersHorizontal,
  Store,
  WifiOff,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { z } from "zod";
import { BusinessCard, EmptyState } from "@/components/kit";
import { Reveal } from "@/components/motion";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { directoryQuerySchema } from "@/lib/contracts";
import { getDirectoryResults, getDirectoryTaxonomy } from "@/lib/directory.functions";
import type { SearchSuggestion } from "@/lib/contracts";

const searchParamsSchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  category: z.string().trim().max(80).optional().catch(undefined),
  location: z.string().trim().max(80).optional().catch(undefined),
  verified: z
    .preprocess((value) => value === true || value === "true" || value === "1", z.boolean())
    .optional()
    .catch(undefined),
  openNow: z
    .preprocess((value) => value === true || value === "true" || value === "1", z.boolean())
    .optional()
    .catch(undefined),
  minRating: z.coerce.number().min(0).max(5).optional().catch(undefined),
  sort: z.enum(["relevance", "rating", "name", "recent"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(10_000).optional().catch(undefined),
});

export const Route = createFileRoute("/search")({
  validateSearch: (search) => searchParamsSchema.parse(search),
  loaderDeps: ({ search }) => directoryQuerySchema.parse(search),
  loader: async ({ deps }) => {
    const [results, taxonomy] = await Promise.all([
      getDirectoryResults({ data: { ...deps, pageSize: 12 } }),
      getDirectoryTaxonomy(),
    ]);
    return { results, taxonomy };
  },
  head: ({ match }) => {
    // Query permutations are not canonical pages: only the clean directory URL is
    // indexable, so crawlers are not invited to index infinite filter combinations.
    const search = match.search ?? {};
    return {
      meta: [
        {
          title: search.q
            ? `${search.q} — Nigerian business search | GainHub NG`
            : "Search Nigerian businesses by service and city — GainHub NG",
        },
        {
          name: "description",
          content:
            "Search reviewed Nigerian business listings by service, category, city, verification level and opening hours.",
        },
        // Query and filter combinations are infinite; canonicalise them to the clean
        // search page so crawlers do not index parameter permutations.
        { name: "robots", content: search.q ? "noindex, follow" : "index, follow" },
        { property: "og:title", content: "Find a local business — GainHub NG" },
        {
          property: "og:description",
          content:
            "Use practical filters, compare useful profile details and start a conversation with the right provider.",
        },
      ],
    };
  },
  pendingComponent: SearchPending,
  component: SearchPage,
});

/* -------------------------------------------------------------------------- */
/* Type-ahead                                                                 */
/* -------------------------------------------------------------------------- */

function SuggestionIcon({ type }: { type: SearchSuggestion["type"] }) {
  if (type === "business") return <Store className="size-4" aria-hidden="true" />;
  if (type === "location") return <MapPin className="size-4" aria-hidden="true" />;
  if (type === "service") return <Clock3 className="size-4" aria-hidden="true" />;
  return <Building2 className="size-4" aria-hidden="true" />;
}

function SearchBox({ initialQuery }: { initialQuery: string }) {
  const navigate = useNavigate();
  const [value, setValue] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const listId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value.trim()), 180);
    return () => clearTimeout(timer);
  }, [value]);

  const suggestions = useQuery({
    queryKey: ["suggest", debounced],
    queryFn: () =>
      import("@/lib/directory.functions").then((m) => m.getSuggestions({ data: debounced })),
    enabled: debounced.length >= 2 && open,
    staleTime: 30_000,
  });

  const items = suggestions.data?.items ?? [];

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function go(href: string) {
    setOpen(false);
    // Suggestion hrefs are relative app paths. A same-route URL (a filtered search)
    // keeps its query string; everything else navigates as authored.
    void navigate({ to: href, search: () => ({}) });
  }

  function submit() {
    setOpen(false);
    void navigate({ to: "/search", search: { q: value.trim() || undefined, page: 1 } });
  }

  return (
    <div ref={containerRef} className="relative">
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex items-center gap-3 rounded-2xl border border-border/70 bg-card/90 p-2 pl-4 shadow-soft backdrop-blur focus-within:border-primary/45"
      >
        <Search className="size-5 shrink-0 text-primary" aria-hidden="true" />
        <label className="sr-only" htmlFor="directory-search">
          What are you looking for?
        </label>
        <input
          id="directory-search"
          name="q"
          type="search"
          autoComplete="off"
          value={value}
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
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
            } else if (event.key === "Enter" && highlighted >= 0) {
              event.preventDefault();
              const item = items[highlighted];
              if (item) go(item.href);
            }
          }}
          placeholder="Phone repair, catering, tailor…"
          className="h-11 w-full bg-transparent text-base outline-none placeholder:text-muted-foreground/60"
        />
        <Button type="submit" size="default" className="shrink-0">
          Search
        </Button>
      </form>

      {open && items.length > 0 ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-border/70 bg-card shadow-lift"
        >
          {items.map((item, index) => (
            <li
              key={`${item.type}-${item.href}`}
              role="option"
              aria-selected={index === highlighted}
            >
              <a
                href={item.href}
                onClick={(event) => {
                  // Internal links are handled by the router; keep modifier clicks native.
                  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                  event.preventDefault();
                  go(item.href);
                }}
                onMouseEnter={() => setHighlighted(index)}
                className={`flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  index === highlighted ? "bg-secondary" : "hover:bg-muted/60"
                }`}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-secondary text-primary">
                  <SuggestionIcon type={item.type} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{item.label}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.hint}</span>
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Filters                                                                    */
/* -------------------------------------------------------------------------- */

function FilterFields() {
  const search = directoryQuerySchema.parse(Route.useSearch());
  const { taxonomy } = Route.useLoaderData();

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="eyebrow text-muted-foreground">What do you need?</span>
        <span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border border-border/70 bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="size-4 text-primary" aria-hidden="true" />
          <input
            name="q"
            type="search"
            defaultValue={search.q}
            placeholder="Phone repair, catering…"
            className="h-10 w-full bg-transparent text-sm outline-none"
          />
        </span>
      </label>

      <label className="block">
        <span className="eyebrow text-muted-foreground">City</span>
        <select
          name="location"
          defaultValue={search.location ?? ""}
          className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Every city</option>
          {taxonomy.taxonomy.locations.map((location) => (
            <option key={location.slug} value={location.slug}>
              {location.name} ({location.businessCount})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow text-muted-foreground">Category</span>
        <select
          name="category"
          defaultValue={search.category ?? ""}
          className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Every category</option>
          {taxonomy.taxonomy.categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name} ({category.businessCount})
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="eyebrow text-muted-foreground">Minimum rating</span>
        <select
          name="minRating"
          defaultValue={String(search.minRating)}
          className="mt-2 h-11 w-full rounded-xl border border-border/70 bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="0">Any rating</option>
          <option value="3">3.0 and above</option>
          <option value="4">4.0 and above</option>
          <option value="4.5">4.5 and above</option>
        </select>
      </label>

      <div className="space-y-3 border-t border-border/60 pt-5">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="verified"
            value="true"
            defaultChecked={search.verified}
            className="size-4 accent-primary"
          />
          Verified profiles only
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="openNow"
            value="true"
            defaultChecked={search.openNow}
            className="size-4 accent-primary"
          />
          Open right now
        </label>
      </div>

      <input type="hidden" name="sort" value={search.sort} />
      <Button type="submit" className="w-full">
        <Filter /> Apply filters
      </Button>
      <Button asChild variant="ghost" className="w-full">
        <Link to="/search" search={{ page: 1 }}>
          Clear all
        </Link>
      </Button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

function SearchPending() {
  return (
    <PublicShell>
      <PageHead eyebrow="Directory" title="Finding the best routes…" />
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-14 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-80 animate-pulse rounded-3xl bg-muted" />
        ))}
      </div>
    </PublicShell>
  );
}

function SearchPage() {
  const search = directoryQuerySchema.parse(Route.useSearch());
  const { results } = Route.useLoaderData();
  const { available, result } = results;
  const { items, pagination } = result;

  const activeFilterCount = [
    search.q,
    search.category,
    search.location,
    search.verified,
    search.openNow,
    search.minRating,
  ].filter(Boolean).length;

  return (
    <PublicShell>
      <PageHead
        eyebrow="Directory"
        title={search.q ? `Results for “${search.q}”` : "Find a business"}
        subtitle="Only reviewed, published listings appear here. Use the filters to narrow the route without losing useful context."
        action={
          <Button asChild>
            <Link to="/join">List your business</Link>
          </Button>
        }
      />

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[19rem_1fr]">
        <aside className="hidden h-fit lg:sticky lg:top-28 lg:block">
          <form
            action="/search"
            method="get"
            className="rounded-3xl border border-border/70 bg-card p-5"
          >
            <div className="mb-5 flex items-center gap-2 border-b border-border/60 pb-4 font-bold">
              <SlidersHorizontal className="size-4 text-primary" /> Refine results
            </div>
            <FilterFields />
          </form>
        </aside>

        <section aria-labelledby="results-heading" className="min-w-0">
          <div className="mb-6">
            <SearchBox initialQuery={search.q} />
          </div>

          <details className="mb-6 rounded-3xl border border-border/70 bg-card p-4 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between font-bold">
              <span className="flex items-center gap-2">
                <SlidersHorizontal className="size-4 text-primary" /> Filters
              </span>
              {activeFilterCount ? (
                <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
                  {activeFilterCount}
                </span>
              ) : null}
            </summary>
            <form action="/search" method="get" className="mt-5 border-t border-border/60 pt-5">
              <FilterFields />
            </form>
          </details>

          {!available ? (
            <div
              className="mb-6 flex gap-3 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"
              role="status"
            >
              <WifiOff className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
              <div>
                <p className="font-bold">The live directory is temporarily unavailable.</p>
                <p className="mt-1 text-muted-foreground">
                  No placeholder records are substituted for live listings. Please try again
                  shortly.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mb-6 flex flex-col gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-primary">Current results</p>
              <h2 id="results-heading" className="mt-2 text-2xl font-bold">
                {pagination.total.toLocaleString()}{" "}
                {pagination.total === 1 ? "business" : "businesses"}
              </h2>
            </div>
            <form action="/search" method="get" className="flex items-center gap-2">
              {search.q ? <input type="hidden" name="q" value={search.q} /> : null}
              {search.category ? (
                <input type="hidden" name="category" value={search.category} />
              ) : null}
              {search.location ? (
                <input type="hidden" name="location" value={search.location} />
              ) : null}
              {search.verified ? <input type="hidden" name="verified" value="true" /> : null}
              {search.openNow ? <input type="hidden" name="openNow" value="true" /> : null}
              {search.minRating ? (
                <input type="hidden" name="minRating" value={search.minRating} />
              ) : null}
              <label htmlFor="sort" className="text-xs font-bold text-muted-foreground">
                Sort
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={search.sort}
                onChange={(event) => event.currentTarget.form?.requestSubmit()}
                className="h-10 rounded-xl border border-border/70 bg-background px-3 text-sm font-semibold"
              >
                <option value="relevance">Best match</option>
                <option value="rating">Highest rated</option>
                <option value="recent">Recently published</option>
                <option value="name">Name A–Z</option>
              </select>
            </form>
          </div>

          {items.length ? (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((business, index) => (
                <Reveal key={business.id} delay={index % 3} className="h-full">
                  <BusinessCard business={business} />
                </Reveal>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={<Store className="size-7" />}
              title="No published match yet"
              body="Broaden a filter, search another phrase, or suggest a business our review team should add."
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <Button asChild>
                    <Link to="/search" search={{ page: 1 }}>
                      Clear filters
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/suggest-business">Suggest a business</Link>
                  </Button>
                </div>
              }
            />
          )}

          {pagination.pages > 1 ? (
            <nav
              aria-label="Search result pages"
              className="mt-9 flex items-center justify-between border-t border-border/60 pt-6"
            >
              {search.page > 1 ? (
                <Button asChild variant="outline">
                  <Link to="/search" search={{ ...search, page: search.page - 1 }}>
                    <ArrowLeft /> Previous
                  </Link>
                </Button>
              ) : (
                <span />
              )}
              <span className="text-sm text-muted-foreground">
                Page <strong className="text-foreground">{search.page}</strong> of{" "}
                {pagination.pages}
              </span>
              {search.page < pagination.pages ? (
                <Button asChild variant="outline">
                  <Link to="/search" search={{ ...search, page: search.page + 1 }}>
                    Next <ArrowRight />
                  </Link>
                </Button>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </section>
      </div>
    </PublicShell>
  );
}
