import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MessageCircle, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { EmptyState, LoadError, LoadingCard } from "@/components/kit";
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
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/api";
import { useJoinRoom, useMe, useReportRoom, useRoom } from "@/lib/queries";

export const Route = createFileRoute("/contact-gain/$id")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.id.replace(/-/g, " ")} — WhatsApp contact-gain room | GainHub NG` },
      {
        name: "description",
        content: `Join this contact-gain room: published save-back rules, slot limits, member list and moderation history.`,
      },
    ],
  }),
  component: RoomPage,
});

function RoomPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const query = useRoom(id);
  const { data: me } = useMe();
  const join = useJoinRoom();
  const report = useReportRoom();
  const [reportText, setReportText] = useState("");

  if (query.isLoading) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-7xl px-4 py-16">
          <LoadingCard label="Loading room…" />
        </div>
      </PublicShell>
    );
  }
  if (query.isError) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-7xl px-4 py-16">
          <LoadError message={(query.error as Error)?.message} retry={() => void query.refetch()} />
        </div>
      </PublicShell>
    );
  }

  const room = query.data!;

  return (
    <PublicShell>
      <PageHead
        eyebrow="Contact-gain room"
        title={room.name}
        subtitle={`${room.purpose} • ${room.members.toLocaleString()} members • ${room.slotsLeft ?? 0} slots left`}
        action={
          <div className="flex gap-2">
            <Button
              className="gap-2"
              disabled={join.isPending}
              onClick={() =>
                me
                  ? join.mutate(room.id)
                  : void navigate({ to: "/auth", search: { redirect: `/contact-gain/${room.id}` } })
              }
            >
              <MessageCircle className="size-4" /> Join and save all
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                  <ShieldAlert className="size-4" /> Report room
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Report “{room.name}”</DialogTitle>
                </DialogHeader>
                <Textarea
                  placeholder="What's wrong with this room? Scam links, fake save-backs, impersonation…"
                  value={reportText}
                  onChange={(e) => setReportText(e.target.value)}
                />
                <DialogFooter>
                  <Button
                    disabled={reportText.trim().length < 5 || report.isPending}
                    onClick={() =>
                      report.mutate(
                        { id: room.id, details: reportText },
                        { onSuccess: () => setReportText("") },
                      )
                    }
                  >
                    {report.isPending ? "Sending…" : "Send report"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
            {room.members.length === 0 ? (
              <EmptyState
                title="No members listed yet"
                body="Be among the first to join and set the tone for this room."
              />
            ) : (
              room.members.map((m) => (
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
                      <p className="text-right text-xs text-muted-foreground">
                        Save-back {m.saveBack}%
                      </p>
                      <Progress value={m.saveBack} className="mt-1 h-1.5" />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        toast.success(`${m.name} saved — remember to save back within 24h!`)
                      }
                    >
                      Save contact
                    </Button>
                  </CardContent>
                </Card>
              ))
            )}
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
                  <CardContent className="p-3 text-xs text-muted-foreground">
                    Posted by member {i + 1} • 2h
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="activity" className="pt-6">
            <Card className="card-surface">
              <CardContent className="divide-y p-0 text-sm">
                {room.activity.length === 0 ? (
                  <p className="p-4 text-muted-foreground">No activity yet.</p>
                ) : (
                  room.activity.map((a) => (
                    <div
                      key={`${a.text}-${a.ts}`}
                      className="flex items-center justify-between p-4"
                    >
                      <p className="text-muted-foreground">{a.text}</p>
                      <span className="text-xs text-muted-foreground">{timeAgo(a.ts)}</span>
                    </div>
                  ))
                )}
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
