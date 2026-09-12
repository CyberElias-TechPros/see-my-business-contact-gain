import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin } from "lucide-react";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { locations } from "@/data/mock";

export const Route = createFileRoute("/locations")({
  head: () => ({
    meta: [
      { title: "Find businesses by Nigerian city — GainHub NG" },
      {
        name: "description",
        content:
          "Browse currently supported Nigerian city pages, including Lagos, Abuja, Port Harcourt, Ibadan, Kano and Enugu.",
      },
      { property: "og:title", content: "Browse businesses by city — GainHub NG" },
      {
        property: "og:description",
        content: "Choose a supported city, then explore current published listings by service.",
      },
    ],
  }),
  component: LocationsPage,
});

function LocationsPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Browse"
        title="Choose your part of the map."
        subtitle="Start with a supported city, then filter the current directory by service, verification label or availability."
      />
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <Link
              key={location.slug}
              to="/locations/$slug"
              params={{ slug: location.slug }}
              className="group rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
            >
              <Card className="card-surface h-full transition-[transform,box-shadow] group-hover:-translate-y-1 group-hover:shadow-lift">
                <CardContent className="p-5">
                  <span className="flex items-center justify-between gap-4 font-semibold group-hover:text-primary">
                    <span className="flex items-center gap-2">
                      <MapPin className="size-4 text-primary" aria-hidden="true" /> {location.name}
                    </span>
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </span>
                  <p className="mt-2 text-sm text-muted-foreground">Browse published listings</p>
                  <div
                    className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground"
                    aria-label="Example areas"
                  >
                    {location.areas.slice(0, 4).map((area) => (
                      <span key={area} className="rounded-full border px-2.5 py-1">
                        {area}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
        <p className="mt-8 max-w-2xl text-sm leading-6 text-muted-foreground">
          These are the cities currently supported by the listing application. Coverage grows only
          when applications can be reviewed accurately; area names above help orient your search and
          are not listing totals.
        </p>
      </div>
    </PublicShell>
  );
}
