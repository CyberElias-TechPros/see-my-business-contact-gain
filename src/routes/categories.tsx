import { createFileRoute, Link } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { LoadingCard } from "@/components/kit";
import { Card, CardContent } from "@/components/ui/card";
import { useMeta } from "@/lib/queries";

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "All business categories in Nigeria — GainHub NG" },
      {
        name: "description",
        content:
          "Browse every business category on GainHub NG, from phone repair and tailoring to logistics, real estate, health and home services.",
      },
      { property: "og:title", content: "All business categories — GainHub NG" },
      {
        property: "og:description",
        content: "Browse Nigerian business categories and find verified providers near you.",
      },
    ],
  }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { data: meta, isLoading } = useMeta();
  return (
    <PublicShell>
      <PageHead
        eyebrow="Browse"
        title="All categories"
        subtitle="Each category has its own profile template, filters and attributes maintained by our category managers."
      />
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => <LoadingCard key={i} />)
            : (meta?.categories ?? []).map((c) => {
                const Icon =
                  (Icons as unknown as Record<string, Icons.LucideIcon>)[c.icon] ?? Icons.Store;
                return (
                  <Link key={c.slug} to="/category/$slug" params={{ slug: c.slug }}>
                    <Card className="card-surface h-full transition-shadow hover:shadow-lift">
                      <CardContent className="p-5">
                        <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="size-5" />
                        </span>
                        <h2 className="mt-4 font-semibold">{c.name}</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {c.count.toLocaleString()} businesses
                        </p>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
        </div>
      </div>
    </PublicShell>
  );
}
