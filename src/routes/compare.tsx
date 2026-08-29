import { createFileRoute, Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useState } from "react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { EmptyState, LoadingCard, SimpleTable, Stars, VerifiedBadge } from "@/components/kit";
import { WhatsAppButton } from "@/components/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useNavigate } from "@tanstack/react-router";
import { useBusinesses, useBusinessesByIds } from "@/lib/queries";

export const Route = createFileRoute("/compare")({
  validateSearch: (search: Record<string, unknown>): { ids?: string } => ({
    ids: typeof search["ids"] === "string" ? search["ids"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Compare businesses side by side — GainHub NG" },
      {
        name: "description",
        content:
          "Compare ratings, prices, verification level, hours and response time across shortlisted Nigerian businesses.",
      },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { ids } = Route.useSearch();
  const navigate = useNavigate();
  const idList: string[] = (ids ?? "").split(",").filter(Boolean).slice(0, 4);
  const [pick, setPick] = useState("");

  const catalog = useBusinesses({ pageSize: 48 });
  const comparison = useBusinessesByIds(idList);
  const loaded = comparison.data ?? [];

  if (idList.length === 0) {
    return (
      <PublicShell>
        <PageHead
          eyebrow="Shortlist"
          title="Compare businesses"
          subtitle="Pick up to four businesses to compare side by side."
        />
        <div className="mx-auto max-w-3xl space-y-4 px-4 py-12">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-5">
              <p className="text-sm font-medium">Add a business to your shortlist</p>
              <div className="flex gap-2">
                <select
                  className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm"
                  value={pick}
                  onChange={(e) => setPick(e.target.value)}
                  aria-label="Choose a business"
                >
                  <option value="">Choose a business…</option>
                  {(catalog.data?.items ?? []).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.city}
                    </option>
                  ))}
                </select>
                <Button
                  disabled={!pick || idList.length >= 4}
                  onClick={() => {
                    const next = [...new Set([...idList, pick])].join(",");
                    void navigate({ to: "/compare", search: { ids: next } });
                    setPick("");
                  }}
                >
                  Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Tip: tick businesses while{" "}
                <Link to="/search" className="text-primary">
                  browsing the directory
                </Link>{" "}
                to build a shortlist faster.
              </p>
            </CardContent>
          </Card>
          {catalog.isLoading ? <LoadingCard /> : null}
        </div>
      </PublicShell>
    );
  }

  if (comparison.isLoading || loaded.length < idList.length) {
    return (
      <PublicShell>
        <PageHead eyebrow="Shortlist" title="Compare businesses" />
        <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:grid-cols-2 lg:grid-cols-3">
          {idList.map((id) => (
            <LoadingCard key={id} />
          ))}
        </div>
      </PublicShell>
    );
  }

  const remove = (id: string) => {
    const next = idList.filter((x) => x !== id).join(",");
    void navigate({ to: "/compare", search: next ? { ids: next } : {} });
  };

  return (
    <PublicShell>
      <PageHead
        eyebrow="Shortlist"
        title="Compare businesses"
        subtitle={`${loaded.length} selected — verify, price and responsiveness side by side.`}
        action={
          <Button asChild variant="outline">
            <Link to="/search">Add more</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-12">
        <div className="flex flex-wrap gap-2">
          {loaded.map((b) => (
            <Badge key={b.id} variant="secondary" className="gap-1">
              {b.name}
              <button onClick={() => remove(b.id)} aria-label={`Remove ${b.name}`}>
                <X className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
        <Card className="card-surface">
          <CardContent className="p-4">
            <SimpleTable
              columns={[
                "Business",
                "Rating",
                "Verification",
                "Category",
                "City",
                "Open now",
                "From",
                "Contact",
              ]}
              rows={loaded.map((b) => [
                <Link
                  to="/business/$id"
                  params={{ id: b.id }}
                  className="font-medium hover:text-primary"
                >
                  {b.name}
                </Link>,
                <Stars rating={b.rating} />,
                <VerifiedBadge level={b.verified} />,
                b.categoryName ?? b.categorySlug,
                `${b.city}, ${b.state}`,
                b.openNow ? "Yes" : "No",
                b.services[0]?.price ?? "—",
                <WhatsAppButton business={b} source="Compare" size="sm" label="WhatsApp" />,
              ])}
            />
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {loaded.map((b) => (
            <Card key={b.id} className="card-surface p-4 text-sm">
              <p className="font-semibold">{b.name}</p>
              <p className="mt-1 text-muted-foreground">Replies in ~{b.responseMinutes} min</p>
              <p className="text-muted-foreground">
                {b.contactsGained.toLocaleString()} contacts gained
              </p>
              <p className="text-muted-foreground">{b.reviewsCount} reviews</p>
              <p className="mt-2 text-xs text-muted-foreground">{b.tagline}</p>
            </Card>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
