import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Inbox,
  MessageCircle,
  MessageSquareText,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest, jsonBody } from "@/lib/api";

type WorkspaceSummary = {
  businesses: Array<{
    id: string;
    slug: string;
    name: string;
    status: string;
    verification_level: string;
  }>;
  enquiries: Array<{
    id: string;
    business_id: string;
    name: string;
    phone: string;
    message: string;
    status: string;
    created_at: string;
  }>;
};

type WorkspaceEnquiry = WorkspaceSummary["enquiries"][number];

export const Route = createFileRoute("/app/")({
  component: WorkspaceDashboard,
});

function WorkspaceDashboard() {
  const summary = useQuery({
    queryKey: ["workspace-summary"],
    queryFn: () => apiRequest<WorkspaceSummary>("/v1/workspace/summary"),
    retry: false,
  });

  return (
    <div>
      <SectionHead
        title="Workspace overview"
        subtitle="Only live records returned for your authenticated account appear here. No sample leads or invented revenue."
        action={
          <Button asChild>
            <Link to="/join">
              <Plus /> Submit another listing
            </Link>
          </Button>
        }
      />

      {summary.isLoading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="card-surface h-48 animate-pulse bg-muted" />
          ))}
        </div>
      ) : summary.isError ? (
        <Card className="card-surface border-destructive/25">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold">Workspace data did not load</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The private API returned an error. Refresh to try the request again.
            </p>
            <Button className="mt-6" onClick={() => void summary.refetch()}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : !summary.data?.businesses.length ? (
        <Card className="card-surface border-dashed">
          <CardContent className="grid min-h-96 place-items-center p-8 text-center">
            <div>
              <span className="mx-auto grid size-16 place-items-center rounded-2xl bg-secondary text-primary">
                <Building2 className="size-7" />
              </span>
              <h2 className="mt-6 text-3xl font-bold">No managed listing yet</h2>
              <p className="mx-auto mt-3 max-w-lg leading-7 text-muted-foreground">
                Approved ownership creates workspace access. Submit a business or claim an existing
                published listing to begin.
              </p>
              <div className="mt-7 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/join">
                    Submit a business <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/claim">Claim a listing</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <section aria-labelledby="managed-businesses">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow text-primary">Ownership</p>
                <h2 id="managed-businesses" className="mt-2 text-2xl font-bold">
                  Managed businesses
                </h2>
              </div>
              <ShieldCheck className="size-5 text-primary" />
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {summary.data.businesses.map((business) => (
                <Card key={business.id} className="card-surface">
                  <CardContent className="p-6">
                    <span className="grid size-11 place-items-center rounded-xl bg-secondary font-display font-bold text-primary">
                      {business.name.slice(0, 2).toUpperCase()}
                    </span>
                    <h3 className="mt-5 text-xl font-bold">{business.name}</h3>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-full bg-muted px-2.5 py-1 capitalize">
                        {business.status}
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-1 capitalize">
                        {business.verification_level}
                      </span>
                    </div>
                    {business.status === "published" ? (
                      <Button asChild variant="outline" className="mt-6 w-full">
                        <Link to="/business/$id" params={{ id: business.slug }}>
                          View public profile
                        </Link>
                      </Button>
                    ) : null}
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          <section aria-labelledby="enquiries-heading">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <p className="eyebrow text-primary">Inbox</p>
                <h2 id="enquiries-heading" className="mt-2 text-2xl font-bold">
                  Latest enquiries
                </h2>
              </div>
              <Inbox className="size-5 text-primary" />
            </div>
            {summary.data.enquiries.length ? (
              <div className="mt-5 divide-y rounded-2xl border bg-card shadow-soft">
                {summary.data.enquiries.map((enquiry) => (
                  <EnquiryItem key={enquiry.id} enquiry={enquiry} />
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
                No enquiries have reached your published businesses yet.
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

function EnquiryItem({ enquiry }: { enquiry: WorkspaceEnquiry }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState(enquiry.status);
  const update = useMutation({
    mutationFn: () =>
      apiRequest<{ id: string; status: string }>(`/v1/workspace/enquiries/${enquiry.id}`, {
        method: "PATCH",
        body: jsonBody({ status }),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["workspace-summary"] });
    },
  });
  const whatsapp = `https://wa.me/${enquiry.phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    `Hello ${enquiry.name}, I am following up on your GainHub NG enquiry.`,
  )}`;

  return (
    <article className="p-5">
      <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-start">
        <div className="flex min-w-0 gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
            <MessageSquareText className="size-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="font-bold">{enquiry.name}</h3>
              <time className="text-xs text-muted-foreground" dateTime={enquiry.created_at}>
                {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                  new Date(enquiry.created_at),
                )}
              </time>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {enquiry.message}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Contact supplied with consent: {enquiry.phone}
            </p>
          </div>
        </div>
        <Button asChild size="sm" variant="outline">
          <a href={whatsapp} target="_blank" rel="noopener noreferrer">
            <MessageCircle aria-hidden="true" /> Reply on WhatsApp
          </a>
        </Button>
      </div>
      <div className="mt-4 flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end">
        <label className="max-w-xs flex-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Enquiry status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="mt-1.5 h-10 w-full rounded-lg border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground"
          >
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="closed">Closed</option>
            <option value="spam">Spam</option>
          </select>
        </label>
        <Button
          type="button"
          size="sm"
          onClick={() => update.mutate()}
          disabled={update.isPending || status === enquiry.status}
        >
          {update.isPending ? "Saving…" : "Save status"}
        </Button>
      </div>
      <div className="mt-2 min-h-5 text-sm" aria-live="polite">
        {update.isError ? (
          <p className="text-destructive">
            {update.error instanceof Error ? update.error.message : "The status was not saved."}
          </p>
        ) : null}
      </div>
    </article>
  );
}
