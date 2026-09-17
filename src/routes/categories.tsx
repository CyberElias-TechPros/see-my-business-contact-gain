import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Store } from "lucide-react";
import { Reveal, Spotlight } from "@/components/motion";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDirectoryTaxonomy } from "@/lib/directory.functions";
import { categoryIcon } from "@/lib/taxonomy-icons";

export const Route = createFileRoute("/categories")({
  loader: () => getDirectoryTaxonomy(),
  head: () => ({
    meta: [
      { title: "Business categories in Nigeria — GainHub NG" },
      {
        name: "description",
        content:
          "Browse Nigerian business categories — phone repair, food, tailoring, logistics, real estate, health, education and home services — then filter by city.",
      },
      { property: "og:title", content: "Business categories — GainHub NG" },
      {
        property: "og:description",
        content: "Choose a service category, then filter published business listings by location.",
      },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { available, taxonomy } = Route.useLoaderData();
  const withListings = taxonomy.categories.filter((category) => category.businessCount > 0);
  const withoutListings = taxonomy.categories.filter((category) => category.businessCount === 0);

  return (
    <PublicShell>
      <PageHead
        eyebrow="Browse"
        title="Start with the kind of help you need."
        subtitle="Choose a category to search current published listings, then narrow the results by city and practical filters."
      />

      <div className="mx-auto max-w-7xl px-5 py-14">
        {!available ? (
          <Card className="rounded-3xl border-dashed border-warning/40 bg-warning/8">
            <CardContent className="p-8 text-center">
              <h2 className="text-xl font-bold">Categories are temporarily unavailable</h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                The live taxonomy could not be loaded. Search still works — try again shortly.
              </p>
              <Button asChild className="mt-6" variant="outline">
                <Link to="/search">Open the directory</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {available && withListings.length ? (
          <section aria-labelledby="active-categories">
            <h2 id="active-categories" className="eyebrow text-primary">
              Categories with published listings
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {withListings.map((category, index) => {
                const Icon = categoryIcon(category.slug);
                return (
                  <Reveal key={category.slug} delay={index % 4} className="h-full">
                    <Spotlight className="h-full rounded-3xl">
                      <Link
                        to="/category/$slug"
                        params={{ slug: category.slug }}
                        className="group flex h-full rounded-3xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                      >
                        <Card className="h-full w-full rounded-3xl border-border/70 transition-[transform,border-color,box-shadow] duration-500 group-hover:-translate-y-1.5 group-hover:border-primary/30 group-hover:shadow-lift">
                          <CardContent className="flex h-full flex-col p-5">
                            <span className="grid size-11 place-items-center rounded-xl bg-secondary text-primary transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                              <Icon className="size-5" aria-hidden="true" />
                            </span>
                            <h3 className="mt-4 font-bold leading-snug">{category.name}</h3>
                            {category.description ? (
                              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
                                {category.description}
                              </p>
                            ) : null}
                            <div className="mt-auto flex items-center justify-between gap-2 pt-4">
                              <Badge variant="secondary" className="tabular-nums">
                                {category.businessCount} listed
                              </Badge>
                              <ArrowRight
                                className="size-4 text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                                aria-hidden="true"
                              />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    </Spotlight>
                  </Reveal>
                );
              })}
            </div>
          </section>
        ) : null}

        {available && withoutListings.length ? (
          <section aria-labelledby="open-categories" className="mt-14">
            <h2 id="open-categories" className="eyebrow text-muted-foreground">
              Open for new listings
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              These categories are supported by the listing application but have no published
              business yet. Counts are live, not decorative.
            </p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {withoutListings.map((category) => {
                const Icon = categoryIcon(category.slug);
                return (
                  <li key={category.slug}>
                    <Link
                      to="/category/$slug"
                      params={{ slug: category.slug }}
                      className="group flex items-center gap-3 rounded-2xl border border-dashed border-border/70 p-4 transition-colors hover:border-primary/40"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-secondary group-hover:text-primary">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{category.name}</span>
                        <span className="block text-xs text-muted-foreground">No listings yet</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

        <div className="mt-14 flex flex-wrap items-center gap-4 rounded-3xl border border-border/70 bg-muted/35 p-6 sm:p-8">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <Store className="size-6" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-bold">Your trade should be here</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Listing is free and every submission is reviewed before it goes live.
            </p>
          </div>
          <Button asChild>
            <Link to="/join">List your business</Link>
          </Button>
        </div>
      </div>
    </PublicShell>
  );
}
