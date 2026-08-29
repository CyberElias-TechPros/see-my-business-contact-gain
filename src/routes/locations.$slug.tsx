import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { BusinessCard, EmptyState, LoadingCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useBusinesses, useMeta } from "@/lib/queries";

export const Route = createFileRoute("/locations/$slug")({
  head: ({ params }) => ({
    meta: [
      {
        title: `Businesses in ${params.slug.replace(/-/g, " ")} — verified local listings | GainHub NG`,
      },
      {
        name: "description",
        content: `Find trusted businesses here. Browse by area and category, check reviews and photos, then chat on WhatsApp.`,
      },
    ],
  }),
  component: LocationPage,
});

function LocationPage() {
  const { slug } = Route.useParams();
  const { data: meta } = useMeta();
  const loc = meta?.locations.find((l) => l.slug === slug);
  const results = useBusinesses({ location: slug, pageSize: 24 });

  if (meta && !loc) throw notFound();

  return (
    <PublicShell>
      <PageHead
        eyebrow="Location"
        title={`Businesses in ${loc?.name ?? "Nigeria"}`}
        subtitle={`${(loc?.count ?? 0).toLocaleString()} listings across ${loc?.areas.length ?? 0} popular areas.`}
        action={
          <Button asChild>
            <Link to="/join">List your business here</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <Card className="card-surface">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Popular areas
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(loc?.areas ?? []).map((a) => (
                <Link key={a} to="/search" search={{ location: slug, area: a }}>
                  <Badge variant="secondary" className="cursor-pointer">
                    {a}
                  </Badge>
                </Link>
              ))}
            </div>
            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Top categories here
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {(meta?.categories ?? []).slice(0, 8).map((c) => (
                <Link key={c.slug} to="/search" search={{ location: slug, category: c.slug }}>
                  <Badge variant="outline" className="cursor-pointer bg-card">
                    {c.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        {results.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <LoadingCard key={i} />
            ))}
          </div>
        ) : (results.data?.items ?? []).length === 0 ? (
          <EmptyState
            title="No listings here yet"
            body="Know great businesses in this city? Suggest them and help the directory grow."
            action={
              <Button asChild>
                <Link to="/suggest-business">Suggest a business</Link>
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
      </div>
    </PublicShell>
  );
}
