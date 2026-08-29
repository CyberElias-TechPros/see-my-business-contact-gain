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
  BarTrend,
  SourceBars,
  TimeAgo,
} from "@/components/kit";
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
import { useWs, useWsMutation } from "@/lib/queries";
import { qk } from "@/lib/queries";

export const Route = createFileRoute("/app/")({
  component: WorkspaceDashboard,
});

function WorkspaceDashboard() {
  const summary = useWs(qk.wsSummary, (b) => b.workspaceSummary());
  const [open, setOpen] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [campaignChannel, setCampaignChannel] = useState("WhatsApp link");

  const addCampaign = useWsMutation(
    (b, data: { name: string; channel: string }) => b.addCampaign(data),
    { success: "Campaign created", invalidate: [qk.wsCampaigns, qk.wsSummary] },
  );

  if (summary.isLoading) return <LoadingCard label="Loading your dashboard…" />;
  if (summary.isError)
    return (
      <LoadError message={(summary.error as Error)?.message} retry={() => void summary.refetch()} />
    );

  const data = summary.data!;

  return (
    <div>
      <SectionHead
        title="Dashboard"
        subtitle="Everything happening across your listings, leads and campaigns."
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
                  <Label htmlFor="cmp-name">Campaign name</Label>
                  <Input
                    id="cmp-name"
                    className="mt-2"
                    placeholder="August repair offer"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Channel</Label>
                  <Select value={campaignChannel} onValueChange={setCampaignChannel}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="WhatsApp link">WhatsApp link</SelectItem>
                      <SelectItem value="QR code">QR code</SelectItem>
                      <SelectItem value="Campaign link">Campaign link</SelectItem>
                      <SelectItem value="Room">Room</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={addCampaign.isPending || campaignName.trim().length < 3}
                  onClick={() =>
                    addCampaign.mutate(
                      { name: campaignName, channel: campaignChannel },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setCampaignName("");
                        },
                      },
                    )
                  }
                >
                  Create campaign
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.stats.map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} delta={s.delta} hint={s.hint} />
        ))}
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Panel title="Weekly contacts vs leads" className="lg:col-span-2">
          {data.trend.length ? (
            <BarTrend data={data.trend} />
          ) : (
            <p className="text-sm text-muted-foreground">No events in the last 7 days.</p>
          )}
        </Panel>
        <Panel title="Attribution by source">
          {data.sources.length ? (
            <SourceBars data={data.sources} />
          ) : (
            <p className="text-sm text-muted-foreground">No attribution data yet.</p>
          )}
        </Panel>
      </div>
      <div className="mt-6">
        <Panel title="Latest leads">
          {data.latestLeads.length === 0 ? (
            <EmptyState
              title="No leads yet"
              body="Leads arrive from your profile enquiry form, tracked links and QR codes."
            />
          ) : (
            <SimpleTable
              columns={["Lead", "Name", "Source", "Stage", "Value", "Agent", "Updated"]}
              rows={data.latestLeads.map((l) => [
                l.id,
                l.name,
                l.source,
                l.stage,
                l.value || "—",
                l.agent,
                <TimeAgo minutes={l.ts} />,
              ])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
