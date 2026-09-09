import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { CategoryIcon } from "@/components/site/CategoryIcon.tsx";
import { taxonomyQuery, type Taxonomy } from "@/lib/queries.ts";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "All business categories in Nigeria — GainHub NG" },
      {
        name: "description",
        content:
          "Browse every business category on GainHub NG, from phone repair and tailoring to logistics, real estate, health and home services — with the number of published listings in each.",
      },
      { property: "og:title", content: "All business categories — GainHub NG" },
      {
        property: "og:description",
        content: "Browse Nigerian business categories and find verified providers near you.",
      },
      { name: "robots", content: "index,follow" },
    ],
    links: [{ rel: "canonical", href: "/categories" }],
  }),
  loader: ({ context }): Promise<Taxonomy> => context.queryClient.ensureQueryData(taxonomyQuery()),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { categories } = Route.useLoaderData();
  const listed = categories.filter((category) => category.count > 0);
  const waiting = categories.filter((category) => category.count === 0);

  return (
    <PublicShell>
      <PageHead
        eyebrow="Browse"
        title="All categories"
        subtitle="Each category has its own profile checklist and image requirements, so a pharmacy page and a tailor’s page ask for what actually matters for that trade."
        action={
          <Link to="/search" className="text-sm font-medium text-primary hover:underline">
            Search across all categories
          </Link>
        }
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <section aria-labelledby="categories-live">
          <h2 id="categories-live" className="text-lg font-semibold">
            {listed.length}{" "}
            {listed.length === 1 ? "category with listings" : "categories with listings"}
          </h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {listed.map((category) => (
              <Link key={category.id} to="/category/$slug" params={{ slug: category.slug }}>
                <Card className="card-surface h-full transition-shadow hover:shadow-lift">
                  <CardContent className="p-5">
                    <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                      <CategoryIcon name={category.icon} className="size-5" />
                    </span>
                    <h3 className="mt-4 font-semibold">{category.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
                    <p className="mt-3 text-sm text-primary">
                      {category.count.toLocaleString("en-NG")}{" "}
                      {category.count === 1 ? "business" : "businesses"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        {waiting.length > 0 ? (
          <section
            aria-labelledby="categories-empty"
            className="rounded-2xl border border-dashed p-6"
          >
            <h2 id="categories-empty" className="text-lg font-semibold">
              {waiting.length} {waiting.length === 1 ? "category" : "categories"} open for business
              owners
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              These are live categories with nothing published in them yet. First listing in a
              category gets the whole page: {waiting.map((c) => c.name).join(", ")}.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2" role="list">
              {waiting.map((category) => (
                <li key={category.id}>
                  <Link to="/join" search={{ category: category.slug }}>
                    <Card className="card-surface transition-shadow hover:shadow-lift">
                      <CardContent className="flex items-center gap-3 p-3">
                        <CategoryIcon
                          name={category.icon}
                          className="size-4 text-muted-foreground"
                        />
                        <span className="text-sm font-medium">{category.name}</span>
                        <span className="text-xs text-primary">Add the first</span>
                      </CardContent>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </PublicShell>
  );
}
