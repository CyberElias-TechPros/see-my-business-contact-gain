import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldCheck, UsersRound } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { FormFeedback } from "@/components/forms/FormFeedback";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest, jsonBody } from "@/lib/api";

type Room = {
  id: string;
  name: string;
  purpose: string;
  state: string;
  slotLimit: number;
  slotsLeft: number;
  rules: string;
  verifiedOnly: boolean;
  memberCount: number;
};
type WorkspaceSummary = {
  businesses: Array<{ id: string; name: string; status: string; verification_level: string }>;
};

export const Route = createFileRoute("/contact-gain/$id")({
  head: () => ({
    meta: [
      { title: "Contact circle rules and application — GainHub NG" },
      {
        name: "description",
        content:
          "Review an opt-in business contact circle's purpose, capacity and published participation rules.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { id } = Route.useParams();
  const session = useSession();
  const submission = useSubmission();
  const room = useQuery({
    queryKey: ["contact-room", id],
    queryFn: () => apiRequest<Room>(`/v1/rooms/${encodeURIComponent(id)}`),
    retry: false,
  });
  const workspace = useQuery({
    queryKey: ["workspace-summary"],
    queryFn: () => apiRequest<WorkspaceSummary>("/v1/workspace/summary"),
    enabled: Boolean(session.data?.user),
    retry: false,
  });

  async function apply(businessId: string) {
    await submission.submit(
      () =>
        apiRequest("/v1/room-applications", {
          method: "POST",
          body: jsonBody({ roomId: id, businessId, acceptedRules: true }),
        }),
      "Application queued. A moderator will assess business eligibility and available capacity.",
    );
  }

  if (room.isLoading) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-5xl px-5 py-16">
          <div className="card-surface h-96 animate-pulse bg-muted" />
        </div>
      </PublicShell>
    );
  }
  if (room.isError || !room.data) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-3xl px-5 py-20 text-center">
          <h1 className="text-4xl font-bold">Circle not found</h1>
          <p className="mt-3 text-muted-foreground">
            It may be unpublished, paused or no longer accepting members.
          </p>
          <Button asChild variant="outline" className="mt-7">
            <Link to="/contact-gain">
              <ArrowLeft /> Back to circles
            </Link>
          </Button>
        </div>
      </PublicShell>
    );
  }
  const current = room.data;
  const eligibleBusinesses =
    workspace.data?.businesses.filter((business) => business.status === "published") ?? [];

  return (
    <PublicShell>
      <PageHead
        eyebrow="Published contact circle"
        title={current.name}
        subtitle={`${current.purpose} · ${current.state}. Read every rule before choosing to apply.`}
        action={
          <Badge variant={current.verifiedOnly ? "default" : "secondary"}>
            {current.verifiedOnly ? "Verified businesses only" : "Open criteria"}
          </Badge>
        }
      />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card className="card-surface">
            <CardContent className="p-6 sm:p-8">
              <p className="eyebrow text-primary">Published participation rules</p>
              <h2 className="mt-3 text-2xl font-bold">Know what you are agreeing to</h2>
              <p className="mt-5 whitespace-pre-wrap leading-7 text-muted-foreground">
                {current.rules}
              </p>
              <div className="mt-6 border-t pt-5 text-sm text-muted-foreground">
                Rules never authorize scraping, harassment, involuntary contact sharing or access to
                private address books.
              </div>
            </CardContent>
          </Card>

          <Card className="card-surface">
            <CardContent className="p-6 sm:p-8">
              <h2 className="text-2xl font-bold">Apply with a published business</h2>
              {!session.data?.user ? (
                <div className="mt-5 rounded-2xl border border-dashed p-6 text-center">
                  <LockKeyhole className="mx-auto size-6 text-primary" />
                  <p className="mt-3 text-sm text-muted-foreground">
                    Sign in so membership is accountable and tied to a reviewed business.
                  </p>
                  <Button asChild className="mt-5">
                    <Link to="/auth" search={{ next: `/contact-gain/${id}` }}>
                      Sign in to apply
                    </Link>
                  </Button>
                </div>
              ) : workspace.isLoading ? (
                <div className="mt-5 h-28 animate-pulse rounded-2xl bg-muted" />
              ) : !eligibleBusinesses.length ? (
                <div className="mt-5 rounded-2xl border border-dashed p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Your account does not manage a published business yet.
                  </p>
                  <Button asChild variant="outline" className="mt-5">
                    <Link to="/join">Submit a business</Link>
                  </Button>
                </div>
              ) : (
                <div className="mt-5 space-y-3">
                  {eligibleBusinesses.map((business) => (
                    <div
                      key={business.id}
                      className="flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="font-bold">{business.name}</p>
                        <p className="mt-1 text-xs capitalize text-muted-foreground">
                          {business.verification_level} verification
                        </p>
                      </div>
                      <Button
                        className="sm:ml-auto"
                        onClick={() => void apply(business.id)}
                        disabled={submission.isSubmitting || current.slotsLeft === 0}
                      >
                        Apply with this business
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-5">
                <FormFeedback
                  status={submission.state.status}
                  message={submission.state.message}
                  {...(submission.state.status === "error" && submission.state.requestId
                    ? { requestId: submission.state.requestId }
                    : {})}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="card-surface">
            <CardContent className="p-6">
              <UsersRound className="size-6 text-primary" />
              <dl className="mt-5 space-y-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Members</dt>
                  <dd className="font-bold">{current.memberCount}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Open slots</dt>
                  <dd className="font-bold">{current.slotsLeft}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Capacity</dt>
                  <dd className="font-bold">{current.slotLimit}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
          <div className="network-stage rounded-[1.5rem] p-6 text-ink-foreground">
            <ShieldCheck className="size-6 text-sidebar-primary" />
            <p className="mt-4 font-bold">Human-reviewed entry</p>
            <p className="mt-2 text-sm leading-6 text-ink-foreground/65">
              Applications are queued, checked against room criteria and auditable.
            </p>
          </div>
          <div className="flex gap-2 rounded-2xl border p-4 text-xs leading-5 text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" /> Applying records your
            acceptance of the published rules.
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
