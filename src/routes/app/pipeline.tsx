import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, StatCard, BarTrend } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { qk, useWs, useWsMutation } from "@/lib/queries";
import type { Lead, LeadStage } from "@/lib/types";

export const Route = createFileRoute("/app/pipeline")({
  component: WorkspacePipeline,
});

const STAGES: LeadStage[] = ["New", "Qualified", "Quotation", "Follow up", "Won", "Lost"];

function parseNaira(v: string): number {
  const n = Number(v.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function WorkspacePipeline() {
  const leads = useWs(qk.wsLeads, (b) => b.workspaceLeads());
  const analytics = useWs(qk.wsAnalytics, (b) => b.workspaceAnalytics());
  const move = useWsMutation(
    (b, vars: { id: string; direction: 1 | -1 }) => {
      const lead = (leads.data ?? []).find((l) => l.id === vars.id);
      if (!lead) return Promise.resolve();
      const idx = STAGES.indexOf(lead.stage);
      const next =
        STAGES[Math.min(STAGES.length - 1, Math.max(0, idx + vars.direction))] ?? lead.stage;
      return b.updateLead(vars.id, { stage: next });
    },
    { invalidate: [qk.wsLeads, qk.wsAnalytics, qk.wsSummary] },
  );

  if (leads.isLoading) return <LoadingCard label="Loading pipeline…" />;
  if (leads.isError)
    return (
      <LoadError message={(leads.error as Error)?.message} retry={() => void leads.refetch()} />
    );

  const items = leads.data ?? [];
  const byStage = new Map<LeadStage, Lead[]>(STAGES.map((s) => [s, []]));
  for (const l of items) (byStage.get(l.stage) ?? byStage.get("New")!)?.push(l);

  const openValue = items
    .filter((l) => l.stage !== "Won" && l.stage !== "Lost")
    .reduce((acc, l) => acc + parseNaira(l.value), 0);
  const won = byStage.get("Won") ?? [];
  const lost = byStage.get("Lost") ?? [];
  const winRate =
    won.length + lost.length > 0 ? Math.round((won.length / (won.length + lost.length)) * 100) : 0;

  return (
    <div>
      <SectionHead title="Pipeline" subtitle="Move leads through your stages as deals progress." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open value" value={`₦${openValue.toLocaleString()}`} hint="in pipeline" />
        <StatCard label="Win rate" value={`${winRate}%`} hint="won vs lost" />
        <StatCard label="Won" value={String(won.length)} hint="deals" />
        <StatCard
          label="Stale"
          value={String(
            items.filter((l) => l.ts > 7 * 1440 && l.stage !== "Won" && l.stage !== "Lost").length,
          )}
          hint="no activity 7 days"
        />
      </div>
      {analytics.data?.trend.length ? (
        <div className="mt-6">
          <Card className="card-surface">
            <CardContent className="pt-4">
              <BarTrend data={analytics.data.trend} />
            </CardContent>
          </Card>
        </div>
      ) : null}
      <div className="mt-6 overflow-x-auto pb-2">
        <div className="grid min-w-[900px] grid-cols-6 gap-3">
          {STAGES.map((stage) => {
            const stageLeads = byStage.get(stage) ?? [];
            return (
              <div key={stage} className="rounded-xl bg-muted/60 p-2">
                <div className="flex items-center justify-between px-1 pb-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {stage}
                  </p>
                  <span className="text-xs text-muted-foreground">{stageLeads.length}</span>
                </div>
                <div className="space-y-2">
                  {stageLeads.length === 0 ? (
                    <p className="px-1 pb-2 text-xs text-muted-foreground">—</p>
                  ) : (
                    stageLeads.map((l) => (
                      <Card key={l.id} className="card-surface p-3">
                        <p className="truncate text-sm font-medium">{l.name}</p>
                        <p className="text-xs text-muted-foreground">{l.value || "No value"}</p>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">{l.agent}</span>
                          <span className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              aria-label="Move back a stage"
                              disabled={l.stage === "New"}
                              onClick={() => move.mutate({ id: l.id, direction: -1 })}
                            >
                              <ChevronLeft className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-6"
                              aria-label="Move forward a stage"
                              disabled={l.stage === "Lost"}
                              onClick={() => move.mutate({ id: l.id, direction: 1 })}
                            >
                              <ChevronRight className="size-3.5" />
                            </Button>
                          </span>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {items.length === 0 ? (
        <EmptyState
          title="Pipeline is empty"
          body="Leads appear here as customers discover your business."
        />
      ) : null}
    </div>
  );
}
