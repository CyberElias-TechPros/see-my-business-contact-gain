import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { MessageSquareReply } from "lucide-react";
import { SectionHead } from "@/components/console/ConsoleShell";
import {
  EmptyState,
  LoadError,
  LoadingCard,
  Panel,
  Stars,
  StatCard,
  TimeAgo,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useReplyReview, useWorkspaceReviews } from "@/lib/queries";

export const Route = createFileRoute("/app/reviews")({
  component: WorkspaceReviews,
});

function WorkspaceReviews() {
  const reviews = useWorkspaceReviews();
  const [replyFor, setReplyFor] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const reply = useReplyReview();

  if (reviews.isLoading) return <LoadingCard label="Loading reviews…" />;
  if (reviews.isError)
    return (
      <LoadError message={(reviews.error as Error)?.message} retry={() => void reviews.refetch()} />
    );

  const items = reviews.data ?? [];
  const avg = items.length
    ? (items.reduce((a, r) => a + r.rating, 0) / items.length).toFixed(1)
    : "—";
  const unanswered = items.filter((r) => !r.reply).length;

  return (
    <div>
      <SectionHead
        title="Reviews"
        subtitle="Reply publicly — thoughtful replies win the next customer reading them."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total reviews" value={String(items.length)} hint="on your listing" />
        <StatCard label="Average rating" value={String(avg)} hint="out of 5" />
        <StatCard
          label="Unanswered"
          value={String(unanswered)}
          hint={unanswered ? "reply to build trust" : "all caught up"}
        />
        <StatCard
          label="5-star"
          value={String(items.filter((r) => r.rating === 5).length)}
          hint="perfect scores"
        />
      </div>
      <div className="mt-6">
        <Panel title="Your reviews">
          {items.length === 0 ? (
            <EmptyState
              title="No reviews yet"
              body="Reviews arrive after customers chat with you. A follow-up message after a job well done earns them faster."
            />
          ) : (
            <div className="space-y-3">
              {items.map((r) => (
                <div key={r.id} className="rounded-xl border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <span className="text-sm font-medium">{r.author}</span>
                    <TimeAgo minutes={r.ts} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                  {r.reply ? (
                    <div className="mt-3 rounded-lg border-l-2 border-primary bg-muted/60 px-4 py-3">
                      <p className="text-xs font-semibold">Your reply</p>
                      <p className="mt-1 text-sm text-muted-foreground">{r.reply}</p>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-3"
                      onClick={() => {
                        setReplyFor(r.id);
                        setDraft("");
                      }}
                    >
                      <MessageSquareReply className="size-3.5" /> Reply publicly
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <Dialog open={replyFor != null} onOpenChange={(o) => !o && setReplyFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply publicly</DialogTitle>
          </DialogHeader>
          <div>
            <Label htmlFor="rv-reply">Your reply (visible to everyone on the listing)</Label>
            <Textarea
              id="rv-reply"
              className="mt-2 min-h-28"
              placeholder="Thank you for the feedback! We've fixed the issue — see you next time."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={reply.isPending || draft.trim().length < 3}
              onClick={() =>
                reply.mutate(
                  { id: replyFor ?? "", reply: draft },
                  { onSuccess: () => setReplyFor(null) },
                )
              }
            >
              {reply.isPending ? "Publishing…" : "Publish reply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
