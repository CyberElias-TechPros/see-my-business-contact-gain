import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Plus, Search, Trash2, WifiOff } from "lucide-react";
import { z } from "zod";
import { Stars, VerifiedBadge } from "@/components/kit";
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
    const [profiles, matches] = await Promise.all([
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
    ]);
    return { ids, profiles, matches };
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

function ComparePage() {
  const search = Route.useSearch();
  const { ids, profiles, matches } = Route.useLoaderData();
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

  return (
    <PublicShell>
      <PageHead
        eyebrow="Shortlist"
        title="Compare what profiles actually publish."
        subtitle="Choose up to three live listings. Your selection stays in the page URL, so it can be shared without an account or hidden browser storage."
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <Card className="card-surface">
          <CardContent className="p-6">
            <form method="get" action="/compare" className="flex flex-col gap-3 sm:flex-row">
              {searchIds ? <input type="hidden" name="ids" value={searchIds} /> : null}
              <label className="flex-1">
                <span className="sr-only">Search for a business to compare</span>
                <Input
                  name="q"
                  defaultValue={search.q ?? ""}
                  minLength={2}
                  maxLength={100}
                  placeholder="Search business name or service"
                />
              </label>
              <Button type="submit">
                <Search aria-hidden="true" /> Find a profile
              </Button>
            </form>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">
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
          <Card className="card-surface border-dashed">
            <CardContent className="p-9 text-center">
              <h2 className="text-xl font-semibold">Your shortlist is empty.</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
                Search above by business name or service, then add current published profiles. No
                fictional providers are selected for you.
              </p>
            </CardContent>
          </Card>
        )}

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
                    <Card key={business.id} className="card-surface">
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
