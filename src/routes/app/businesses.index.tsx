import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  Eye,
  MessageSquareText,
  RefreshCw,
  Settings2,
} from "lucide-react";
import { BusinessMark, Stat } from "@/components/kit";
import { Reveal } from "@/components/motion";
import { SectionHead } from "@/components/console/ConsoleShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/api";

/**
 * Workspace insights shape, mirroring `workspaceInsights` in worker/index.ts.
 * Only these fields are rendered — anything the API does not return is not shown.
 */
type InsightsResponse = {
  range: { from: string; to: string };
  totals: {
    contacts: number;
    uniqueVisitors: number;
    enquiries: number;
    whatsapp: number;
    phone: number;
    website: number;
    directions: number;
  };
  byChannel: Array<{ channel: string; count: number }>;
  byDay: Array<{ date: string; contacts: number; enquiries: number }>;
  byBusiness: Array<{
    id: string;
    name: string;
    slug: string;
    contacts: number;
    uniqueVisitors: number;
    enquiries: number;
    reviews: number;
    rating: number;
    savedBy: number;
  }>;
  recentContacts: Array<{ channel: string; businessName: string; createdAt: string }>;
};

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  draft: { label: "Draft", className: "border-border bg-muted text-muted-foreground" },
  pending_review: {
    label: "In review",
    className: "border-warning/40 bg-warning/10 text-warning-foreground",
  },
  published: { label: "Published", className: "border-primary/35 bg-primary/10 text-primary" },
  suspended: {
    label: "Suspended",
    className: "border-destructive/35 bg-destructive/10 text-destructive",
  },
  rejected: {
    label: "Rejected",
    className: "border-destructive/35 bg-destructive/10 text-destructive",
  },
};

export const Route = createFileRoute("/app/businesses/")({
  component: ManagedBusinesses,
});

function ManagedBusinesses() {
  const insights = useQuery({
    queryKey: ["workspace-insights"],
    queryFn: () => apiRequest<InsightsResponse>("/v1/workspace/insights"),
    retry: false,
  });

  // Insights carry the numbers; the summary carries the moderation status.
  const summary = useQuery({
    queryKey: ["workspace-summary"],
    queryFn: () =>
      apiRequest<{ businesses: Array<{ id: string; status: string }>; enquiries: unknown[] }>(
        "/v1/workspace/summary",
      ),
    retry: false,
  });

  const statusById = new Map(
    (summary.data?.businesses ?? []).map((business) => [business.id, business.status]),
  );
  const totals = insights.data?.totals;
  const businesses = insights.data?.byBusiness ?? [];

  return (
    <div>
      <SectionHead
        title="Your listings"
        subtitle="Every record here is returned by the API for your authenticated account. Nothing is a demo row, and no reach or revenue figure is estimated."
      />

      {insights.isError ? (
        <Card className="mb-6 rounded-2xl border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-wrap items-center gap-4 p-5">
            <AlertTriangle className="size-5 shrink-0 text-destructive" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">We could not load your listings.</p>
              <p className="mt-1 text-sm text-muted-foreground">
                No placeholder data is shown in its place.
              </p>
            </div>
            <Button variant="outline" onClick={() => void insights.refetch()}>
              <RefreshCw /> Try again
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {totals ? (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Contacts gained" value={totals.contacts} hint="Last 30 days" />
          <Stat
            label="Unique visitors"
            value={totals.uniqueVisitors}
            hint="Hashed, non-identifying"
          />
          <Stat label="Enquiries received" value={totals.enquiries} hint="Consented enquiries" />
          <Stat
            label="WhatsApp contacts"
            value={totals.whatsapp}
            hint={`Call ${totals.phone} · Directions ${totals.directions}`}
          />
        </div>
      ) : null}

      {insights.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-3xl bg-muted" />
          ))}
        </div>
      ) : businesses.length ? (
        <ul className="grid gap-4 sm:grid-cols-2">
          {businesses.map((business, index) => {
            const statusCopy =
              STATUS_COPY[statusById.get(business.id) ?? ""] ?? STATUS_COPY["published"];
            return (
              <Reveal as="li" key={business.id} delay={index % 2}>
                <Card className="h-full rounded-3xl border-border/70 transition-shadow hover:shadow-lift">
                  <CardContent className="flex h-full flex-col gap-5 p-6">
                    <div className="flex items-start gap-4">
                      <BusinessMark
                        name={business.name}
                        id={business.id}
                        className="size-12 text-sm"
                      />
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-lg font-bold">{business.name}</h2>
                        <p className="mt-0.5 text-xs text-muted-foreground">/{business.slug}</p>
                      </div>
                      <Badge variant="outline" className={statusCopy?.className}>
                        {statusCopy?.label}
                      </Badge>
                    </div>

                    <dl className="grid grid-cols-3 gap-3 rounded-2xl bg-muted/45 p-4 text-center">
                      <div>
                        <dt className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          Contacts
                        </dt>
                        <dd className="mt-1 font-display text-xl font-extrabold tabular-nums">
                          {business.contacts}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          Enquiries
                        </dt>
                        <dd className="mt-1 font-display text-xl font-extrabold tabular-nums">
                          {business.enquiries}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[0.68rem] font-semibold uppercase tracking-wide text-muted-foreground">
                          Saved
                        </dt>
                        <dd className="mt-1 font-display text-xl font-extrabold tabular-nums">
                          {business.savedBy}
                        </dd>
                      </div>
                    </dl>

                    <div className="mt-auto flex flex-wrap gap-2.5">
                      <Button asChild size="sm">
                        <Link to="/app/businesses/$id" params={{ id: business.id }}>
                          <Settings2 /> Manage listing
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={`/business/${business.slug}`}>
                          <Eye /> View public profile
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
            );
          })}
        </ul>
      ) : !insights.isError && !insights.isLoading ? (
        <Card className="rounded-3xl border-dashed border-border/70">
          <CardContent className="grid place-items-center p-12 text-center">
            <span className="grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
              <Building2 className="size-7" aria-hidden="true" />
            </span>
            <h2 className="mt-5 text-2xl font-bold">No listings yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
              Submit a business for review. Once it is approved and published you can edit its
              profile, work its enquiries and see what it gained.
            </p>
            <Button asChild className="mt-7">
              <Link to="/join">
                Submit a listing <ArrowRight />
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {insights.data?.recentContacts.length ? (
        <div className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <MessageSquareText className="size-5 text-primary" aria-hidden="true" />
            Recent contact activity
          </h2>
          <Card className="mt-4 rounded-2xl border-border/70">
            <CardContent className="divide-y p-0">
              {insights.data.recentContacts.map((contact, index) => (
                <div
                  key={`${contact.createdAt}-${index}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm"
                >
                  <span className="font-semibold">{contact.businessName}</span>
                  <span className="text-xs text-muted-foreground">
                    <Badge variant="secondary" className="mr-2">
                      {contact.channel}
                    </Badge>
                    {new Date(contact.createdAt).toLocaleString("en-NG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
