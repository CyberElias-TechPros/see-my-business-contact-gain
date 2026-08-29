import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { BusinessCard, EmptyState, LoadingCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { peekBusiness } from "@/data/mock";
import { useBusinesses, useMeta } from "@/lib/queries";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    return {
      meta: [
        { title: `${params.slug.replace(/-/g, " ")} businesses in Nigeria — GainHub NG` },
        {
          name: "description",
          content: `Compare verified businesses in this category across Nigeria. See photos, prices, opening hours and reviews, then chat on WhatsApp.`,
        },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const { data: meta } = useMeta();
  const results = useBusinesses({ category: slug, pageSize: 24 });
  const cat = meta?.categories.find((c) => c.slug === slug);

  if (meta && !cat) throw notFound();

  return (
    <PublicShell>
      <PageHead
        eyebrow="Category"
        title={cat?.name ?? "Businesses"}
        subtitle={`${(cat?.count ?? 0).toLocaleString()} businesses listed nationwide. This category uses a dedicated profile template with its own attributes and image requirements.`}
        action={
          <Button asChild>
            <Link to="/join" search={{ category: slug }}>
              List in this category
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to="/search" search={{ category: slug, verifiedOnly: true }}>
              Verified only
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/search" search={{ category: slug, openNow: true }}>
              Open now
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/search" search={{ category: slug, sort: "rating" }}>
              Top rated
            </Link>
          </Button>
          <Button asChild size="sm" variant="secondary">
            <Link to="/search" search={{ category: slug, delivery: true }}>
              Offers delivery
            </Link>
          </Button>
        </div>

        {results.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingCard key={i} />
            ))}
          </div>
        ) : (results.data?.items ?? []).length === 0 ? (
          <EmptyState
            title="No listings in this category yet"
            body="Be the first — listing your business is free and takes a few minutes."
            action={
              <Button asChild>
                <Link to="/join" search={{ category: slug }}>
                  List your business
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(results.data?.items ?? []).map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
        )}

        <Card className="card-surface">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">{cat?.name ?? "This category"} by city</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(meta?.locations ?? []).map((l) => (
                <Link key={l.slug} to="/search" search={{ category: slug, location: l.slug }}>
                  <Badge variant="secondary" className="cursor-pointer">
                    {cat?.name ?? "Businesses"} in {l.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        <Card className="card-surface">
          <CardContent className="space-y-3 p-6">
            <h2 className="text-lg font-semibold">What to check before you pay</h2>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              <li>Confirm the verification badge and read the most recent reviews.</li>
              <li>Ask for a written quote on WhatsApp before making any transfer.</li>
              <li>Prefer businesses with a physical address and shop photos.</li>
              <li>Report any listing that requests upfront payment to a personal account.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
