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
import { qk, useWs, useWsMutation } from "@/lib/queries";

export const Route = createFileRoute("/app/team")({
  component: WorkspaceTeam,
});

function WorkspaceTeam() {
  const team = useWs(qk.wsTeam, (b) => b.workspaceTeam());
  const profile = useWs(qk.wsProfile, (b) => b.workspaceProfile());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Agent");

  const invite = useWsMutation(
    (b, data: { name: string; email: string; role?: string }) => b.inviteMember(data),
    {
      success: "Invitation sent — they'll appear here once they accept",
      invalidate: [qk.wsTeam],
    },
  );
  const remove = useWsMutation((b, id: string) => b.removeMember(id), {
    invalidate: [qk.wsTeam],
  });

  if (team.isLoading) return <LoadingCard label="Loading team…" />;
  if (team.isError)
    return <LoadError message={(team.error as Error)?.message} retry={() => void team.refetch()} />;

  const members = team.data ?? [];
  const seats = profile.data?.plan === "Pro" ? 10 : profile.data?.plan === "Growth" ? 3 : 1;
  const used = members.length;

  return (
    <div>
      <SectionHead
        title="Team"
        subtitle="Invite agents, assign leads and keep response times low."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Invite member</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite a team member</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="tm-name">Name</Label>
                  <Input
                    id="tm-name"
                    className="mt-2"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="tm-email">Work email</Label>
                  <Input
                    id="tm-email"
                    type="email"
                    className="mt-2"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Agent", "Manager", "Owner"].map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={invite.isPending || !name || !email.includes("@")}
                  onClick={() =>
                    invite.mutate(
                      { name, email, role },
                      {
                        onSuccess: () => {
                          setOpen(false);
                          setName("");
                          setEmail("");
                        },
                      },
                    )
                  }
                >
                  Send invite
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Members" value={String(members.length)} hint="invited" />
        <StatCard
          label="Seats"
          value={`${used}/${seats}`}
          hint={profile.data ? `${profile.data.plan} plan` : ""}
        />
        <StatCard
          label="Active"
          value={String(members.filter((m) => m.status === "Active").length)}
          hint="responding"
        />
        <StatCard
          label="Invited"
          value={String(members.filter((m) => m.status !== "Active").length)}
          hint="pending accept"
        />
      </div>
      <div className="mt-6">
        <Panel title="Members">
          {members.length === 0 ? (
            <EmptyState title="No members yet" body="Invite agents so leads get answered faster." />
          ) : (
            <SimpleTable
              columns={["Name", "Email", "Role", "Status", ""]}
              rows={members.map((m) => [
                m.name,
                m.email,
                m.role,
                <Badge variant={m.status === "Active" ? "default" : "outline"}>{m.status}</Badge>,
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() =>
                    remove.mutate(m.id, { onSuccess: () => toast.success("Member removed") })
                  }
                >
                  Remove
                </Button>,
              ])}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
