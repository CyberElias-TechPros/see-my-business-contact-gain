import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldCheck, Users } from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { contactGainRooms } from "@/data/mock";

export const Route = createFileRoute("/contact-gain/")({
  head: () => ({
    meta: [
      { title: "WhatsApp contact-gain rooms in Nigeria — GainHub NG" },
      {
        name: "description",
        content:
          "Join moderated WhatsApp contact-gain rooms with published save-back rules, slot limits and verified-only options. Grow your status reach safely.",
      },
      { property: "og:title", content: "WhatsApp contact-gain rooms — GainHub NG" },
      { property: "og:description", content: "Moderated save-back circles for Nigerian vendors and hustlers." },
    ],
  }),
  component: ContactGainPage,
});

function ContactGainPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Contact gain"
        title="Grow your WhatsApp contacts, safely"
        subtitle="Contact gain is how many Nigerians advertise: get saved, then your status reaches thousands. Our rooms add moderation, slot limits, save-back tracking and reporting."
        action={
          <Button asChild>
            <Link to="/contact-gain/create">Create a room</Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-7xl space-y-10 px-4 py-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: Users, t: "Save-back score", d: "Members who never save back lose access. Your score is visible before you join." },
            { icon: ShieldCheck, t: "Moderated content", d: "AI pre-screening plus human review for nudity, scams and impersonation." },
            { icon: Users, t: "Slot limits", d: "Rooms cap membership so status reach stays useful and phones stay usable." },
          ].map((x) => (
            <Card key={x.t} className="card-surface">
              <CardContent className="p-6">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <x.icon className="size-5" />
                </span>
                <h2 className="mt-4 font-semibold">{x.t}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{x.d}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="card-surface">
          <CardContent className="flex flex-col gap-3 p-5 sm:flex-row">
            <Input placeholder="Search rooms by name or niche" className="sm:flex-1" />
            <Select defaultValue="all">
              <SelectTrigger className="sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All states</SelectItem>
                <SelectItem value="lagos">Lagos</SelectItem>
                <SelectItem value="abuja">Abuja</SelectItem>
              </SelectContent>
            </Select>
            <Button>Find rooms</Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          {contactGainRooms.map((r) => (
            <Card key={r.id} className="card-surface">
              <CardContent className="space-y-3 p-6">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-lg font-semibold">{r.name}</h3>
                  {r.verifiedOnly ? <Badge>Verified only</Badge> : <Badge variant="outline">Open</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{r.purpose}</p>
                <div className="grid grid-cols-3 gap-2 rounded-xl bg-muted p-3 text-center text-xs">
                  <div>
                    <p className="font-display text-lg font-bold">{r.members.toLocaleString()}</p>
                    <p className="text-muted-foreground">Members</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold">{r.slotsLeft}</p>
                    <p className="text-muted-foreground">Slots left</p>
                  </div>
                  <div>
                    <p className="font-display text-lg font-bold">{r.state}</p>
                    <p className="text-muted-foreground">Coverage</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">House rule: {r.rule}</p>
                <div className="flex gap-2">
                  <Button asChild className="flex-1">
                    <Link to="/contact-gain/$id" params={{ id: r.id }}>
                      Open room
                    </Link>
                  </Button>
                  <Button variant="outline">Join queue</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </PublicShell>
  );
}
