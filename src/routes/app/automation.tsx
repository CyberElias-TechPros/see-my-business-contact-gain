import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Plus, Zap } from "lucide-react";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { qk, useWs, useWsMutation } from "@/lib/queries";

export const Route = createFileRoute("/app/automation")({
  component: WorkspaceAutomation,
});

function WorkspaceAutomation() {
  const automations = useWs(qk.wsAutomations, (b) => b.workspaceAutomations());
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState("");
  const [action, setAction] = useState("");

  const toggle = useWsMutation(
    (b, vars: { id: string; status: string }) => b.updateAutomation(vars.id, vars.status),
    {
      invalidate: [qk.wsAutomations],
    },
  );
  const add = useWsMutation(
    (b, data: { trigger: string; action: string }) => b.addAutomation(data),
    {
      success: "Automation created",
      invalidate: [qk.wsAutomations],
    },
  );

  if (automations.isLoading) return <LoadingCard label="Loading automations…" />;
  if (automations.isError)
    return (
      <LoadError
        message={(automations.error as Error)?.message}
        retry={() => void automations.refetch()}
      />
    );

  const items = automations.data ?? [];
  const active = items.filter((a) => a.status === "Active").length;

  return (
    <div>
      <SectionHead
        title="Automation"
        subtitle={`${active} of ${items.length} rules active — replies and routing that run while you sleep.`}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="size-4" /> New rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New automation rule</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="au-trigger">When this happens (trigger)</Label>
                  <Input
                    id="au-trigger"
                    className="mt-2"
                    placeholder="Message contains 'price'"
                    value={trigger}
                    onChange={(e) => setTrigger(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="au-action">Do this (action)</Label>
                  <Input
                    id="au-action"
                    className="mt-2"
                    placeholder="Send price list and tag as Quotation"
                    value={action}
                    onChange={(e) => setAction(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={add.isPending || trigger.trim().length < 3 || action.trim().length < 3}
                  onClick={() =>
                    add.mutate(
                      { trigger, action },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setTrigger("");
                          setAction("");
                        },
                      },
                    )
                  }
                >
                  Create rule
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      {items.length === 0 ? (
        <EmptyState
          title="No automations yet"
          body="Create rules for auto-replies, tagging and routing."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((a) => (
            <Card key={a.id} className="card-surface">
              <CardContent className="flex items-start justify-between gap-4 p-5">
                <div>
                  <p className="flex items-center gap-2 font-medium">
                    <Zap
                      className={`size-4 ${a.status === "Active" ? "text-primary" : "text-muted-foreground"}`}
                    />
                    {a.trigger}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">→ {a.action}</p>
                  <p className="mt-2 text-xs text-muted-foreground">Fired {a.runs} times.</p>
                </div>
                <Switch
                  checked={a.status === "Active"}
                  onCheckedChange={(v) =>
                    toggle.mutate(
                      { id: a.id, status: v ? "Active" : "Paused" },
                      {
                        onSuccess: () =>
                          toast.success(v ? "Automation active" : "Automation paused"),
                      },
                    )
                  }
                  aria-label={`Toggle ${a.trigger}`}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Panel title="How automation is applied" className="mt-6">
        <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
          <li>Messages matching your triggers get the matching action within seconds.</li>
          <li>
            Every conversation is tagged (new enquiry, quotation, callback) and assigned to an
            agent.
          </li>
          <li>Stale leads without activity for 7 days get a follow-up task on your task list.</li>
          <li>Duplicate contacts from the same number are merged automatically.</li>
        </ol>
        <div className="mt-4">
          <Badge variant="outline">Included on Growth plan and above</Badge>
        </div>
      </Panel>
    </div>
  );
}
