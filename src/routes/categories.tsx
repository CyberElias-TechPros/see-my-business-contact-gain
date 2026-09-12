import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  Car,
  GraduationCap,
  PartyPopper,
  Scissors,
  Smartphone,
  Sparkles,
  Stethoscope,
  Store,
  Truck,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { categories } from "@/data/mock";

const categoryIcons: Record<string, LucideIcon> = {
  Smartphone,
  UtensilsCrossed,
  Scissors,
  Sparkles,
  Building2,
  Truck,
  PartyPopper,
  Car,
  Stethoscope,
  GraduationCap,
  Briefcase,
  Wrench,
};

export const Route = createFileRoute("/categories")({
  head: () => ({
    meta: [
      { title: "Business categories in Nigeria — GainHub NG" },
      {
        name: "description",
        content:
          "Browse Nigerian business categories, from phone repair and tailoring to logistics, real estate, health and home services.",
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
  return (
    <PublicShell>
      <PageHead
        eyebrow="Browse"
        title="Start with the kind of help you need."
        subtitle="Choose a category to search current published listings, then narrow the results by city and practical filters."
      />
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {categories.map((category) => {
            const Icon = categoryIcons[category.icon] ?? Store;
            return (
              <Link
                key={category.slug}
                to="/category/$slug"
                params={{ slug: category.slug }}
                className="rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
              >
                <Card className="card-surface h-full transition-[transform,box-shadow] hover:-translate-y-1 hover:shadow-lift">
                  <CardContent className="p-5">
                    <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden="true" />
                    </span>
                    <h2 className="mt-4 font-semibold">{category.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Browse published listings</p>
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
