import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { z } from "zod";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { BusinessCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pagination } from "@/components/site/Pagination.tsx";
import { directoryQuery, taxonomyQuery, toCardBusiness } from "@/lib/queries.ts";
import type { Taxonomy } from "@/lib/queries.ts";
import type { DirectoryResponse } from "../../shared/api.ts";

/** `?page=2` is part of these pages' contract: the pagination links below are plain <a> hrefs,
 * so the loader has to honour them or a crawler would be sent to page 1 wearing page 2’s URL. */
const browseParams = z.object({
  page: z.coerce.number().int().min(1).max(200).optional(),
});

type LoaderData = {
  location: Taxonomy["locations"][number];
  results: DirectoryResponse;
};

export const Route = createFileRoute("/locations/$slug")({
  // `head`'s parameter is annotated by hand because `head` and `loader` are mutually recursive
  // generics: left to inference, a route declaring both loses the loader's return type and every
  // `useLoaderData()` in the file becomes `undefined`. The annotation is also what lets the
  // visitor-facing <h1> wording ("Businesses in Lagos") come from real data instead of the slug.
  head: ({ params, loaderData }: { params: { slug: string }; loaderData?: unknown }) => {
    const data = loaderData as LoaderData | undefined;
    const name = data?.location.name ?? "Nigeria";
    return {
      meta: [
        { title: `Businesses in ${name} — verified local listings | GainHub NG` },
        {
          name: "description",
          content:
            "Trusted local businesses, grouped by area and category, with reviews, opening hours and direct WhatsApp contact.",
        },
        { name: "robots", content: "index,follow,max-snippet:-1,max-image-preview:large" },
      ],
      links: [{ rel: "canonical", href: `/locations/${data ? data.location.slug : params.slug}` }],
    };
  },
  validateSearch: (raw: Record<string, unknown>) => browseParams.parse(raw),
  loader: async ({ context, params, location: routeLocation }): Promise<LoaderData> => {
    const { page } = browseParams.parse(routeLocation.search);
    const [taxonomy, results] = await Promise.all([
      context.queryClient.ensureQueryData(taxonomyQuery()),
      context.queryClient.ensureQueryData(
        directoryQuery({ location: params.slug, perPage: 24, page }),
      ),
    ]);
    const found = taxonomy.locations.find((entry) => entry.slug === params.slug);
    if (!found) throw notFound();
    return { location: found, results };
  },
  component: LocationPage,
});

function LocationPage() {
  const { location, results } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const items = results.items.map(toCardBusiness);

  return (
    <PublicShell>
      <PageHead
        eyebrow="Location"
        title={`Businesses in ${location.name}`}
        subtitle={
          results.meta.total === 0
            ? `Nothing is published in ${location.name} yet. The areas below are where traders usually start.`
            : `${results.meta.total.toLocaleString("en-NG")} ${results.meta.total === 1 ? "listing" : "listings"} across ${location.state}, most of them replying on WhatsApp within the hour.`
        }
        action={
          <Button asChild variant="outline">
            <Link to="/join">Add your business here</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <Card className="card-surface">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Areas in {location.name}
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {location.areas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No areas recorded for this location yet.
                </p>
              ) : (
                location.areas.map((area) => (
                  <Link
                    key={area}
                    to="/search"
                    search={{ location: slug, q: area }}
                    className="rounded-full border bg-card px-3 py-1 text-sm hover:border-primary/40"
                  >
                    {area}
                  </Link>
                ))
              )}
            </div>

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Categories with listings here
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {results.facets.categories.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing indexed in this city yet — browse the full directory instead.
                </p>
              ) : (
                results.facets.categories.map((category) => (
                  <Link
                    key={category.slug}
                    to="/search"
                    search={{ location: slug, category: category.slug }}
                    className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-sm hover:border-primary/40"
                  >
                    {category.name}
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {category.count}
                    </span>
                  </Link>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="space-y-3 p-8 text-center">
              <h2 className="font-display text-lg font-semibold">
                No listing in {location.name} yet
              </h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                If you trade here, this page is the cheapest place to be found. A free profile takes
                a few minutes and appears in this city’s browse pages immediately.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link to="/join">List your business</Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/categories">Browse categories</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
              {items.map((business) => (
                <li key={business.id}>
                  <BusinessCard business={business} />
                </li>
              ))}
            </ul>
            <Pagination
              page={results.meta.page}
              totalPages={results.meta.totalPages}
              basePath={`/locations/${slug}`}
            />
          </>
        )}

        <div className="flex flex-wrap gap-2">
          <Link to="/locations">
            <Badge variant="secondary">All locations</Badge>
          </Link>
          <Link to="/categories">
            <Badge variant="secondary">All categories</Badge>
          </Link>
        </div>
      </div>
    </PublicShell>
  );
}
