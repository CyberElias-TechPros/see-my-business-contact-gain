import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Search, ShieldCheck, Store, WifiOff } from "lucide-react";
import { BusinessCard, EmptyState } from "@/components/kit";
import { Reveal } from "@/components/motion";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { directoryQuerySchema } from "@/lib/contracts";
import { getDirectoryResults, getDirectoryTaxonomy } from "@/lib/directory.functions";

export const Route = createFileRoute("/category/$slug")({
  loader: async ({ params }) => {
    const taxonomy = await getDirectoryTaxonomy();
    // Only a real, active taxonomy slug is a page. Anything else is a 404 rather
    // than an empty page that could be indexed.
    const category = taxonomy.taxonomy.categories.find((item) => item.slug === params.slug);
    if (!category) throw notFound();
    const results = await getDirectoryResults({
      data: {
        ...directoryQuerySchema.parse({}),
        category: params.slug,
        sort: "relevance",
        page: 1,
        pageSize: 12,
      },
    });
    return { category, results, locations: taxonomy.taxonomy.locations };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.category.name ?? "Businesses";
    return {
      meta: [
        { title: `${name} in Nigeria — GainHub NG` },
        {
          name: "description",
          content: `Browse currently published ${name.toLowerCase()} listings in Nigeria, compare useful profile details and contact a suitable provider.`,
        },
        { property: "og:title", content: `${name} in Nigeria — GainHub NG` },
        {
          property: "og:description",
          content: `Explore current ${name.toLowerCase()} listings and narrow the directory by Nigerian city.`,
        },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { category, results, locations } = Route.useLoaderData();
  const { available, result } = results;

  return (
    <PublicShell>
      <PageHead
        eyebrow="Category"
        title={category.name}
        subtitle={category.description}
        action={
          <Button asChild>
            <Link to="/join">Add your business</Link>
          </Button>
        }
      />

      <div className="mx-auto max-w-7xl space-y-12 px-5 py-14">
        {!available ? (
          <Card className="rounded-3xl border-warning/40 bg-warning/8">
            <CardContent className="flex gap-4 p-6">
              <WifiOff
                className="mt-1 size-5 shrink-0 text-warning-foreground"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-semibold">The live directory is temporarily unavailable.</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We have not substituted placeholder records. Please try this category again
                  shortly.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : result.items.length > 0 ? (
          <section aria-labelledby="category-results">
            <Reveal>
              <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="eyebrow text-primary">Current directory</p>
                  <h2 id="category-results" className="mt-2 text-2xl font-bold">
                    {result.pagination.total}{" "}
                    {result.pagination.total === 1 ? "listing" : "listings"}
                  </h2>
                </div>
                <Button asChild variant="outline">
                  <Link to="/search" search={{ category: slug, page: 1 }}>
                    Refine search <Search className="size-4" aria-hidden="true" />
                  </Link>
                </Button>
              </div>
            </Reveal>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((business, index) => (
                <Reveal key={business.id} delay={index % 3} className="h-full">
                  <BusinessCard business={business} />
                </Reveal>
              ))}
            </div>
          </section>
        ) : (
          <EmptyState
            icon={<Store className="size-7" />}
            title="No published listings here yet"
            body="Be the first eligible business to apply in this category, or search the full directory for another service."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/join">Apply for a listing</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/search">Search all businesses</Link>
                </Button>
              </div>
            }
          />
        )}

        <section aria-labelledby="category-cities" className="border-t border-border/60 pt-10">
          <Reveal>
            <p className="eyebrow text-primary">Narrow the map</p>
            <h2 id="category-cities" className="display-md mt-3">
              Search {category.name.toLowerCase()} by city
            </h2>
          </Reveal>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((location, index) => (
              <Reveal key={location.slug} delay={index % 3}>
                <Link
                  to="/search"
                  search={{ category: slug, location: location.slug, page: 1 }}
                  className="group flex min-h-12 items-center justify-between rounded-xl border border-border/70 bg-card px-4 py-3 text-sm font-semibold transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                >
                  {category.name} in {location.name}
                  <ArrowRight
                    className="size-4 transition-transform duration-300 group-hover:translate-x-1"
                    aria-hidden="true"
                  />
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        <Card className="rounded-3xl border-border/70 bg-muted/35">
          <CardContent className="space-y-3 p-6 sm:p-8">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="size-5 text-primary" aria-hidden="true" />
              Pause before you pay
            </h2>
            <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
              <li>Check what each verification label means; it is not a performance guarantee.</li>
              <li>Agree the scope, total cost and delivery terms in writing.</li>
              <li>Use a payment method you can trace and keep receipts.</li>
              <li>Do not share passwords, one-time codes or unnecessary identity documents.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
