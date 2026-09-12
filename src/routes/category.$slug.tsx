import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Search, WifiOff } from "lucide-react";
import { BusinessCard } from "@/components/kit";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { categories, locations } from "@/data/mock";
import { getDirectoryResults } from "@/lib/directory.functions";

export const Route = createFileRoute("/category/$slug")({
  loader: ({ params }) => {
    if (!categories.some((category) => category.slug === params.slug)) throw notFound();
    return getDirectoryResults({
      data: {
        q: "",
        category: params.slug,
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
    const category = categories.find((item) => item.slug === params.slug);
    const name = category?.name ?? "Businesses";
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
  const { available, result } = Route.useLoaderData();
  const category = categories.find((item) => item.slug === slug)!;

  return (
    <PublicShell>
      <PageHead
        eyebrow="Category"
        title={category.name}
        subtitle="Published listings only. Open a profile to review its details, verification label and available contact options."
        action={
          <Button asChild>
            <Link to="/join">Add your business</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        {available && result.items.length > 0 ? (
          <section aria-labelledby="category-results">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Current directory</p>
                <h2 id="category-results" className="mt-2 text-2xl font-bold">
                  {result.pagination.total} {result.pagination.total === 1 ? "listing" : "listings"}
                </h2>
              </div>
              <Button asChild variant="outline">
                <Link to="/search" search={{ category: slug, page: 1 }}>
                  Refine search <Search className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                  We have not substituted preview records. Please try this category again shortly.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="card-surface">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-semibold">No published listings here yet.</h2>
              <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                Be the first eligible business to apply, or search the full directory for another
                service.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/join">Apply for a listing</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/search">Search all businesses</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <section aria-labelledby="category-cities" className="border-t pt-9">
          <p className="eyebrow">Narrow the map</p>
          <h2 id="category-cities" className="mt-2 text-2xl font-bold">
            Search {category.name.toLowerCase()} by city
          </h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {locations.map((location) => (
              <Link
                key={location.slug}
                to="/search"
                search={{ category: slug, location: location.slug, page: 1 }}
                className="group flex min-h-12 items-center justify-between rounded-xl border bg-card px-4 py-3 text-sm font-semibold hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                {category.name} in {location.name}
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </Link>
            ))}
          </div>
        </section>

        <Card className="card-surface">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">Pause before you pay</h2>
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
