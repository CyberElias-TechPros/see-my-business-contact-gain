import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef } from "react";
import { Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { z } from "zod";
import { BusinessCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Pagination } from "@/components/site/Pagination.tsx";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import {
  directoryQuery,
  searchParamsToFilters,
  taxonomyQuery,
  toCardBusiness,
  type Taxonomy,
} from "@/lib/queries.ts";
import type { DirectoryResponse } from "../../shared/api.ts";
import { cn } from "@/lib/utils";
import type { DirectorySort } from "../../shared/api.ts";

/**
 * The URL is the state: `?q=&category=&location=&sort=&minRating=&openNow=&verified=&page=`.
 * Shareable, back-button-correct, and it means the first paint is already the filtered page —
 * a client-only filter (which the prototype had) renders the wrong list to a crawler and to a
 * slow connection.
 */
const ALL = "all";

/**
 * Every key is optional in *and* out: `.default()` here would make the parsed object require
 * `sort`/`page`, which in turn makes every `<Link to="/search">` demand an explicit `search`
 * prop and pushes nonsense `?page=1&sort=relevance` into canonical URLs. Defaults belong in
 * `searchParamsToFilters` in `src/lib/queries.ts`, where they cannot leak into the router's types.
 */
const searchParams = z.object({
  q: z.string().trim().max(120).optional(),
  category: z.string().max(60).optional(),
  location: z.string().max(60).optional(),
  sort: z.enum(["relevance", "rating", "reviews", "newest", "response"]).optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  openNow: z.enum(["1"]).optional(),
  verified: z.enum(["1"]).optional(),
  amenity: z.string().max(40).optional(),
  page: z.coerce.number().int().min(1).max(1000).optional(),
});

export type SearchParams = z.output<typeof searchParams>;

export const Route = createFileRoute("/search")({
  // `loader` is declared before `head` on purpose. `head`'s context type mentions the loader's
  // return type, and a `head` that touches `loaderData` (or is even merely checked against that
  // context) makes TypeScript give up on inferring `TLoaderFn` — every `useLoaderData()` in the
  // file then collapses to `undefined`. Annotating `head`'s parameter breaks the cycle.
  head: ({ match }: { match: { search: unknown } }) => {
    const search = match.search as Partial<SearchParams>;
    const page = search.page ?? 1;
    const title = search.q
      ? `“${search.q}” — Nigerian businesses | GainHub NG`
      : search.category
        ? `${titleCase(search.category)} in Nigeria | GainHub NG`
        : "Find verified Nigerian businesses | GainHub NG";
    return {
      meta: [
        { title },
        {
          name: "description",
          content:
            "Filter Nigerian businesses by category, city, rating and opening hours, then message them on WhatsApp or send an enquiry straight from the results.",
        },
        // Page 2+ of a filtered list adds nothing for a crawler; keep it out of the index and
        // point the crawl budget at listing and category pages instead.
        { name: "robots", content: page > 1 ? "noindex,follow" : "index,follow,nocache" },
      ],
      links: [{ rel: "canonical", href: canonicalFor(search) }],
    };
  },
  validateSearch: (raw: Record<string, unknown>) => searchParams.parse(raw),
  loader: async ({
    context,
    location,
  }): Promise<{
    filters: Partial<SearchParams>;
    results: DirectoryResponse;
    taxonomy: Taxonomy;
  }> => {
    const filters = searchParamsToFilters(location.search as Partial<SearchParams>);
    const [results, taxonomy] = await Promise.all([
      context.queryClient.ensureQueryData(directoryQuery(filters)),
      context.queryClient.ensureQueryData(taxonomyQuery()),
    ]);
    return { filters: location.search as Partial<SearchParams>, results, taxonomy };
  },
  component: SearchPage,
});

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function canonicalFor(raw: unknown): string {
  const parsed = searchParams.safeParse(raw);
  if (!parsed.success) return "/search";
  const value = parsed.data as Partial<SearchParams>;
  const params = new URLSearchParams();
  if (value.q) params.set("q", value.q);
  if (value.category) params.set("category", value.category);
  if (value.location) params.set("location", value.location);
  if (value.sort && value.sort !== "relevance") params.set("sort", value.sort);
  if (value.minRating) params.set("minRating", String(value.minRating));
  if (value.openNow) params.set("openNow", "1");
  if (value.verified) params.set("verified", "1");
  if (value.page && value.page > 1) params.set("page", String(value.page));
  const query = params.toString();
  return `/search${query ? `?${query}` : ""}`;
}

function SearchPage() {
  const { filters, results, taxonomy } = Route.useLoaderData();
  const navigate = useNavigate();
  const update = (patch: Partial<SearchParams>) =>
    navigate({
      to: "/search",
      search: (previous) => ({ ...previous, page: 1, ...patch }) as Partial<SearchParams>,
      replace: false,
    });

  const active = [
    filters.q ? { key: "q", label: `“${filters.q}”` } : null,
    filters.category
      ? {
          key: "category",
          label:
            taxonomy.categories.find((c) => c.slug === filters.category)?.name ?? filters.category,
        }
      : null,
    filters.location
      ? {
          key: "location",
          label:
            taxonomy.locations.find((l) => l.slug === filters.location)?.name ?? filters.location,
        }
      : null,
    filters.minRating ? { key: "minRating", label: `${filters.minRating}★ and up` } : null,
    filters.openNow ? { key: "openNow", label: "Open now" } : null,
    filters.verified ? { key: "verified", label: "Verified only" } : null,
  ].filter(Boolean) as { key: keyof SearchParams; label: string }[];

  const items = results.items.map(toCardBusiness);
  const total = results.meta.total;

  return (
    <PublicShell>
      <a
        href="#results"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to results
      </a>
      <PageHead
        eyebrow="Directory"
        title={filters.q ? `Results for “${filters.q}”` : "Find a business you can actually reach"}
        subtitle={
          total === 0
            ? "Nothing matched that combination — try widening the filters."
            : `${total.toLocaleString("en-NG")} ${total === 1 ? "listing" : "listings"} match — each with the contact details its owner chose to publish, and the reviews customers actually left.`
        }
      />

      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[280px_1fr]">
        <FiltersAside
          search={filters}
          taxonomy={taxonomy}
          facets={results.facets}
          onChange={update}
          onClear={() =>
            update({
              q: "",
              category: "",
              location: "",
              minRating: undefined,
              openNow: undefined,
              verified: undefined,
            })
          }
        />

        <div id="results" className="min-w-0 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Sorted by</span>
              <Select
                value={filters.sort ?? "relevance"}
                onValueChange={(sort) => update({ sort: sort as SearchParams["sort"] })}
              >
                <SelectTrigger className="h-8 w-[170px]" aria-label="Sort results">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Most relevant</SelectItem>
                  <SelectItem value="rating">Highest rated</SelectItem>
                  <SelectItem value="reviews">Most reviewed</SelectItem>
                  <SelectItem value="newest">Recently joined</SelectItem>
                  <SelectItem value="response">Fastest to reply</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {active.length > 0 ? (
              <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
                {active.map((chip) => (
                  <li key={chip.key}>
                    <button
                      type="button"
                      onClick={() =>
                        update({
                          [chip.key]:
                            chip.key === "q" || chip.key === "category" || chip.key === "location"
                              ? ""
                              : undefined,
                        } as Partial<SearchParams>)
                      }
                      className="inline-flex items-center gap-1 rounded-full border bg-secondary/50 px-2.5 py-1 text-xs hover:border-primary/40"
                    >
                      {chip.label}
                      <X className="size-3" aria-hidden="true" />
                      <span className="sr-only">Remove filter</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {results.ambiguousQuery ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                <p className="text-muted-foreground">
                  That search was too short to filter on, so this is the full category order. Type
                  two or three letters of a trade name — “adire”, “screen”, “pharmacy” — for a
                  narrower list.
                </p>
                <Link to="/suggest-business" className="font-medium text-primary hover:underline">
                  Missing a business? Add it
                </Link>
              </CardContent>
            </Card>
          ) : null}

          {items.length === 0 ? (
            <EmptyState
              filters={filters}
              onClear={() => update({ q: "", category: "", location: "" })}
            />
          ) : (
            <ul className={cn("grid gap-5", "sm:grid-cols-2 2xl:grid-cols-3")} role="list">
              {items.map((business) => (
                <li key={business.id}>
                  <BusinessCard business={business} />
                </li>
              ))}
            </ul>
          )}

          <Pagination
            page={results.meta.page}
            totalPages={results.meta.totalPages}
            basePath={canonicalFor(filters)}
            onPage={(page) => update({ page })}
          />
        </div>
      </div>
    </PublicShell>
  );
}

function FiltersAside({
  search,
  taxonomy,
  facets,
  onChange,
  onClear,
}: {
  search: Partial<SearchParams>;
  taxonomy: Taxonomy;
  facets: {
    categories: { slug: string; name: string; count: number }[];
    locations: { slug: string; name: string; count: number }[];
  };
  onChange: (patch: Partial<SearchParams>) => void;
  onClear: () => void;
}) {
  const value = search;
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <aside aria-label="Search filters" className="space-y-6 lg:sticky lg:top-20 lg:self-start">
      <Card className="card-surface">
        <CardContent className="space-y-5 p-5">
          {/* Submitting reads the field, so typing never re-renders the whole filtered page
              (and never pushes a URL per keystroke) while the value still round-trips on reload. */}
          <form
            ref={formRef}
            className="space-y-2"
            onSubmit={(event) => {
              event.preventDefault();
              const field = new FormData(event.currentTarget).get("q");
              onChange({ q: typeof field === "string" ? field : "" });
            }}
          >
            <Label htmlFor="q" className="text-xs uppercase tracking-wide text-muted-foreground">
              Keyword
            </Label>
            <div className="relative mt-2">
              <SearchIcon
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                id="q"
                name="q"
                defaultValue={value.q ?? ""}
                placeholder="iPhone screen, adire, pharmacist…"
                className="pl-9"
                autoComplete="off"
              />
            </div>
            <Button type="submit" size="sm" variant="secondary" className="w-full">
              Search
            </Button>
          </form>

          <Separator />

          <FacetGroup
            label="Category"
            selected={value.category ?? ""}
            options={facets.categories.map((entry) => ({
              slug: entry.slug,
              name: entry.name,
              count: entry.count,
            }))}
            onSelect={(slug) => onChange({ category: slug })}
            emptyLabel="All of Nigeria"
          />

          <FacetGroup
            label="Location"
            selected={value.location ?? ""}
            options={facets.locations.map((entry) => ({
              slug: entry.slug,
              name: entry.name,
              count: entry.count,
            }))}
            onSelect={(slug) => onChange({ location: slug })}
            emptyLabel="All cities"
          />

          {taxonomy.categories.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Facets appear as soon as there are published listings to group.
            </p>
          ) : null}

          <Separator />

          <div className="space-y-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Minimum rating</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Minimum rating">
              {[0, 3, 3.5, 4, 4.5].map((rating) => (
                <Button
                  key={rating}
                  size="sm"
                  variant={(value.minRating ?? 0) === rating ? "default" : "outline"}
                  aria-pressed={(value.minRating ?? 0) === rating}
                  onClick={() => onChange({ minRating: rating === 0 ? undefined : rating })}
                >
                  {rating === 0 ? "Any" : `${rating}★+`}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="open-now" className="text-sm">
                Open now
              </Label>
              <Switch
                id="open-now"
                checked={value.openNow === "1"}
                onCheckedChange={(on) => onChange({ openNow: on ? "1" : undefined })}
              />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="verified-only" className="text-sm">
                Verified only
              </Label>
              <Switch
                id="verified-only"
                checked={value.verified === "1"}
                onCheckedChange={(on) => onChange({ verified: on ? "1" : undefined })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1">
            <Button size="sm" variant="ghost" onClick={onClear}>
              Clear filters
            </Button>
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
          </div>
        </CardContent>
      </Card>
    </aside>
  );
}

/**
 * Facets are links, not `<select>` widgets: a crawler can follow "Phone & Gadget Repair (41)"
 * without executing JavaScript, the back button works, and the URL a user shares is the URL they
 * are looking at. Counts come from the API's own facet query, so they always match the result set.
 */
function FacetGroup({
  label,
  options,
  selected,
  onSelect,
  emptyLabel,
}: {
  label: string;
  options: { slug: string; name: string; count: number }[];
  selected: string;
  onSelect: (slug: string) => void;
  emptyLabel: string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <ul className="max-h-56 space-y-0.5 overflow-y-auto pr-1" role="list">
        <li>
          <button
            type="button"
            onClick={() => onSelect("")}
            aria-pressed={selected === ""}
            className={cn(
              "w-full rounded-md px-2 py-1 text-left text-sm hover:bg-secondary",
              selected === "" && "bg-secondary font-medium",
            )}
          >
            {emptyLabel}
          </button>
        </li>
        {options.map((option) => (
          <li key={option.slug}>
            <button
              type="button"
              onClick={() => onSelect(option.slug)}
              aria-pressed={selected === option.slug}
              className={cn(
                "flex w-full items-baseline justify-between gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-secondary",
                selected === option.slug && "bg-secondary font-medium",
              )}
            >
              <span className="truncate">{option.name}</span>
              <span className="tabular-nums text-xs text-muted-foreground">{option.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState({ filters, onClear }: { filters: Partial<SearchParams>; onClear: () => void }) {
  return (
    <Card className="border-dashed">
      <CardContent className="space-y-3 p-8 text-center">
        <h2 className="font-display text-lg font-semibold">No listing matched that</h2>
        <p className="mx-auto max-w-md text-sm text-muted-foreground">
          {filters.openNow
            ? "“Open now” uses each listing’s own opening hours, so a shop that closes at 6pm disappears after 6pm. "
            : ""}
          {filters.q ? `Nothing contains “${filters.q}”. ` : ""}
          Traders in your area can join in a few minutes — and a listing you add here is free.
        </p>
        <div className="flex flex-wrap justify-center gap-2 pt-1">
          <Button size="sm" onClick={onClear}>
            Clear filters
          </Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/join">List your business</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
