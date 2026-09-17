import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Search, Store, WifiOff } from "lucide-react";
import { BusinessCard, EmptyState } from "@/components/kit";
import { Reveal } from "@/components/motion";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { directoryQuerySchema } from "@/lib/contracts";
import { getDirectoryResults, getDirectoryTaxonomy } from "@/lib/directory.functions";

export const Route = createFileRoute("/locations/$slug")({
  loader: async ({ params }) => {
    const taxonomy = await getDirectoryTaxonomy();
    // Only a real, active city is a page — anything else is a 404, not an indexable
    // empty page.
    const location = taxonomy.taxonomy.locations.find((item) => item.slug === params.slug);
    if (!location) throw notFound();
    const results = await getDirectoryResults({
      data: {
        ...directoryQuerySchema.parse({}),
        location: params.slug,
        sort: "relevance",
        page: 1,
        pageSize: 12,
      },
    });
    return { location, results, categories: taxonomy.taxonomy.categories };
  },
  head: ({ loaderData }) => {
    const name = loaderData?.location.name ?? "Nigeria";
    return {
      meta: [
        { title: `Businesses in ${name} — GainHub NG` },
        {
          name: "description",
          content: `Browse currently published business listings in ${name}, compare useful profile details and filter the directory by service.`,
        },
        { property: "og:title", content: `Businesses in ${name} — GainHub NG` },
        {
          property: "og:description",
          content: `Explore current local business listings in ${name} and choose a service category.`,
        },
      ],
    };
  },
  component: LocationPage,
});

function LocationPage() {
  const { slug } = Route.useParams();
  const { location, results, categories } = Route.useLoaderData();
  const { available, result } = results;

  return (
    <PublicShell>
      <PageHead
        eyebrow="Location"
        title={`Businesses in ${location.name}`}
        subtitle="Live published listings for this city. Search results never fall back to preview profiles when the directory is unavailable."
        action={
          <Button asChild variant="secondary">
            <Link to="/search" search={{ location: slug, page: 1 }}>
              Refine search <Search className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-12 px-5 py-14">
        <section aria-labelledby="location-categories">
          <Reveal>
            <p className="eyebrow text-primary">Choose a service</p>
            <h2 id="location-categories" className="display-md mt-3">
              Search categories in {location.name}
            </h2>
          </Reveal>
          <div className="mt-6 flex flex-wrap gap-2">
            {categories.map((category) => (
              <Link
                key={category.slug}
                to="/search"
                search={{ category: category.slug, location: slug, page: 1 }}
                className="rounded-full border bg-card px-3.5 py-2 text-sm font-medium hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </section>

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
                  We have not substituted preview records. Please try this location again shortly.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : result.items.length > 0 ? (
          <section aria-labelledby="location-results" className="border-t border-border/60 pt-10">
            <Reveal>
              <p className="eyebrow text-primary">Current directory</p>
              <h2 id="location-results" className="display-md mt-3">
                {result.pagination.total} {result.pagination.total === 1 ? "listing" : "listings"}{" "}
                in {location.name}
              </h2>
            </Reveal>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
            title="No published listings in this city yet"
            body="Search all locations or apply to list an eligible local business."
            action={
              <div className="flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/join">Apply for a listing</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/locations">Choose another city</Link>
                </Button>
              </div>
            }
          />
        )}

        <section className="border-t border-border/60 pt-10" aria-labelledby="area-context">
          <p className="eyebrow text-primary">Area context</p>
          <h2 id="area-context" className="display-md mt-3">
            Neighbourhoods represented in {location.name}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            These names are orientation aids, not live coverage or listing counts. Confirm a
            provider&apos;s exact service area directly before booking.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {location.areas.map((area) => (
              <span key={area} className="rounded-full border bg-card px-3 py-1.5 text-sm">
                {area}
              </span>
            ))}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
