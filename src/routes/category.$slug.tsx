import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { BusinessCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { businesses, categories, locations } from "@/data/mock";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => {
    const cat = categories.find((c) => c.slug === params.slug);
    const name = cat?.name ?? "Businesses";
    return {
      meta: [
        { title: `${name} in Nigeria — verified listings | GainHub NG` },
        {
          name: "description",
          content: `Compare ${name.toLowerCase()} businesses in Nigeria. See photos, prices, opening hours and reviews, then chat on WhatsApp.`,
        },
        { property: "og:title", content: `${name} in Nigeria — GainHub NG` },
        {
          property: "og:description",
          content: `Verified ${name.toLowerCase()} providers with WhatsApp contact and real reviews.`,
        },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  const cat = categories.find((c) => c.slug === slug) ?? categories[0]!;
  const list = businesses.filter((b) => b.categorySlug === slug);
  const shown = list.length ? list : businesses.slice(0, 6);

  return (
    <PublicShell>
      <PageHead
        eyebrow="Category"
        title={cat.name}
        subtitle={`${cat.count.toLocaleString()} businesses listed. This category uses a dedicated profile template with its own attributes and image requirements.`}
        action={
          <Button asChild>
            <Link to="/join">List in this category</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <div className="flex flex-wrap gap-2">
          {[
            "Open now",
            "Verified",
            "Home service",
            "Warranty offered",
            "Same-day",
            "Card accepted",
          ].map((f) => (
            <Badge key={f} variant="outline" className="bg-card">
              {f}
            </Badge>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((b) => (
            <BusinessCard key={b.id} business={b} />
          ))}
        </div>
        <Card className="card-surface">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold">{cat.name} by city</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {locations.map((l) => (
                <Link key={l.slug} to="/locations/$slug" params={{ slug: l.slug }}>
                  <Badge variant="secondary">
                    {cat.name} in {l.name}
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
