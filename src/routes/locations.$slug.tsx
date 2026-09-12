import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Search, WifiOff } from "lucide-react";
import { BusinessCard } from "@/components/kit";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { categories, locations } from "@/data/mock";
import { getDirectoryResults } from "@/lib/directory.functions";

export const Route = createFileRoute("/locations/$slug")({
  loader: ({ params }) => {
    if (!locations.some((location) => location.slug === params.slug)) throw notFound();
    return getDirectoryResults({
      data: {
        q: "",
        location: params.slug,
        verified: false,
        openNow: false,
        minRating: 0,
        sort: "relevance",
        page: 1,
        pageSize: 12,
      },
    });
  },
  head: ({ params }) => {
    const location = locations.find((item) => item.slug === params.slug);
    const name = location?.name ?? "Nigeria";
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
  const { available, result } = Route.useLoaderData();
  const location = locations.find((item) => item.slug === slug)!;

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
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <section aria-labelledby="location-categories">
          <p className="eyebrow">Choose a service</p>
          <h2 id="location-categories" className="mt-2 text-2xl font-bold">
            Search categories in {location.name}
          </h2>
          <div className="mt-5 flex flex-wrap gap-2">
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

        {available && result.items.length > 0 ? (
          <section aria-labelledby="location-results" className="border-t pt-9">
            <p className="eyebrow">Current directory</p>
            <h2 id="location-results" className="mt-2 text-2xl font-bold">
              {result.pagination.total} {result.pagination.total === 1 ? "listing" : "listings"} in{" "}
              {location.name}
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {result.items.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>
          </section>
        ) : !available ? (
          <Card className="card-surface border-amber-300/60 bg-amber-50/60">
            <CardContent className="flex gap-4 p-6">
              <WifiOff className="mt-1 size-5 shrink-0 text-amber-800" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">The live directory is temporarily unavailable.</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We have not substituted preview records. Please try this location again shortly.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="card-surface">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold">No published listings in this city yet.</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Search all locations or apply to list an eligible local business.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/join">Apply for a listing</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/locations">Choose another city</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <section className="border-t pt-9" aria-labelledby="area-context">
          <p className="eyebrow">Area context</p>
          <h2 id="area-context" className="mt-2 text-2xl font-bold">
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
