import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin } from "lucide-react";
import { Reveal, Spotlight } from "@/components/motion";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getDirectoryTaxonomy } from "@/lib/directory.functions";

export const Route = createFileRoute("/locations")({
  loader: () => getDirectoryTaxonomy(),
  head: () => ({
    meta: [
      { title: "Find businesses by Nigerian city — GainHub NG" },
      {
        name: "description",
        content:
          "Browse currently supported Nigerian city pages, including Lagos, Abuja, Port Harcourt, Ibadan, Kano and Enugu, and see how many listings are published in each.",
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
  const { taxonomy } = Route.useLoaderData();
  const sorted = [...taxonomy.locations].sort((a, b) => b.businessCount - a.businessCount);

  return (
    <PublicShell>
      <PageHead
        eyebrow="Browse"
        title="Choose your part of the map."
        subtitle="Start with a supported city, then filter the current directory by service, verification label or availability."
      />

      <div className="mx-auto max-w-7xl px-5 py-14">
        {sorted.length ? (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {sorted.map((location, index) => (
              <Reveal key={location.slug} delay={index % 3} className="h-full">
                <Spotlight className="h-full rounded-3xl">
                  <Link
                    to="/locations/$slug"
                    params={{ slug: location.slug }}
                    className="group block h-full rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                  >
                    <Card className="h-full rounded-3xl border-border/70 transition-[transform,border-color,box-shadow] duration-500 group-hover:-translate-y-1.5 group-hover:border-primary/30 group-hover:shadow-lift">
                      <CardContent className="p-6">
                        <span className="flex items-center justify-between gap-4 font-bold transition-colors group-hover:text-primary">
                          <span className="flex items-center gap-2">
                            <MapPin className="size-4 text-primary" aria-hidden="true" />
                            {location.name}
                          </span>
                          <ArrowUpRight className="size-4" aria-hidden="true" />
                        </span>

                        <p className="mt-1.5 text-xs uppercase tracking-wide text-muted-foreground">
                          {location.state} State
                        </p>

                        <div className="mt-4">
                          <Badge variant="secondary" className="tabular-nums">
                            {location.businessCount} published
                          </Badge>
                        </div>

                        {location.areas.length ? (
                          <div
                            className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground"
                            aria-label="Areas within this city"
                          >
                            {location.areas.slice(0, 4).map((area) => (
                              <span
                                key={area}
                                className="rounded-full border border-border/70 px-2.5 py-1"
                              >
                                {area}
                              </span>
                            ))}
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  </Link>
                </Spotlight>
              </Reveal>
            ))}
          </div>
        ) : (
          <Card className="rounded-3xl border-dashed border-border/70">
            <CardContent className="p-10 text-center">
              <h2 className="text-xl font-bold">City pages are not available right now</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                The live city taxonomy could not be loaded. Please try again shortly.
              </p>
            </CardContent>
          </Card>
        )}

        <p className="mt-10 max-w-2xl text-sm leading-6 text-muted-foreground">
          These are the cities currently supported by the listing application. Coverage grows only
          when applications can be reviewed accurately; area names above help orient your search and
          are not listing totals.
        </p>
      </div>
    </PublicShell>
  );
}
