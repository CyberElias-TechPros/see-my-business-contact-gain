import { createFileRoute, Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { taxonomyQuery, type Taxonomy } from "@/lib/queries.ts";

export const Route = createFileRoute("/locations/")({
  head: () => ({
    meta: [
      { title: "Find businesses by city and area in Nigeria — GainHub NG" },
      {
        name: "description",
        content:
          "Browse Nigerian businesses by state, city and area — Lagos, Abuja, Port Harcourt, Ibadan, Kano and more, with the number of published listings in each.",
      },
      { property: "og:title", content: "Browse businesses by location — GainHub NG" },
      {
        property: "og:description",
        content: "City and area landing pages for every major Nigerian market.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/locations" }],
  }),
  loader: ({ context }): Promise<Taxonomy> => context.queryClient.ensureQueryData(taxonomyQuery()),
  component: LocationsPage,
});

function LocationsPage() {
  const { locations } = Route.useLoaderData();
  const sorted = [...locations].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return (
    <PublicShell>
      <PageHead
        eyebrow="Browse"
        title="Locations"
        subtitle="Pick a city, then narrow down to a specific area. Counts are the listings published in that city right now."
      />
      <div className="mx-auto max-w-7xl px-4 py-12">
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3" role="list">
          {sorted.map((location) => (
            <li key={location.id}>
              <Card className="card-surface h-full">
                <CardContent className="p-5">
                  <Link
                    to="/locations/$slug"
                    params={{ slug: location.slug }}
                    className="flex items-center gap-2 font-semibold hover:text-primary"
                  >
                    <MapPin className="size-4 text-primary" aria-hidden="true" /> {location.name}
                    <span className="ml-auto text-sm font-normal text-muted-foreground">
                      {location.count.toLocaleString("en-NG")}
                    </span>
                  </Link>
                  {/* The API stores the state label as the location's own text ("Abuja" for the
                      FCT), so it is printed as-is rather than guessed at with a " state" suffix. */}
                  {location.state && location.state !== location.name ? (
                    <p className="mt-1 text-xs text-muted-foreground">{location.state}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {location.areas.map((area) => (
                      <Link
                        key={area}
                        to="/search"
                        search={{ location: location.slug, q: area }}
                        className="rounded-full border px-2 py-0.5 hover:border-primary/40 hover:text-foreground"
                      >
                        {area}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </PublicShell>
  );
}
