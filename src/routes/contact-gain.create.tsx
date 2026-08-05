import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/contact-gain/create")({
  head: () => ({
    meta: [
      { title: "Create a WhatsApp contact-gain room — GainHub NG" },
      { name: "description", content: "Set up a moderated contact-gain room: name it, set slot limits, publish rules and choose who can join." },
      { property: "og:title", content: "Create a contact-gain room — GainHub NG" },
      { property: "og:description", content: "Publish rules, cap slots and track save-backs for your WhatsApp circle." },
    ],
  }),
  component: CreateRoom,
});

function CreateRoom() {
  return (
    <PublicShell>
      <PageHead eyebrow="Contact gain" title="Create a room" subtitle="Rooms with clear rules and slot limits get approved fastest." />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card className="card-surface">
          <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Room name</Label>
              <Input className="mt-2" placeholder="Lagos Vendors Hub" />
            </div>
            <div>
              <Label>Purpose</Label>
              <Select defaultValue="business">
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
              <Label>Slot limit</Label>
              <Input className="mt-2" defaultValue="5000" />
            </div>
            <div className="sm:col-span-2">
              <Label>House rules</Label>
              <Textarea className="mt-2" placeholder="Save all, post one status daily, no scam links…" />
            </div>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox defaultChecked /> Verified businesses only
            </label>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox defaultChecked /> Remove members who fail save-back checks
            </label>
            <Button className="sm:col-span-2">Submit for approval</Button>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
