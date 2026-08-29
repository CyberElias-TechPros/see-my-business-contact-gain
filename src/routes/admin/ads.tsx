import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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
import { qk, useAd, useAdMutation } from "@/lib/queries";

export const Route = createFileRoute("/admin/ads")({
  component: AdminAds,
});

function AdminAds() {
  const ads = useAd(qk.adAds, (b) => b.adminAds());
  const [open, setOpen] = useState(false);
  const [advertiser, setAdvertiser] = useState("");
  const [inventory, setInventory] = useState("Category result spotlight");
  const [spend, setSpend] = useState("");

  const add = useAdMutation(
    (b, data: { advertiser: string; inventory: string; spend?: string }) => b.adminAddAd(data),
    {
      success: "Placement booked",
      invalidate: [qk.adAds, qk.adOverview],
    },
  );
  const update = useAdMutation(
    (b, vars: { id: string; status: string }) => b.adminUpdateAd(vars.id, vars.status),
    {
      invalidate: [qk.adAds],
    },
  );

  if (ads.isLoading) return <LoadingCard label="Loading ads…" />;
  if (ads.isError)
    return <LoadError message={(ads.error as Error)?.message} retry={() => void ads.refetch()} />;

  const items = ads.data ?? [];
  const active = items.filter((a) => a.status === "Active");
  const totalSpend = items.reduce((acc, a) => acc + Number(a.spend.replace(/\D/g, "") || 0), 0);

  return (
    <div>
      <SectionHead
        title="Ads & promotions"
        subtitle="Sold placements across categories, locations and rooms."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Book placement</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Book a placement</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="ad-adv">Advertiser</Label>
                  <Input
                    id="ad-adv"
                    className="mt-2"
                    value={advertiser}
                    onChange={(e) => setAdvertiser(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Inventory</Label>
                  <Select value={inventory} onValueChange={setInventory}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "Category result spotlight",
                        "Location landing feature",
                        "Contact-gain room banner",
                        "Homepage featured card",
                      ].map((i) => (
                        <SelectItem key={i} value={i}>
                          {i}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="ad-spend">Monthly spend</Label>
                  <Input
                    id="ad-spend"
                    className="mt-2"
                    placeholder="₦250,000"
                    value={spend}
                    onChange={(e) => setSpend(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={add.isPending || advertiser.trim().length < 2}
                  onClick={() =>
                    add.mutate(
                      { advertiser, inventory, spend: spend || undefined },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setAdvertiser("");
                        },
                      },
                    )
                  }
                >
                  Book
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active placements" value={String(active.length)} hint="live" />
        <StatCard label="Total placements" value={String(items.length)} hint="all time" />
        <StatCard label="Booked spend" value={`₦${totalSpend.toLocaleString()}`} hint="monthly" />
        <StatCard
          label="Pausable"
          value={String(items.filter((a) => a.status !== "Completed").length)}
          hint="can pause"
        />
      </div>
      <div className="mt-6">
        <Panel title="Placements">
          {items.length === 0 ? (
            <EmptyState
              title="No placements"
              body="Ad bookings made from the advertise page appear here."
            />
          ) : (
            <SimpleTable
              columns={["ID", "Advertiser", "Inventory", "Spend", "Status", ""]}
              rows={items.map((a) => [
                a.id,
                a.advertiser,
                a.inventory,
                a.spend,
                <Badge
                  variant={
                    a.status === "Active"
                      ? "default"
                      : a.status === "Paused"
                        ? "secondary"
                        : "outline"
                  }
                >
                  {a.status}
                </Badge>,
                a.status === "Active" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      update.mutate(
                        { id: a.id, status: "Paused" },
                        { onSuccess: () => toast.success("Paused") },
                      )
                    }
                  >
                    Pause
                  </Button>
                ) : a.status === "Paused" ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      update.mutate(
                        { id: a.id, status: "Active" },
                        { onSuccess: () => toast.success("Resumed") },
                      )
                    }
                  >
                    Resume
                  </Button>
                ) : null,
              ])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
