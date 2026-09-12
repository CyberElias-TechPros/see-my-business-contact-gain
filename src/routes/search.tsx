import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Filter,
  Search,
  SlidersHorizontal,
  Store,
  WifiOff,
} from "lucide-react";
import { z } from "zod";
import { BusinessCard } from "@/components/kit";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { categories, locations } from "@/data/mock";
import { directoryQuerySchema } from "@/lib/contracts";
import { getDirectoryResults } from "@/lib/directory.functions";

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
  loader: ({ deps }) => getDirectoryResults({ data: { ...deps, pageSize: 12 } }),
  head: () => ({
    meta: [
      { title: "Search Nigerian businesses by service and city — GainHub NG" },
      {
        name: "description",
        content:
          "Search reviewed Nigerian business listings by service, category, city, verification level and availability.",
      },
      { property: "og:title", content: "Find a local business — GainHub NG" },
      {
        property: "og:description",
        content:
          "Use practical filters, compare useful profile details and start a conversation with the right provider.",
      },
    ],
  }),
  pendingComponent: SearchPending,
  component: SearchPage,
});

function FilterFields() {
  const search = directoryQuerySchema.parse(Route.useSearch());
  return (
    <div className="space-y-5">
      <label className="block">
        <span className="eyebrow text-muted-foreground">What do you need?</span>
        <span className="mt-2 flex min-h-11 items-center gap-2 rounded-xl border bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
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
        <span className="eyebrow text-muted-foreground">City hub</span>
        <select
          name="location"
          defaultValue={search.location ?? ""}
          className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Every city</option>
          {locations.map((location) => (
            <option key={location.slug} value={location.slug}>
              {location.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="eyebrow text-muted-foreground">Category</span>
        <select
          name="category"
          defaultValue={search.category ?? ""}
          className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="">Every category</option>
          {categories.map((category) => (
            <option key={category.slug} value={category.slug}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="eyebrow text-muted-foreground">Minimum rating</span>
        <select
          name="minRating"
          defaultValue={String(search.minRating)}
          className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="0">Any rating</option>
          <option value="3">3.0 and above</option>
          <option value="4">4.0 and above</option>
          <option value="4.5">4.5 and above</option>
        </select>
      </label>
      <div className="space-y-3 border-t pt-5">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-background px-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="verified"
            value="true"
            defaultChecked={search.verified}
            className="size-4 accent-primary"
          />
          Verified profiles only
        </label>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border bg-background px-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="openNow"
            value="true"
            defaultChecked={search.openNow}
            className="size-4 accent-primary"
          />
          Open now
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

function SearchPending() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Directory"
        title="Finding the best routes…"
        subtitle="Checking current listings and filters."
      />
      <div className="mx-auto grid max-w-7xl gap-5 px-5 py-12 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="card-surface h-80 animate-pulse bg-muted" />
        ))}
      </div>
    </PublicShell>
  );
}

function SearchPage() {
  const search = directoryQuerySchema.parse(Route.useSearch());
  const { available, result } = Route.useLoaderData();
  const { items, pagination } = result;
  const activeFilterCount = [
    search.q,
    search.category,
    search.location,
    search.verified,
    search.openNow,
    search.minRating,
  ].filter(Boolean).length;
  const noun = pagination.total === 1 ? "business" : "businesses";

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
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 lg:grid-cols-[18rem_1fr]">
        <aside className="hidden h-fit lg:block">
          <form action="/search" method="get" className="card-surface p-5">
            <div className="mb-5 flex items-center gap-2 border-b pb-4 font-bold">
              <SlidersHorizontal className="size-4 text-primary" /> Refine results
            </div>
            <FilterFields />
          </form>
        </aside>

        <section aria-labelledby="results-heading">
          <details className="card-surface mb-5 p-4 lg:hidden">
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
            <form action="/search" method="get" className="mt-5 border-t pt-5">
              <FilterFields />
            </form>
          </details>

          {!available ? (
            <div
              className="mb-6 flex gap-3 rounded-2xl border border-warning/35 bg-warning/10 p-4 text-sm"
              role="status"
            >
              <WifiOff className="mt-0.5 size-5 shrink-0 text-warning-foreground" />
              <div>
                <p className="font-bold">The live directory is temporarily unavailable.</p>
                <p className="mt-1 text-muted-foreground">
                  No preview records are substituted for live listings. Please try again shortly.
                </p>
              </div>
            </div>
          ) : null}

          <div className="mb-6 flex flex-col gap-3 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-primary">Current results</p>
              <h2 id="results-heading" className="mt-2 text-2xl font-bold">
                {pagination.total.toLocaleString()} {noun}
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
                className="h-10 rounded-xl border bg-background px-3 text-sm font-semibold"
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
              {items.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>
          ) : (
            <Card className="card-surface border-dashed">
              <CardContent className="grid min-h-80 place-items-center p-8 text-center">
                <div>
                  <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
                    <Store className="size-6" />
                  </span>
                  <h3 className="mt-5 text-2xl font-bold">No published match yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                    Broaden a filter, search another phrase, or suggest a business our review team
                    should add.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-3">
                    <Button asChild>
                      <Link to="/search" search={{ page: 1 }}>
                        Clear filters
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/suggest-business">Suggest a business</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {pagination.pages > 1 ? (
            <nav
              aria-label="Search result pages"
              className="mt-8 flex items-center justify-between border-t pt-6"
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
