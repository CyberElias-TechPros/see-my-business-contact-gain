import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { EmptyState, LoadError, LoadingCard, Panel, SimpleTable, StatCard } from "@/components/kit";
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
import type { Campaign } from "@/lib/types";

export const Route = createFileRoute("/app/campaigns")({
  component: WorkspaceCampaigns,
});

function WorkspaceCampaigns() {
  const campaigns = useWs(qk.wsCampaigns, (b) => b.workspaceCampaigns());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("WhatsApp link");
  const [cost, setCost] = useState("");

  const add = useWsMutation((b, data: Partial<Campaign>) => b.addCampaign(data), {
    success: "Campaign created",
    invalidate: [qk.wsCampaigns],
  });
  const toggle = useWsMutation(
    (b, vars: { id: string; status: string }) => b.updateCampaign(vars.id, vars.status),
    {
      invalidate: [qk.wsCampaigns],
    },
  );

  if (campaigns.isLoading) return <LoadingCard label="Loading campaigns…" />;
  if (campaigns.isError)
    return (
      <LoadError
        message={(campaigns.error as Error)?.message}
        retry={() => void campaigns.refetch()}
      />
    );

  const items = campaigns.data ?? [];
  const live = items.filter((c) => c.status === "Live");
  const totalScans = items.reduce((acc, c) => acc + c.scans, 0);
  const totalLeads = items.reduce((acc, c) => acc + c.leads, 0);

  return (
    <div>
      <SectionHead
        title="Campaigns"
        subtitle="Track scans, leads and cost per lead across every channel."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New campaign</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="mc-name">Name</Label>
                  <Input
                    id="mc-name"
                    className="mt-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Channel</Label>
                    <Select value={channel} onValueChange={setChannel}>
                      <SelectTrigger className="mt-2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {["WhatsApp link", "QR code", "Campaign link", "Room"].map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="mc-cost">Budget</Label>
                    <Input
                      id="mc-cost"
                      className="mt-2"
                      placeholder="₦45,000"
                      value={cost}
                      onChange={(e) => setCost(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={add.isPending || name.trim().length < 3}
                  onClick={() =>
                    add.mutate(
                      { name, channel, cost },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setName("");
                        },
                      },
                    )
                  }
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Live campaigns" value={String(live.length)} hint="running" />
        <StatCard label="Total scans" value={totalScans.toLocaleString()} hint="all campaigns" />
        <StatCard label="Total leads" value={totalLeads.toLocaleString()} hint="attributed" />
        <StatCard
          label="Best CPL"
          value={
            items
              .filter((c) => c.cpl !== "₦0")
              .sort(
                (a, b) => Number(a.cpl.replace(/\D/g, "")) - Number(b.cpl.replace(/\D/g, "")),
              )[0]?.cpl ?? "—"
          }
          hint="cost per lead"
        />
      </div>
      <div className="mt-6">
        <Panel title="All campaigns">
          {items.length === 0 ? (
            <EmptyState
              title="No campaigns yet"
              body="Create a campaign to attribute scans and chats to a promotion."
            />
          ) : (
            <SimpleTable
              columns={["ID", "Name", "Channel", "Scans", "Leads", "Cost", "CPL", "Status", ""]}
              rows={items.map((c) => [
                c.id,
                c.name,
                c.channel,
                c.scans.toLocaleString(),
                c.leads.toLocaleString(),
                c.cost,
                c.cpl,
                <Badge
                  variant={
                    c.status === "Live"
                      ? "default"
                      : c.status === "Paused"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {c.status}
                </Badge>,
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    toggle.mutate({ id: c.id, status: c.status === "Live" ? "Paused" : "Live" })
                  }
                >
                  {c.status === "Live" ? "Pause" : "Resume"}
                </Button>,
              ])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
