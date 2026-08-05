import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { SimpleTable, Stars, VerifiedBadge } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { businesses } from "@/data/mock";

export const Route = createFileRoute("/compare")({
  head: () => ({
    meta: [
      { title: "Compare businesses side by side — GainHub NG" },
      { name: "description", content: "Compare ratings, prices, verification level, hours and response time across shortlisted Nigerian businesses." },
      { property: "og:title", content: "Compare businesses — GainHub NG" },
      { property: "og:description", content: "Shortlist providers and compare them before you pay." },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const picks = businesses.slice(0, 3);
  return (
    <PublicShell>
      <PageHead eyebrow="Shortlist" title="Compare businesses" subtitle="Three businesses selected from your search." />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Card className="card-surface">
          <CardContent className="p-4">
            <SimpleTable
              columns={["Business", "Rating", "Verification", "Category", "City", "Open now", "From", "Contact"]}
              rows={picks.map((b) => [
                b.name,
                <Stars rating={b.rating} />,
                <VerifiedBadge level={b.verified} />,
                b.category,
                b.city,
                b.openNow ? "Yes" : "No",
                b.services[0]?.price ?? "—",
                <Button size="sm">WhatsApp</Button>,
              ])}
            />
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
