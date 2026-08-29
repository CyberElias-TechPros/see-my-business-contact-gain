import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SectionHead } from "@/components/console/ConsoleShell";
import {
  EmptyState,
  LoadError,
  LoadingCard,
  Panel,
  SimpleTable,
  StatCard,
  TimeAgo,
} from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { qk, useWs, useWsMutation } from "@/lib/queries";
import type { Lead, LeadStage } from "@/lib/types";

export const Route = createFileRoute("/app/leads")({
  component: WorkspaceLeads,
});

const STAGES: LeadStage[] = ["New", "Qualified", "Quotation", "Follow up", "Won", "Lost"];

function WorkspaceLeads() {
  const leads = useWs(qk.wsLeads, (b) => b.workspaceLeads());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<LeadStage>("New");
  const [value, setValue] = useState("");

  const add = useWsMutation((b, data: Partial<Lead>) => b.addLead(data), {
    success: "Lead added",
    invalidate: [qk.wsLeads],
  });
  const move = useWsMutation(
    (b, vars: { id: string; stage: LeadStage }) => b.updateLead(vars.id, { stage: vars.stage }),
    {
      invalidate: [qk.wsLeads, qk.wsSummary],
    },
  );
  const assign = useWsMutation(
    (b, vars: { id: string; agent: string }) => b.updateLead(vars.id, { agent: vars.agent }),
    {
      invalidate: [qk.wsLeads],
    },
  );
  const remove = useWsMutation((b, id: string) => b.deleteLead(id), { invalidate: [qk.wsLeads] });

  if (leads.isLoading) return <LoadingCard label="Loading leads…" />;
  if (leads.isError)
    return (
      <LoadError message={(leads.error as Error)?.message} retry={() => void leads.refetch()} />
    );

  const items = leads.data ?? [];
  const newToday = items.filter((l) => l.stage === "New" && l.ts < 60 * 24).length;
  const qualified = items.filter((l) => l.stage === "Qualified").length;
  const avgScore = items.length
    ? Math.round(items.reduce((acc, l) => acc + l.score, 0) / items.length)
    : 0;
  const unassigned = items.filter((l) => l.agent === "Unassigned").length;

  return (
    <div>
      <SectionHead
        title="Leads"
        subtitle="Scored, deduplicated and routed to the right agent."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Add lead</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="lead-name">Name</Label>
                  <Input
                    id="lead-name"
                    className="mt-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Stage</Label>
                    <Select value={stage} onValueChange={(v) => setStage(v as LeadStage)}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="lead-value">Est. value</Label>
                    <Input
                      id="lead-value"
                      className="mt-2"
                      placeholder="₦45,000"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={add.isPending || name.trim().length < 2}
                  onClick={() =>
                    add.mutate(
                      { name, stage, value },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setName("");
                          setValue("");
                        },
                      },
                    )
                  }
                >
                  Add lead
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New (24h)" value={String(newToday)} hint="leads" />
        <StatCard label="Qualified" value={String(qualified)} hint="in pipeline" />
        <StatCard label="Avg score" value={String(avgScore)} hint="points" />
        <StatCard
          label="Unassigned"
          value={String(unassigned)}
          hint={unassigned ? "needs routing" : "all routed"}
        />
      </div>
      <div className="mt-6">
        <Panel title="All leads">
          {items.length === 0 ? (
            <EmptyState
              title="No leads yet"
              body="Every WhatsApp click, QR scan and profile enquiry becomes a lead here automatically."
            />
          ) : (
            <SimpleTable
              columns={["Lead", "Name", "Source", "Stage", "Value", "Agent", "Updated", ""]}
              rows={items.map((l) => [
                l.id,
                l.name,
                l.source,
                <Select
                  value={l.stage}
                  onValueChange={(v) => move.mutate({ id: l.id, stage: v as LeadStage })}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
                l.value || "—",
                <Select
                  value={l.agent}
                  onValueChange={(v) => assign.mutate({ id: l.id, agent: v })}
                >
                  <SelectTrigger className="h-8 w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Unassigned", "Chidi O.", "Amina B.", "Seyi A."].map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>,
                <TimeAgo minutes={l.ts} />,
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => remove.mutate(l.id)}
                >
                  Delete
                </Button>,
              ])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
