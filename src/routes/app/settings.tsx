import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SectionHead } from "@/components/console/ConsoleShell";
import { LoadError, LoadingCard } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { qk, useSignOut, useWs, useWsMutation } from "@/lib/queries";

export const Route = createFileRoute("/app/settings")({
  component: WorkspaceSettings,
});

function WorkspaceSettings() {
  const navigate = useNavigate();
  const profile = useWs(qk.wsProfile, (b) => b.workspaceProfile());
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notifyLeads, setNotifyLeads] = useState(true);
  const [notifyWeekly, setNotifyWeekly] = useState(true);

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.name);
      setWhatsapp(profile.data.whatsapp);
    }
  }, [profile.data]);

  const save = useWsMutation((b, data: Record<string, unknown>) => b.updateProfile(data), {
    success: "Settings saved",
    invalidate: [qk.wsProfile],
  });
  const signOut = useSignOut();

  if (profile.isLoading) return <LoadingCard label="Loading settings…" />;
  if (profile.isError)
    return (
      <LoadError message={(profile.error as Error)?.message} retry={() => void profile.refetch()} />
    );

  return (
    <div>
      <SectionHead title="Settings" subtitle="Workspace preferences, notifications and account." />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="card-surface">
          <CardContent className="space-y-4 p-6">
            <h3 className="font-semibold">Account</h3>
            <div>
              <Label htmlFor="st-name">Your name</Label>
              <Input
                id="st-name"
                className="mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="st-wa">WhatsApp number</Label>
              <Input
                id="st-wa"
                className="mt-2"
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
              />
            </div>
            <Button
              disabled={save.isPending || !name.trim()}
              onClick={() => save.mutate({ name, whatsapp })}
            >
              Save account
            </Button>
          </CardContent>
        </Card>
        <Card className="card-surface">
          <CardContent className="space-y-4 p-6">
            <h3 className="font-semibold">Notifications</h3>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                <span className="font-medium">New lead alerts</span>
                <span className="block text-muted-foreground">
                  Get notified the moment a lead arrives
                </span>
              </span>
              <Switch checked={notifyLeads} onCheckedChange={setNotifyLeads} />
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>
                <span className="font-medium">Weekly performance email</span>
                <span className="block text-muted-foreground">
                  Views, chats and top content every Monday
                </span>
              </span>
              <Switch checked={notifyWeekly} onCheckedChange={setNotifyWeekly} />
            </label>
            <Button
              variant="outline"
              onClick={() => toast.success("Notification preferences saved")}
            >
              Save notifications
            </Button>
          </CardContent>
        </Card>
        <Card className="card-surface">
          <CardContent className="space-y-3 p-6">
            <h3 className="font-semibold">Data & privacy</h3>
            <p className="text-sm text-muted-foreground">
              Export everything we hold about your workspace, or request deletion under NDPR.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() =>
                  toast.success("Data export started — we'll email you when it's ready")
                }
              >
                Request data export
              </Button>
              <Button variant="outline" asChild>
                <a href="/legal/data-request">Data request form</a>
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className="card-surface border-destructive/40">
          <CardContent className="space-y-3 p-6">
            <h3 className="font-semibold text-destructive">Sign out</h3>
            <p className="text-sm text-muted-foreground">End this session on this device.</p>
            <Button
              variant="destructive"
              onClick={() =>
                signOut.mutate(undefined, {
                  onSuccess: () => {
                    toast.success("Signed out");
                    void navigate({ to: "/" });
                  },
                })
              }
            >
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
