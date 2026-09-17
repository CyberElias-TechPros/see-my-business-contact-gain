import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CircleDot,
  Clock3,
  LogOut,
  RefreshCw,
  Users,
  UserX,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { EmptyState } from "@/components/kit";
import { Reveal } from "@/components/motion";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { apiRequest, jsonBody } from "@/lib/api";
import type { CircleQueueItem, JoinedCircle, MyCirclesResponse } from "@/lib/contracts";
import { cn } from "@/lib/utils";

/**
 * "My contact circles".
 *
 * Three things live here, because a person's relationship to a circle is never
 * only one of them: circles they run (with the join requests waiting on them),
 * circles they have applied to, and the ability to walk away from a circle they
 * are in. The last one is the gap this screen closes — before it, joining was a
 * one-way door that only a platform administrator could reverse.
 */

const APPLICATION_STATUS: Record<
  JoinedCircle["status"],
  { label: string; className: string; detail: string }
> = {
  queued: {
    label: "Awaiting the owner",
    className: "border-accent/40 bg-accent/10 text-accent-foreground",
    detail: "The circle owner has not responded yet.",
  },
  approved: {
    label: "Member",
    className: "border-primary/35 bg-primary/10 text-primary",
    detail: "You are in this circle. Your business is listed to its members.",
  },
  rejected: {
    label: "Not admitted",
    className: "border-border bg-muted text-muted-foreground",
    detail: "The owner declined this application.",
  },
  left: {
    label: "You left",
    className: "border-border bg-muted text-muted-foreground",
    detail: "You left this circle. You can ask to join again.",
  },
  removed: {
    label: "Removed",
    className: "border-destructive/35 bg-destructive/10 text-destructive",
    detail: "The owner removed this business from the circle.",
  },
};

const ROOM_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: "Awaiting review", className: "border-accent/40 bg-accent/10" },
  active: { label: "Active", className: "border-primary/35 bg-primary/10 text-primary" },
  closed: { label: "Closed", className: "border-border bg-muted text-muted-foreground" },
  suspended: { label: "Suspended", className: "border-destructive/35 bg-destructive/10" },
};

const PURPOSE_LABEL: Record<JoinedCircle["status"] | string, string> = {
  business: "Business circle",
  niche: "Niche circle",
  network: "Network circle",
};

function Pill({ className, children }: { className: string | undefined; children: ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        className,
      )}
    >
      {children}
    </span>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const Route = createFileRoute("/app/circles")({
  component: MyCircles,
});

function MyCircles() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState("");

  const circles = useQuery({
    queryKey: ["my-circles"],
    queryFn: () => apiRequest<MyCirclesResponse>("/v1/workspace/rooms"),
    retry: false,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["my-circles"] });
    void queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const decide = useMutation({
    mutationFn: (input: { roomId: string; applicationId: string; action: "approve" | "reject" }) =>
      apiRequest(`/v1/workspace/rooms/${input.roomId}/applications/${input.applicationId}`, {
        method: "POST",
        body: jsonBody({ action: input.action }),
      }),
    onSuccess: () => {
      setActionError("");
      invalidate();
    },
    onError: (error: unknown) => {
      setActionError(
        error instanceof Error ? error.message : "That request could not be completed.",
      );
    },
  });

  const leave = useMutation({
    mutationFn: (roomId: string) =>
      apiRequest(`/v1/rooms/${roomId}/leave`, { method: "POST", body: jsonBody({}) }),
    onSuccess: () => {
      setActionError("");
      invalidate();
    },
    onError: (error: unknown) => {
      setActionError(
        error instanceof Error ? error.message : "We could not remove you from that circle.",
      );
    },
  });

  const data = circles.data;
  const owned = data?.owned ?? [];
  const queue = data?.queue ?? [];
  const applications = data?.applications ?? [];
  const active = applications.filter(
    (item) => item.status === "approved" || item.status === "queued",
  );
  const history = applications.filter(
    (item) => item.status !== "approved" && item.status !== "queued",
  );
  const busy = decide.isPending || leave.isPending;

  return (
    <div>
      <SectionHead
        title="My contact circles"
        subtitle="Circles you run, join requests waiting on you, and the circles your businesses belong to. Every row comes from the API for your account."
        action={
          <Button asChild>
            <Link to="/contact-gain/create">
              Propose a circle <ArrowRight />
            </Link>
          </Button>
        }
      />

      {circles.isError ? (
        <Card className="mb-6 rounded-2xl border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">We could not load your circles.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No placeholder data is shown in its place.
              </p>
            </div>
            <Button variant="outline" onClick={() => void circles.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {actionError ? (
        <Card className="mb-6 rounded-2xl border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            <p className="min-w-0 flex-1 text-sm">{actionError}</p>
            <Button variant="ghost" size="sm" onClick={() => setActionError("")}>
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {/* ------------------------- Join requests ------------------------- */}

      <section aria-labelledby="queue-heading" className="mb-10">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 id="queue-heading" className="text-xl font-bold">
              Join requests
              {queue.length ? (
                <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-bold text-accent-foreground">
                  {queue.length}
                </span>
              ) : null}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Businesses asking to join a circle you run. You decide here — no administrator needed.
            </p>
          </div>
        </div>

        {queue.length ? (
          <ul className="grid gap-3">
            {queue.map((item, index) => (
              <Reveal as="li" key={item.id} delay={index % 4}>
                <QueueRow
                  item={item}
                  busy={busy}
                  onDecide={(action) =>
                    decide.mutate({ roomId: item.roomId, applicationId: item.id, action })
                  }
                />
              </Reveal>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Users className="size-7" />}
            title="No requests waiting"
            body="When a business asks to join a circle you run, it appears here with the option to admit or decline it."
          />
        )}
      </section>

      {/* -------------------------- Circles I run -------------------------- */}

      <section aria-labelledby="owned-heading" className="mb-10">
        <h2 id="owned-heading" className="mb-1 text-xl font-bold">
          Circles you run
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Circles you proposed, with their live membership against the slot limit you set.
        </p>

        {owned.length ? (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {owned.map((circle, index) => (
              <Reveal as="li" key={circle.id} delay={index % 3}>
                <Card className="h-full rounded-2xl border-border/70">
                  <CardContent className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{circle.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {PURPOSE_LABEL[circle.purpose] ?? circle.purpose} · {circle.state}
                        </p>
                      </div>
                      <Pill className={ROOM_STATUS[circle.status]?.className}>
                        {ROOM_STATUS[circle.status]?.label ?? circle.status}
                      </Pill>
                    </div>

                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="size-3.5" aria-hidden="true" />
                        {circle.memberCount}/{circle.slotLimit} slots
                      </span>
                      {circle.queuedCount ? (
                        <span className="inline-flex items-center gap-1.5 text-accent-foreground">
                          <Clock3 className="size-3.5" aria-hidden="true" />
                          {circle.queuedCount} waiting
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full rounded-full bg-primary transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                        style={{
                          width: `${Math.min(100, (circle.memberCount / Math.max(1, circle.slotLimit)) * 100)}%`,
                        }}
                      />
                    </div>

                    <Button asChild variant="outline" size="sm" className="mt-5 w-fit">
                      <Link to="/contact-gain/$id" params={{ id: circle.id }}>
                        Open circle <ArrowRight />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </Reveal>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<CircleDot className="size-7" />}
            title="You do not run a circle yet"
            body="Propose a contact circle and own the room where your trade meets."
            action={
              <Button asChild>
                <Link to="/contact-gain/create">Propose a circle</Link>
              </Button>
            }
          />
        )}
      </section>

      <Separator className="my-8" />

      {/* ------------------------ Circles I've joined ------------------------ */}

      <section aria-labelledby="joined-heading" className="mb-10">
        <h2 id="joined-heading" className="mb-1 text-xl font-bold">
          Circles your businesses are in
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Membership is held by a business, not by you personally. Leaving releases the slot for
          someone else.
        </p>

        {active.length ? (
          <ul className="grid gap-3">
            {active.map((item, index) => (
              <Reveal as="li" key={item.id} delay={index % 4}>
                <JoinedRow item={item} busy={busy} onLeave={() => leave.mutate(item.roomId)} />
              </Reveal>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={<Users className="size-7" />}
            title="Not in a circle yet"
            body="Apply to a contact circle with one of your published businesses and it will show up here."
            action={
              <Button asChild variant="outline">
                <Link to="/contact-gain">Browse circles</Link>
              </Button>
            }
          />
        )}
      </section>

      {history.length ? (
        <section aria-labelledby="history-heading">
          <h2 id="history-heading" className="mb-1 text-xl font-bold">
            Closed applications
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Applications that were declined, that you left, or that an owner closed. Kept so the
            history stays honest rather than silently rewritten.
          </p>
          <ul className="grid gap-3">
            {history.map((item) => (
              <li key={item.id}>
                <Card className="rounded-2xl border-border/70 bg-muted/25">
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{item.roomName}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.businessName} · {formatDate(item.createdAt)}
                      </p>
                    </div>
                    <Pill className={APPLICATION_STATUS[item.status].className}>
                      {APPLICATION_STATUS[item.status].label}
                    </Pill>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function QueueRow({
  item,
  busy,
  onDecide,
}: {
  item: CircleQueueItem;
  busy: boolean;
  onDecide: (action: "approve" | "reject") => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{item.businessName}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {item.applicantName} asked to join{" "}
            <span className="font-medium text-foreground">{item.roomName}</span> ·{" "}
            {formatDate(item.createdAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/business/$id" params={{ id: item.businessSlug }}>
              View listing
            </Link>
          </Button>
          {confirming ? (
            <>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setConfirming(false);
                  onDecide("reject");
                }}
              >
                <UserX /> Decline
              </Button>
              <Button size="sm" onClick={() => setConfirming(false)} disabled={busy}>
                Keep waiting
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirming(true)}>
                Decline
              </Button>
              <Button size="sm" disabled={busy} onClick={() => onDecide("approve")}>
                <Check /> Admit
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function JoinedRow({
  item,
  busy,
  onLeave,
}: {
  item: JoinedCircle;
  busy: boolean;
  onLeave: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const status = APPLICATION_STATUS[item.status];

  return (
    <Card className="rounded-2xl border-border/70">
      <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold">{item.roomName}</p>
            <Pill className={status.className}>{status.label}</Pill>
            {item.roomStatus !== "active" ? (
              <Pill className={ROOM_STATUS[item.roomStatus]?.className}>
                {ROOM_STATUS[item.roomStatus]?.label ?? item.roomStatus}
              </Pill>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.businessName} · applied {formatDate(item.createdAt)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{status.detail}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link to="/contact-gain/$id" params={{ id: item.roomId }}>
              Open circle
            </Link>
          </Button>
          {/* Only an actual member can leave — a queued application is not a membership. */}
          {item.status === "approved" ? (
            confirming ? (
              <>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => {
                    setConfirming(false);
                    onLeave();
                  }}
                >
                  <LogOut /> Yes, leave
                </Button>
                <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>
                  Stay
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirming(true)}
              >
                Leave circle
              </Button>
            )
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
