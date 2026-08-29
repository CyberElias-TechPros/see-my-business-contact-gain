import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateRoom, useMe } from "@/lib/queries";

export const Route = createFileRoute("/contact-gain/create")({
  head: () => ({
    meta: [
      { title: "Create a WhatsApp contact-gain room — GainHub NG" },
      {
        name: "description",
        content:
          "Set up a moderated contact-gain room: name it, set slot limits, publish rules and choose who can join.",
      },
    ],
  }),
  component: CreateRoom,
});

function CreateRoom() {
  const navigate = useNavigate();
  const { data: me } = useMe();
  const create = useCreateRoom();
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("business");
  const [slots, setSlots] = useState("5000");
  const [rules, setRules] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const [autoRemove, setAutoRemove] = useState(true);

  return (
    <PublicShell>
      <PageHead
        eyebrow="Contact gain"
        title="Create a room"
        subtitle="Rooms with clear rules and slot limits get approved fastest."
      />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card className="card-surface">
          <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="room-name">Room name</Label>
              <Input
                id="room-name"
                className="mt-2"
                placeholder="Lagos Vendors Hub"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label>Purpose</Label>
              <Select value={purpose} onValueChange={setPurpose}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="business">Business promotion</SelectItem>
                  <SelectItem value="niche">Niche vendors</SelectItem>
                  <SelectItem value="network">General networking</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="room-slots">Slot limit</Label>
              <Input
                id="room-slots"
                type="number"
                min={50}
                max={5000}
                className="mt-2"
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="room-rules">House rules</Label>
              <Textarea
                id="room-rules"
                className="mt-2"
                placeholder="Save all, post one status daily, no scam links…"
                value={rules}
                onChange={(e) => setRules(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox
                checked={verifiedOnly}
                onCheckedChange={(v) => setVerifiedOnly(v === true)}
              />{" "}
              Verified businesses only
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={autoRemove} onCheckedChange={(v) => setAutoRemove(v === true)} />{" "}
              Remove members who fail save-back checks
            </label>
            <Button
              className="sm:col-span-2"
              disabled={create.isPending || name.trim().length < 3}
              onClick={() => {
                if (!me) {
                  void navigate({ to: "/auth", search: { redirect: "/contact-gain/create" } });
                  return;
                }
                create.mutate(
                  {
                    name,
                    purpose,
                    slots: Number(slots) || 5000,
                    rule: rules,
                    verifiedOnly,
                  },
                  {
                    onSuccess: () => {
                      toast.success(
                        "Room submitted — our moderators review new rooms within 24 hours.",
                      );
                      void navigate({ to: "/contact-gain" });
                    },
                  },
                );
              }}
            >
              {create.isPending ? "Submitting…" : "Submit for approval"}
            </Button>
            {!me ? (
              <p className="text-xs text-muted-foreground sm:col-span-2">
                You'll need an account to create a room — you'll be asked to sign in first.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
