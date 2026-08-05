import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, ShieldAlert } from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { contactGainRooms } from "@/data/mock";

export const Route = createFileRoute("/contact-gain/$id")({
  head: ({ params }) => {
    const room = contactGainRooms.find((r) => r.id === params.id);
    const name = room?.name ?? "Contact-gain room";
    return {
      meta: [
        { title: `${name} — WhatsApp contact-gain room | GainHub NG` },
        { name: "description", content: `Join ${name}: published save-back rules, slot limits, member list and moderation history.` },
        { property: "og:title", content: `${name} — contact-gain room` },
        { property: "og:description", content: `Moderated WhatsApp save-back room with tracked participation.` },
      ],
    };
  },
  component: RoomPage,
});

const members = [
  { name: "SwiftFix Gadgets", niche: "Phone repair", saveBack: 98 },
  { name: "Adire Atelier", niche: "Fashion", saveBack: 94 },
  { name: "Mama Ope Kitchen", niche: "Food", saveBack: 88 },
  { name: "Rapid Dispatch NG", niche: "Logistics", saveBack: 71 },
  { name: "Glow by Tola", niche: "Beauty", saveBack: 64 },
];

function RoomPage() {
  const { id } = Route.useParams();
  const room = contactGainRooms.find((r) => r.id === id) ?? contactGainRooms[0]!;

  return (
    <PublicShell>
      <PageHead
        eyebrow="Contact-gain room"
        title={room.name}
        subtitle={`${room.purpose} • ${room.members.toLocaleString()} members • ${room.slotsLeft} slots left`}
        action={
          <div className="flex gap-2">
            <Button className="gap-2">
              <MessageCircle className="size-4" /> Join and save all
            </Button>
            <Button variant="outline" className="gap-2">
              <ShieldAlert className="size-4" /> Report room
            </Button>
          </div>
        }
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 lg:grid-cols-[1fr_320px]">
        <Tabs defaultValue="members">
          <TabsList>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="status">Status board</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <TabsContent value="members" className="space-y-3 pt-6">
            {members.map((m) => (
              <Card key={m.name} className="card-surface">
                <CardContent className="flex items-center gap-4 p-5">
                  <span className="grid size-11 place-items-center rounded-xl bg-secondary font-semibold">
                    {m.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{m.name}</p>
                    <p className="text-xs text-muted-foreground">{m.niche}</p>
                  </div>
                  <div className="ml-auto w-32">
                    <p className="text-right text-xs text-muted-foreground">Save-back {m.saveBack}%</p>
                    <Progress value={m.saveBack} className="mt-1 h-1.5" />
                  </div>
                  <Button size="sm" variant="outline">
                    Save contact
                  </Button>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="rules" className="pt-6">
            <Card className="card-surface">
              <CardContent className="space-y-2 p-6 text-sm text-muted-foreground">
                <p className="font-semibold text-foreground">House rules</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>{room.rule}</li>
                  <li>No adult content, betting links or loan-shark offers.</li>
                  <li>No mass forwarding of unrelated promotions.</li>
                  <li>Members who delete contacts within 7 days lose their slot.</li>
                  <li>Repeated reports lead to permanent removal from all rooms.</li>
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="status" className="pt-6">
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="card-surface overflow-hidden">
                  <div className="grid h-40 place-items-center bg-hero-mesh text-xs text-muted-foreground">
                    Status post {i + 1}
                  </div>
                  <CardContent className="p-3 text-xs text-muted-foreground">Posted by member {i + 1} • 2h</CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="activity" className="pt-6">
            <Card className="card-surface">
              <CardContent className="divide-y p-0 text-sm">
                {[
                  "Amina joined the room",
                  "3 members removed for not saving back",
                  "Moderator reviewed 2 reports",
                  "Room capacity increased to 5,000",
                ].map((a) => (
                  <p key={a} className="p-4 text-muted-foreground">
                    {a}
                  </p>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        <aside className="space-y-4">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-5 text-sm">
              <p className="font-semibold">Room details</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Coverage</span>
                <span>{room.state}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Entry</span>
                <span>{room.verifiedOnly ? "Verified only" : "Open"}</span>
              </div>
              <Separator />
              <p className="text-muted-foreground">
                Your save-back score determines access to premium rooms. Keep it above 80%.
              </p>
              <Badge variant="secondary">Your score: 92%</Badge>
            </CardContent>
          </Card>
        </aside>
      </div>
    </PublicShell>
  );
}
