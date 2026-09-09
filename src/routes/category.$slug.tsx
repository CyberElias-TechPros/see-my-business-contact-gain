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
  category: Taxonomy["categories"][number];
  results: DirectoryResponse;
};

/**
 * `/category/$slug` is the page a Google query like "phone repair lagos" is supposed to land on,
 * so it must (a) exist for real categories only — an unknown slug returns 404 rather than
 * quietly rendering the first category in the list, and (b) contain the listings in HTML, not
 * behind a client fetch.
 */
export const Route = createFileRoute("/category/$slug")({
  // See routes/locations.$slug.tsx: `head`'s parameter must be annotated by hand, or TypeScript
  // stops inferring this route's loader return type.
  head: ({ params, loaderData }: { params: { slug: string }; loaderData?: unknown }) => {
    const data = loaderData as LoaderData | undefined;
    const name = data ? data.category.name : titleCase(params.slug);
    return {
      meta: [
        { title: `${name} in Nigeria — verified listings | GainHub NG` },
        {
          name: "description",
          content:
            "Compare businesses in this category: photos, prices, opening hours and reviews from customers, then message on WhatsApp or send an enquiry.",
        },
        { name: "robots", content: "index,follow,max-snippet:-1,max-image-preview:large" },
      ],
      links: [{ rel: "canonical", href: `/category/${data ? data.category.slug : params.slug}` }],
    };
  },
  validateSearch: (raw: Record<string, unknown>) => browseParams.parse(raw),
  loader: async ({ context, params, location: routeLocation }): Promise<LoaderData> => {
    const { page } = browseParams.parse(routeLocation.search);
    const [taxonomy, results] = await Promise.all([
      context.queryClient.ensureQueryData(taxonomyQuery()),
      context.queryClient.ensureQueryData(
        directoryQuery({ category: params.slug, perPage: 24, page }),
      ),
    ]);
    const category = taxonomy.categories.find((entry) => entry.slug === params.slug);
    if (!category) {
      // A real 404 status, so a delisted category leaves the index instead of competing with
      // every other category page for the same query.
      throw notFound();
    }
    return { category, results };
  },
  component: CategoryPage,
});

function titleCase(slug: string): string {
  return slug
    .split("-")
    .map((word) => (word ? word[0]!.toUpperCase() + word.slice(1) : word))
    .join(" ");
}

function CategoryPage() {
  const { category, results } = Route.useLoaderData();
  const { slug } = Route.useParams();
  const items = results.items.map(toCardBusiness);
  const citiesWithStock = results.facets.locations;

  return (
    <PublicShell>
      <PageHead
        eyebrow="Category"
        title={category.name}
        subtitle={
          results.meta.total === 0
            ? `No published ${category.name.toLowerCase()} listing yet. New ones usually appear within a day of being written.`
            : `${results.meta.total.toLocaleString("en-NG")} ${results.meta.total === 1 ? "listing" : "listings"} — ${category.description}`
        }
        action={
          <Button asChild>
            <Link to="/join" search={{ category: slug }}>
              List in this category
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <nav aria-label="Ways to narrow this category" className="flex flex-wrap gap-2">
          <Link to="/search" search={{ category: slug, openNow: "1" }}>
            <Badge variant="outline" className="bg-card px-3 py-1">
              Open now
            </Badge>
          </Link>
          <Link to="/search" search={{ category: slug, verified: "1" }}>
            <Badge variant="outline" className="bg-card px-3 py-1">
              Verified only
            </Badge>
          </Link>
          <Link to="/search" search={{ category: slug, sort: "rating" }}>
            <Badge variant="outline" className="bg-card px-3 py-1">
              Highest rated
            </Badge>
          </Link>
          <Link to="/search" search={{ category: slug, sort: "response" }}>
            <Badge variant="outline" className="bg-card px-3 py-1">
              Fastest to reply
            </Badge>
          </Link>
        </nav>

        {items.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="space-y-3 p-8 text-center">
              <h2 className="font-display text-lg font-semibold">This category is empty</h2>
              <p className="mx-auto max-w-md text-sm text-muted-foreground">
                It is open for business owners: a listing here is free, and it appears in this
                category plus every search a customer runs for it.
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button asChild size="sm">
                  <Link to="/join" search={{ category: slug }}>
                    Add your business
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/search">Browse the whole directory</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
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
          basePath={`/category/${slug}`}
        />

        {citiesWithStock.length > 0 ? (
          <Card className="card-surface">
            <CardContent className="p-6">
              <h2 className="text-lg font-semibold">{category.name} by city</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Only cities with at least one listing in this category are listed — the number is
                that city’s count, not a promise.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {citiesWithStock.map((city) => (
                  <Link
                    key={city.slug}
                    to="/search"
                    search={{ category: slug, location: city.slug }}
                    className="inline-flex items-center gap-2 rounded-full border bg-secondary/40 px-3 py-1 text-sm hover:border-primary/40"
                  >
                    {city.name}
                    <span className="tabular-nums text-xs text-muted-foreground">{city.count}</span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="card-surface">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">What to check before you pay</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {category.checklist.length > 0 ? (
                <li className="list-none">
                  <span className="sr-only">What this category is expected to publish: </span>
                  <span className="font-medium text-foreground">
                    {category.name} listings are expected to: {category.checklist.join("; ")}.
                  </span>
                </li>
              ) : null}
              <li>Confirm the verification badge and read the most recent reviews.</li>
              <li>Ask for a written quote on WhatsApp before making any transfer.</li>
              <li>Report any listing that requests upfront payment to a personal account.</li>
            </ul>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild size="sm" variant="outline">
                <Link to="/trust-safety">How verification works</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/suggest-business">Suggest a missing business</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
