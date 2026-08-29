import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import {
  EmptyState,
  LoadError,
  LoadingCard,
  Panel,
  StatCard,
  Stars,
  TimeAgo,
} from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviews,
});

function AdminReviews() {
  const reviews = useAd(qk.adReviews, (b) => b.adminReviews());
  const update = useAdMutation(
    (b, vars: { id: string; status: string }) => b.adminUpdateReview(vars.id, vars.status),
    {
      invalidate: [qk.adReviews, qk.adOverview],
    },
  );

  if (reviews.isLoading) return <LoadingCard label="Loading reviews…" />;
  if (reviews.isError)
    return (
      <LoadError message={(reviews.error as Error)?.message} retry={() => void reviews.refetch()} />
    );

  const items = reviews.data ?? [];
  const avg = items.length
    ? (items.reduce((acc, r) => acc + r.rating, 0) / items.length).toFixed(1)
    : "—";

  return (
    <div>
      <SectionHead title="Reviews" subtitle="Spot fake ratings and keep the marketplace honest." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total reviews" value={String(items.length)} hint="platform-wide" />
        <StatCard label="Average rating" value={String(avg)} hint="of 5" />
        <StatCard
          label="Flagged"
          value={String(items.filter((r) => r.status === "flagged").length)}
          hint="needs review"
        />
        <StatCard
          label="Hidden"
          value={String(items.filter((r) => r.status === "hidden").length)}
          hint="removed"
        />
      </div>
      <div className="mt-6">
        <Panel title="Latest reviews">
          {items.length === 0 ? (
            <EmptyState title="No reviews yet" body="Reviews posted on listings appear here." />
          ) : (
            <div className="space-y-2">
              {items.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-start gap-3 rounded-xl border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Stars rating={r.rating} />
                      <span className="font-medium">{r.businessId}</span>
                      <Badge
                        variant={
                          r.status === "hidden"
                            ? "destructive"
                            : r.status === "flagged"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {r.status}
                      </Badge>
                      <TimeAgo minutes={r.ts} />
                    </div>
                    <p className="mt-1 text-muted-foreground">
                      “{r.body}” — {r.author}
                    </p>
                  </div>
                  {r.status !== "hidden" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-destructive"
                      onClick={() =>
                        update.mutate(
                          { id: r.id, status: "hidden" },
                          { onSuccess: () => toast.success("Review hidden") },
                        )
                      }
                    >
                      Hide
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        update.mutate(
                          { id: r.id, status: "visible" },
                          { onSuccess: () => toast.success("Review restored") },
                        )
                      }
                    >
                      Restore
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
