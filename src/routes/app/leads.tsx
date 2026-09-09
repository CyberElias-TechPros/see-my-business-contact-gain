/**
 * The leads table — the screen the whole product exists to fill.
 *
 * Filters live in the URL (`/app/leads?stage=new&assignee=unassigned`), not in component state,
 * because that is what makes a lead queue shareable: "the three unassigned ones" is a link you can
 * paste into a WhatsApp group, and Back works. The API validates every parameter again
 * (`workspaceLeadQuery`), so the local schema is only there to keep `?page=9999` from producing a
 * request the server will refuse.
 *
 * Nothing here is prefetched in a loader. This page is `noindex`, its data is private, and the
 * layout already fetched the session and summary — so SSR-ing a table nobody will crawl would double
 * the code for a page whose first paint is already one query deep. A skeleton is the honest answer.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { SectionHead } from "@/components/console/ConsoleShell";
import { Pagination } from "@/components/site/Pagination";
import { Panel } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch, ApiFailure } from "@/lib/api-client.ts";
import { sessionQuery, workspaceLeadStatsQuery, workspaceLeadsQuery } from "@/lib/queries.ts";
import type { LeadDto } from "@/lib/queries.ts";
import { useWorkspace } from "@/lib/workspace.ts";
import {
  LEAD_SOURCE_LABELS,
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  canMoveStage,
  formatNaira,
  waLink,
  type LeadSource,
  type LeadStage,
} from "../../../shared/domain.ts";

/** All optional: a validated schema with `.default()`s would force every `<Link>` to pass them. */
const leadsSearch = z.object({
  ws: z.string().max(64).optional(),
  stage: z.enum(LEAD_STAGES).optional(),
  q: z.string().trim().max(80).optional(),
  assignee: z.enum(["me", "unassigned", "all"]).optional(),
  sort: z.enum(["recent", "score", "value"]).optional(),
  page: z.coerce.number().int().min(1).max(500).optional(),
});

export const Route = createFileRoute("/app/leads")({
  validateSearch: (raw: Record<string, unknown>) => leadsSearch.parse(raw),
  component: WorkspaceLeads,
});

const STAGE_TONES: Record<LeadStage, string> = {
  new: "border-sky-400 text-sky-700",
  qualified: "border-violet-400 text-violet-700",
  quoted: "border-amber-400 text-amber-700",
  follow_up: "border-orange-400 text-orange-700",
  won: "border-emerald-500 text-emerald-700",
  lost: "border-muted-foreground/40 text-muted-foreground",
};

function WorkspaceLeads() {
  const workspace = useWorkspace(useQuery(sessionQuery()).data);
  const search = Route.useSearch();
  const navigate = useNavigate();
  const businessId = workspace?.businessId ?? "";
  const queryClient = useQueryClient();

  const filters = {
    ...(search.stage ? { stage: search.stage } : {}),
    ...(search.q ? { q: search.q } : {}),
    ...(search.assignee ? { assignee: search.assignee } : {}),
    ...(search.sort ? { sort: search.sort } : {}),
    page: search.page ?? 1,
  };

  const leads = useQuery({
    ...workspaceLeadsQuery(businessId, filters),
    enabled: Boolean(workspace),
  });
  const stats = useQuery({
    ...workspaceLeadStatsQuery(businessId),
    enabled: Boolean(workspace),
  });

  /**
   * Everything the filter bar changes goes through here, so the URL stays the single source of
   * truth: `?page` is dropped whenever a *different* filter changes (a page 7 of a result set that
   * now has two pages is a link to an empty table), and the default values are omitted rather than
   * written out — which keeps the query the same shape the API would build and the copy-pasteable
   * links short.
   */
  const setFilters = (patch: Partial<typeof search> & { page?: number | undefined }) => {
    const next: Record<string, string | number | undefined> = { ...search, ...patch };
    if (!("page" in patch)) delete next["page"];
    for (const [key, value] of Object.entries(next)) {
      if (value === undefined || value === "" || value === "all") delete next[key];
    }
    void navigate({ to: "/app/leads", search: next as typeof search });
  };

  if (!workspace) return null;

  // Pagination links carry every active filter plus the workspace, because `/app/leads?page=2`
  // without `?ws=` is a different business's page 2 for anyone who owns more than one listing.
  const pageParams = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...search, ...filters })) {
    if (key === "page" || value === undefined || value === "" || value === "all") continue;
    pageParams.set(key, String(value));
  }
  const queryString = pageParams.toString();
  const basePath = `/app/leads${queryString ? `?${queryString}` : ""}`;

  const total = leads.data?.meta.total ?? 0;
  const counts = new Map((stats.data?.stages ?? []).map((entry) => [entry.stage, entry.count]));
  const wonValue = (stats.data?.stages ?? []).find((entry) => entry.stage === "won");

  return (
    <div>
      <SectionHead
        title="Leads"
        subtitle={
          total === 0
            ? "Nobody has come through yet — every enquiry, QR scan and room contact becomes a row here."
            : `${total} lead${total === 1 ? "" : "s"}${wonValue ? `, ${formatNaira(wonValue.valueMinor)} marked won` : ""}.`
        }
        action={
          <Button asChild variant="outline">
            <Link to="/app/contacts">Copy a contact in</Link>
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <StageChip
          label="All"
          count={total}
          active={!search.stage}
          onClick={() => setFilters({ stage: undefined })}
        />
        {LEAD_STAGES.map((stage) => (
          <StageChip
            key={stage}
            label={LEAD_STAGE_LABELS[stage]}
            count={counts.get(stage) ?? 0}
            active={search.stage === stage}
            onClick={() => setFilters({ stage: search.stage === stage ? undefined : stage })}
          />
        ))}

        <form
          className="ml-auto flex items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("q");
            setFilters({ q: typeof value === "string" && value ? value.slice(0, 80) : undefined });
          }}
        >
          <Input
            name="q"
            defaultValue={search.q ?? ""}
            placeholder="Name, phone or email"
            className="h-9 w-48"
            aria-label="Search leads"
          />
          <Button type="submit" variant="secondary" size="sm">
            Search
          </Button>
        </form>

        <Select
          value={search.assignee ?? "all"}
          onValueChange={(value) => setFilters({ assignee: value as "me" | "unassigned" | "all" })}
        >
          <SelectTrigger className="w-40 text-xs" aria-label="Owner">
            <SelectValue placeholder="Owner" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Everyone</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            <SelectItem value="me">Assigned to me</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={search.sort ?? "recent"}
          onValueChange={(value) => setFilters({ sort: value as "recent" | "score" | "value" })}
        >
          <SelectTrigger className="w-40 text-xs" aria-label="Sort">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">Most recent</SelectItem>
            <SelectItem value="score">Highest score</SelectItem>
            <SelectItem value="value">Biggest value</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Panel
        title={`Leads${search.stage ? ` · ${LEAD_STAGE_LABELS[search.stage]}` : ""}`}
        action={
          leads.isFetching ? (
            <span className="text-xs text-muted-foreground">Refreshing…</span>
          ) : (
            <span className="text-xs text-muted-foreground">
              Page {leads.data?.meta.page ?? 1} of {leads.data?.meta.totalPages ?? 1}
            </span>
          )
        }
      >
        {leads.isPending ? (
          <p className="py-8 text-sm text-muted-foreground">Loading your leads…</p>
        ) : leads.isError ? (
          <div className="space-y-3 py-6">
            <p className="text-sm text-destructive">
              We could not load this list. Nothing has been lost — it is a read that failed.
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => void leads.refetch()}>
              Try again
            </Button>
          </div>
        ) : (leads.data?.items.length ?? 0) === 0 ? (
          <div className="space-y-2 py-8">
            <p className="text-sm text-muted-foreground">
              {search.stage || search.q || search.assignee === "unassigned"
                ? "No leads match these filters."
                : "No leads yet."}{" "}
              {(search.stage || search.q || search.assignee) && (
                <button
                  type="button"
                  className="text-primary underline underline-offset-4"
                  onClick={() =>
                    setFilters({ stage: undefined, q: undefined, assignee: undefined })
                  }
                >
                  Clear filters
                </button>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Contacts gained from your profile, your QR code and any room you post in all arrive
              here within a minute.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs uppercase tracking-wide">Contact</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Source</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Stage</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Score</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Value</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Owner</TableHead>
                  <TableHead className="text-xs uppercase tracking-wide">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(leads.data?.items ?? []).map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    businessId={businessId}
                    onSaved={() => {
                      // The row moved, so the queue it was counted in moved too: stats, the table
                      // and the dashboard badges all derive from the same rows.
                      void queryClient.invalidateQueries({ queryKey: ["workspace-leads"] });
                      void queryClient.invalidateQueries({ queryKey: ["workspace-lead-stats"] });
                      void queryClient.invalidateQueries({ queryKey: ["workspace-summary"] });
                    }}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {leads.data ? (
        <div className="mt-4">
          <Pagination
            page={leads.data.meta.page}
            totalPages={leads.data.meta.totalPages}
            basePath={basePath}
          />
        </div>
      ) : null}
    </div>
  );
}

function StageChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
      <span className={active ? "opacity-80" : "opacity-60"}>{count}</span>
    </button>
  );
}

/**
 * Stage changes are a POST, not a PATCH of the whole lead: `POST /leads/:id/stage` is the only
 * write that records history, checks `canMoveStage` (a lead cannot jump from `new` to `won`), and
 * fires the automation attached to a won deal. The same rule is applied here to build the option
 * list — not as validation, but so a user is never offered a transition the server would refuse.
 */
function LeadRow({
  lead,
  businessId,
  onSaved,
}: {
  lead: LeadDto;
  businessId: string;
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingLossReason, setAwaitingLossReason] = useState<LeadStage | null>(null);
  const [reason, setReason] = useState("");

  const options = LEAD_STAGES.filter(
    (stage) => stage !== lead.stage && canMoveStage(lead.stage, stage),
  );

  const move = async (stage: LeadStage, lostReason?: string) => {
    setPending(true);
    setError(null);
    try {
      await apiFetch(
        `/api/v1/workspaces/${encodeURIComponent(businessId)}/leads/${lead.id}/stage`,
        {
          method: "POST",
          body: { stage, ...(lostReason ? { lostReason } : {}) },
        },
      );
      setAwaitingLossReason(null);
      setReason("");
      onSaved();
    } catch (failure) {
      setError(
        failure instanceof ApiFailure
          ? failure.message
          : "We could not save that. Nothing changed on the lead.",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <TableRow>
      <TableCell>
        <p className="font-medium">{lead.name}</p>
        <p className="text-xs text-muted-foreground">
          {lead.phone ?? lead.email ?? `No reply channel · ${lead.code}`}
        </p>
        {lead.note ? (
          <p className="mt-1 max-w-72 truncate text-xs text-muted-foreground">{lead.note}</p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </TableCell>
      <TableCell>
        <span className="text-sm">
          {LEAD_SOURCE_LABELS[lead.source as LeadSource] ?? lead.source}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-2">
          <Badge variant="outline" className={`w-fit ${STAGE_TONES[lead.stage]}`}>
            {LEAD_STAGE_LABELS[lead.stage]}
          </Badge>
          {awaitingLossReason === null ? (
            <select
              aria-label={`Move ${lead.name} on from ${LEAD_STAGE_LABELS[lead.stage]}`}
              className="h-7 rounded-md border border-input bg-background px-1.5 text-xs disabled:opacity-60"
              disabled={pending || options.length === 0}
              value=""
              onChange={(event) => {
                const stage = event.target.value as LeadStage | "";
                if (!stage) return;
                if (stage === "lost") {
                  setAwaitingLossReason(stage);
                  return;
                }
                void move(stage);
              }}
            >
              <option value="">{options.length === 0 ? "No next stage" : "Move to…"}</option>
              {options.map((stage) => (
                <option key={stage} value={stage}>
                  {LEAD_STAGE_LABELS[stage]}
                </option>
              ))}
            </select>
          ) : (
            <form
              className="flex items-center gap-1"
              onSubmit={(event) => {
                event.preventDefault();
                void move("lost", reason.trim() || undefined);
              }}
            >
              <Input
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Why? (optional)"
                maxLength={200}
                className="h-7 w-36 text-xs"
                aria-label="Reason this lead was lost"
              />
              <Button type="submit" size="sm" variant="destructive" disabled={pending}>
                Lost
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setAwaitingLossReason(null)}
              >
                Cancel
              </Button>
            </form>
          )}
        </div>
      </TableCell>
      <TableCell>
        <span className="text-sm font-medium">{lead.score}</span>
      </TableCell>
      <TableCell className="text-sm">{formatNaira(lead.valueMinor)}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {lead.assigneeName ?? "Unassigned"}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
        <p>{timeAgo(lead.lastActivityAt ?? lead.updatedAt)}</p>
        {lead.phone ? (
          <a
            href={waLink(lead.phone, `Following up on your enquiry — ${lead.name}`)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary"
          >
            <MessageCircle className="size-3" aria-hidden="true" />
            WhatsApp
          </a>
        ) : null}
      </TableCell>
    </TableRow>
  );
}

/**
 * Deliberately not `Intl.RelativeTimeFormat`: the exact wording a browser picks for "5 days ago"
 * varies (and `en-NG` is not everywhere), while the API's timestamps are ISO-UTC and can be
 * diffed in a line of arithmetic.
 */
function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return iso.slice(0, 10);
}
