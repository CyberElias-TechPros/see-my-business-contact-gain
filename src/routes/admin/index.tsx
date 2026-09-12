import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileCheck2,
  Flag,
  MessagesSquare,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UsersRound,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, jsonBody } from "@/lib/api";

const queueDetails = {
  listing_applications: {
    label: "Listing applications",
    singular: "listing application",
    icon: ClipboardCheck,
    note: "Profile submissions waiting at the publication gate",
    title: "business_name",
    fields: [
      "owner_name",
      "email",
      "category_slug",
      "location_slug",
      "address",
      "whatsapp",
      "tagline",
      "about",
    ],
    actions: ["start_review", "approve", "reject"],
  },
  claims: {
    label: "Ownership claims",
    singular: "ownership claim",
    icon: FileCheck2,
    note: "Account-bound claims with private supporting evidence",
    title: "business_name",
    fields: [
      "claimant_name",
      "claimant_email",
      "claimant_role",
      "details",
      "evidence_mime",
      "evidence_size",
    ],
    actions: ["start_review", "approve", "contest", "reject"],
  },
  reports: {
    label: "Safety reports",
    singular: "safety report",
    icon: Flag,
    note: "Open concerns ordered by their bounded risk flag",
    title: "reason",
    fields: ["risk", "target_type", "target_id", "details", "contact_email"],
    actions: ["start_review", "resolve", "dismiss"],
  },
  reviews: {
    label: "Review moderation",
    singular: "review",
    icon: MessagesSquare,
    note: "Customer reviews that are not public yet",
    title: "business_name",
    fields: ["author_name", "rating", "body"],
    actions: ["approve", "reject"],
  },
  rooms: {
    label: "Circle proposals",
    singular: "contact-circle proposal",
    icon: UsersRound,
    note: "Opt-in circle rules and capacity awaiting review",
    title: "name",
    fields: [
      "owner_name",
      "owner_email",
      "purpose",
      "state",
      "slot_limit",
      "verified_only",
      "rules",
    ],
    actions: ["approve", "reject"],
  },
  room_applications: {
    label: "Circle applications",
    singular: "contact-circle application",
    icon: UserCheck,
    note: "Business applications to active private circles",
    title: "business_name",
    fields: ["room_name", "applicant_name"],
    actions: ["approve", "reject"],
  },
  suggestions: {
    label: "Directory suggestions",
    singular: "directory suggestion",
    icon: ShieldCheck,
    note: "Corrections, closures, duplicates and missing businesses",
    title: "business_name",
    fields: ["type", "category_slug", "phone", "address", "contact_email", "details"],
    actions: ["start_review", "approve", "reject"],
  },
  data_requests: {
    label: "Personal-data requests",
    singular: "personal-data request",
    icon: Database,
    note: "Track identity checks and manual fulfilment; complete only after delivery",
    title: "kind",
    fields: ["full_name", "email", "phone", "details"],
    actions: ["mark_verifying", "mark_processing", "complete", "reject"],
  },
} as const;

type QueueName = keyof typeof queueDetails;
type ModerationAction = (typeof queueDetails)[QueueName]["actions"][number];
type QueueItem = Record<string, string | number | null> & {
  id: string;
  status: string;
  created_at: string;
};
type AdminQueueResponse = {
  counts: Array<{ queue: QueueName; count: number }>;
  items: Record<QueueName, QueueItem[]>;
};

const actionLabels: Record<ModerationAction, string> = {
  start_review: "Start review",
  approve: "Approve",
  reject: "Reject",
  resolve: "Resolve",
  dismiss: "Dismiss",
  mark_verifying: "Verify identity",
  mark_processing: "Mark processing",
  complete: "Mark completed",
  contest: "Mark contested",
};

const contextualActionLabels: Partial<
  Record<QueueName, Partial<Record<ModerationAction, string>>>
> = {
  listing_applications: { approve: "Publish listing", reject: "Reject application" },
  claims: {
    approve: "Approve ownership access",
    contest: "Mark claim contested",
    reject: "Reject claim",
  },
  reports: { resolve: "Resolve report", dismiss: "Dismiss report" },
  reviews: { approve: "Publish review", reject: "Reject review" },
  rooms: { approve: "Activate circle", reject: "Reject proposal" },
  room_applications: { approve: "Admit business", reject: "Reject application" },
  suggestions: { approve: "Accept suggestion", reject: "Reject suggestion" },
  data_requests: { complete: "Complete request", reject: "Reject request" },
};

function actionLabel(queue: QueueName, action: ModerationAction): string {
  return contextualActionLabels[queue]?.[action] ?? actionLabels[action];
}

const noteRequired = new Set<ModerationAction>([
  "reject",
  "resolve",
  "dismiss",
  "complete",
  "contest",
]);

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function humanize(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function displayValue(key: string, value: string | number | null): string {
  if (value === null || value === "") return "Not provided";
  if (key === "created_at" && typeof value === "string") {
    return new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" }).format(
      new Date(value),
    );
  }
  if (key === "evidence_size" && typeof value === "number")
    return `${Math.ceil(value / 1024).toLocaleString()} KB`;
  if (key === "verified_only" && typeof value === "number") return value ? "Yes" : "No";
  return String(value);
}

function AdminDashboard() {
  const queue = useQuery({
    queryKey: ["admin-queue"],
    queryFn: () => apiRequest<AdminQueueResponse>("/v1/admin/queue"),
    retry: false,
  });

  return (
    <div>
      <SectionHead
        title="Operations queue"
        subtitle="Live, role-restricted records. Every decision calls an authorized API and writes an audit event; nothing below is sample data."
        action={
          <Button
            variant="outline"
            onClick={() => void queue.refetch()}
            disabled={queue.isFetching}
          >
            <RefreshCw className={queue.isFetching ? "animate-spin" : ""} aria-hidden="true" />
            Refresh
          </Button>
        }
      />

      {queue.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="card-surface h-40 animate-pulse bg-muted" />
          ))}
        </div>
      ) : queue.isError ? (
        <Card className="card-surface border-destructive/25">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="mx-auto size-7 text-destructive" aria-hidden="true" />
            <h2 className="mt-4 text-2xl font-bold">Queue unavailable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The authorized admin endpoint did not return moderation data. No cached queue is
              shown.
            </p>
            <Button className="mt-5" onClick={() => void queue.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : queue.data ? (
        <>
          <section aria-labelledby="queue-counts">
            <h2 id="queue-counts" className="sr-only">
              Current queue counts
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {queue.data.counts.map((item) => {
                const detail = queueDetails[item.queue];
                return (
                  <a
                    key={item.queue}
                    href={`#queue-${item.queue}`}
                    className="rounded-2xl focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                  >
                    <Card className="card-surface h-full transition-shadow hover:shadow-lift">
                      <CardContent className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary">
                            <detail.icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="font-display text-3xl font-extrabold tabular-nums">
                            {item.count}
                          </span>
                        </div>
                        <h3 className="mt-4 font-bold">{detail.label}</h3>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {detail.note}
                        </p>
                      </CardContent>
                    </Card>
                  </a>
                );
              })}
            </div>
          </section>

          <div className="mt-10 space-y-12">
            {(Object.keys(queueDetails) as QueueName[]).map((name) => (
              <QueueSection key={name} name={name} items={queue.data.items[name]} />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function QueueSection({ name, items }: { name: QueueName; items: QueueItem[] }) {
  const detail = queueDetails[name];
  return (
    <section
      id={`queue-${name}`}
      className="scroll-mt-24 border-t pt-8"
      aria-labelledby={`${name}-heading`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="eyebrow text-primary">{items.length} loaded</p>
          <h2 id={`${name}-heading`} className="mt-2 text-2xl font-bold">
            {detail.label}
          </h2>
        </div>
        <detail.icon className="size-6 text-primary" aria-hidden="true" />
      </div>
      {items.length ? (
        <div className="mt-5 grid gap-4 xl:grid-cols-2">
          {items.map((item) => (
            <ModerationCard key={item.id} queue={name} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-3 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          <CheckCircle2 className="size-5 text-primary" aria-hidden="true" /> No active{" "}
          {detail.label.toLowerCase()}.
        </div>
      )}
    </section>
  );
}

function ModerationCard({ queue, item }: { queue: QueueName; item: QueueItem }) {
  const detail = queueDetails[queue];
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const action = useMutation({
    mutationFn: (nextAction: ModerationAction) =>
      apiRequest<{ id: string }>(`/v1/admin/moderation/${queue}/${item.id}`, {
        method: "PATCH",
        body: jsonBody({ action: nextAction, note }),
      }),
    onSuccess: async () => {
      setNote("");
      await queryClient.invalidateQueries({ queryKey: ["admin-queue"] });
    },
  });

  function submit(nextAction: ModerationAction) {
    if (noteRequired.has(nextAction) && note.trim().length < 10) return;
    const isDecision =
      nextAction !== "start_review" &&
      nextAction !== "mark_verifying" &&
      nextAction !== "mark_processing";
    if (
      isDecision &&
      !window.confirm(
        `Confirm ${actionLabel(queue, nextAction).toLowerCase()} for this ${detail.singular}? This takes effect immediately and is recorded in the audit log.`,
      )
    )
      return;
    action.mutate(nextAction);
  }

  return (
    <Card className="card-surface">
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary">
              {humanize(item.status)}
            </p>
            <h3 className="mt-1 text-lg font-bold">
              {displayValue(detail.title, item[detail.title] ?? "Untitled")}
            </h3>
          </div>
          <time className="text-xs text-muted-foreground" dateTime={String(item.created_at)}>
            {displayValue("created_at", item.created_at)}
          </time>
        </div>

        <dl className="mt-4 space-y-3">
          {detail.fields.map((field) => (
            <div key={field} className="grid gap-1 sm:grid-cols-[8.5rem_1fr] sm:gap-3">
              <dt className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                {humanize(field)}
              </dt>
              <dd className="min-w-0 whitespace-pre-wrap break-words text-sm leading-6">
                {displayValue(field, item[field] ?? null)}
              </dd>
            </div>
          ))}
        </dl>

        {queue === "claims" ? (
          <Button asChild variant="outline" size="sm" className="mt-5">
            <a href={`/api/v1/admin/claims/${encodeURIComponent(item.id)}/evidence`} download>
              Review private evidence
            </a>
          </Button>
        ) : null}

        <div className="mt-5 border-t pt-5">
          <Label htmlFor={`note-${item.id}`}>Decision note</Label>
          <Textarea
            id={`note-${item.id}`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={1_000}
            rows={2}
            className="mt-2"
            placeholder="Required for rejection, resolution, dismissal, contest or completion"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {detail.actions.map((nextAction) => {
              const needsNote = noteRequired.has(nextAction as ModerationAction);
              const disabled = action.isPending || (needsNote && note.trim().length < 10);
              return (
                <Button
                  key={nextAction}
                  type="button"
                  size="sm"
                  variant={
                    nextAction === "approve" ||
                    nextAction === "resolve" ||
                    nextAction === "complete"
                      ? "default"
                      : nextAction === "reject" || nextAction === "dismiss"
                        ? "destructive"
                        : "outline"
                  }
                  disabled={disabled}
                  onClick={() => submit(nextAction as ModerationAction)}
                >
                  {action.isPending && action.variables === nextAction
                    ? "Saving…"
                    : actionLabel(queue, nextAction as ModerationAction)}
                </Button>
              );
            })}
          </div>
          <div className="mt-3 min-h-5 text-sm" aria-live="polite">
            {action.isError ? (
              <p className="text-destructive">
                {action.error instanceof Error
                  ? action.error.message
                  : "The decision was not saved."}
              </p>
            ) : null}
            {note.trim().length > 0 && note.trim().length < 10 ? (
              <p className="text-muted-foreground">
                Use at least 10 characters when a decision note is required.
              </p>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
