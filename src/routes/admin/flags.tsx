import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, StatCard } from "@/components/kit";
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
import { Switch } from "@/components/ui/switch";
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/flags")({
  component: AdminFlags,
});

function AdminFlags() {
  const flags = useAd(qk.adFlags, (b) => b.adminFlags());
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [rollout, setRollout] = useState("0%");

  const add = useAdMutation(
    (b, data: { key: string; description?: string; rollout?: string }) => b.adminAddFlag(data),
    {
      success: "Flag created",
      invalidate: [qk.adFlags],
    },
  );
  const update = useAdMutation(
    (b, vars: { key: string; patch: { enabled?: boolean; rollout?: string } }) =>
      b.adminUpdateFlag(vars.key, vars.patch),
    { invalidate: [qk.adFlags] },
  );

  if (flags.isLoading) return <LoadingCard label="Loading flags…" />;
  if (flags.isError)
    return (
      <LoadError message={(flags.error as Error)?.message} retry={() => void flags.refetch()} />
    );

  const items = flags.data ?? [];

  return (
    <div>
      <SectionHead
        title="Feature flags"
        subtitle="Progressive rollouts without deploys."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New flag</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New feature flag</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="fl-key">Key</Label>
                  <Input
                    id="fl-key"
                    className="mt-2 font-mono"
                    placeholder="new-search-ranking"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="fl-desc">Description</Label>
                  <Input
                    id="fl-desc"
                    className="mt-2"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="fl-roll">Initial rollout</Label>
                  <Input
                    id="fl-roll"
                    className="mt-2"
                    placeholder="5%"
                    value={rollout}
                    onChange={(e) => setRollout(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={add.isPending || key.trim().length < 3}
                  onClick={() =>
                    add.mutate(
                      { key: key.trim(), description: description || undefined, rollout },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setKey("");
                          setDescription("");
                        },
                      },
                    )
                  }
                >
                  Create flag
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Flags" value={String(items.length)} hint="defined" />
        <StatCard
          label="Enabled"
          value={String(items.filter((f) => f.enabled).length)}
          hint="serving"
        />
        <StatCard
          label="Partial rollout"
          value={String(items.filter((f) => f.enabled && f.rollout && f.rollout !== "100%").length)}
          hint="canary"
        />
        <StatCard
          label="Disabled"
          value={String(items.filter((f) => !f.enabled).length)}
          hint="off"
        />
      </div>
      <div className="mt-6">
        <Panel title="Flags">
          {items.length === 0 ? (
            <EmptyState
              title="No flags"
              body="Create a flag to gate features without shipping code."
            />
          ) : (
            <div className="space-y-2">
              {items.map((f) => (
                <div
                  key={f.key}
                  className="flex flex-wrap items-center gap-3 rounded-xl border p-3 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono font-medium">{f.key}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {f.description} • audience: {f.audience} • rollout: {f.rollout}
                    </p>
                  </div>
                  <Badge
                    variant={
                      f.status === "enabled"
                        ? "default"
                        : f.status === "partial"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {f.status}
                  </Badge>
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={(v) =>
                      update.mutate(
                        { key: f.key, patch: { enabled: v, rollout: v ? "100%" : "0%" } },
                        {
                          onSuccess: () => toast.success(`${f.key} ${v ? "enabled" : "disabled"}`),
                        },
                      )
                    }
                    aria-label={`Toggle ${f.key}`}
                  />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
