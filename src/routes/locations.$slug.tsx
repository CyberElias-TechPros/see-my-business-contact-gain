import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { BusinessCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { businesses, categories, locations } from "@/data/mock";

export const Route = createFileRoute("/locations/$slug")({
  head: ({ params }) => {
    const loc = locations.find((l) => l.slug === params.slug);
    const name = loc?.name ?? "Nigeria";
    return {
      meta: [
        { title: `Businesses in ${name} — verified local listings | GainHub NG` },
        {
          name: "description",
          content: `Find trusted businesses in ${name}. Browse by area and category, check reviews and photos, then chat on WhatsApp.`,
        },
        { property: "og:title", content: `Businesses in ${name} — GainHub NG` },
        { property: "og:description", content: `Local verified businesses in ${name} with instant WhatsApp contact.` },
      ],
    };
  },
  component: LocationPage,
});

function LocationPage() {
  const { slug } = Route.useParams();
  const loc = locations.find((l) => l.slug === slug) ?? locations[0]!;
  return (
    <PublicShell>
      <PageHead
        eyebrow="Location"
        title={`Businesses in ${loc.name}`}
        subtitle={`${loc.count.toLocaleString()} listings across ${loc.areas.length} popular areas.`}
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <Card className="card-surface">
          <CardContent className="p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Popular areas</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {loc.areas.map((a) => (
                <Badge key={a} variant="secondary">
                  {a}
                </Badge>
              ))}
            </div>
            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Top categories here</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {categories.slice(0, 8).map((c) => (
                <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }}>
                  <Badge variant="outline" className="bg-card">
                    {c.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {businesses.slice(0, 9).map((b) => (
            <BusinessCard key={b.id} business={b} />
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
