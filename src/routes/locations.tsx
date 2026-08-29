import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { LoadingCard } from "@/components/kit";
import { Card, CardContent } from "@/components/ui/card";
import { useMeta } from "@/lib/queries";

export const Route = createFileRoute("/locations")({
  head: () => ({
    meta: [
      { title: "Find businesses by city and area in Nigeria — GainHub NG" },
      {
        name: "description",
        content:
          "Browse Nigerian businesses by state, city and area — Lagos, Abuja, Port Harcourt, Ibadan, Kano and more.",
      },
      { property: "og:title", content: "Browse businesses by location — GainHub NG" },
      {
        property: "og:description",
        content: "City and area landing pages for every major Nigerian market.",
      },
    ],
  }),
  component: LocationsPage,
});

function LocationsPage() {
  const { data: meta, isLoading } = useMeta();
  return (
    <PublicShell>
      <PageHead
        eyebrow="Browse"
        title="Locations"
        subtitle="Pick a city, then narrow down to a specific area."
      />
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => <LoadingCard key={i} />)
            : (meta?.locations ?? []).map((l) => (
                <Card key={l.slug} className="card-surface">
                  <CardContent className="p-5">
                    <Link
                      to="/locations/$slug"
                      params={{ slug: l.slug }}
                      className="flex items-center gap-2 font-semibold hover:text-primary"
                    >
                      <MapPin className="size-4 text-primary" /> {l.name}
                    </Link>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {l.count.toLocaleString()} businesses
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {l.areas.map((a) => (
                        <Link key={a} to="/search" search={{ location: l.slug, area: a }}>
                          <span className="rounded-full border px-2 py-0.5 transition-colors hover:border-primary hover:text-primary">
                            {a}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
        </div>
      </div>
    </PublicShell>
  );
}
