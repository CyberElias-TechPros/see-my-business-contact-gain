import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SectionHead } from "@/components/console/ConsoleShell";
import { LoadError, LoadingCard, VerifiedBadge } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { qk, useWs, useWsMutation } from "@/lib/queries";

export const Route = createFileRoute("/app/profile")({
  component: WorkspaceProfile,
});

function WorkspaceProfile() {
  const profile = useWs(qk.wsProfile, (b) => b.workspaceProfile());
  const [form, setForm] = useState({
    name: "",
    tagline: "",
    about: "",
    address: "",
    whatsapp: "",
    phone: "",
    website: "",
    openNow: true,
  });

  useEffect(() => {
    const b = profile.data;
    if (b) {
      setForm({
        name: b.name,
        tagline: b.tagline,
        about: b.about,
        address: b.address,
        whatsapp: b.whatsapp,
        phone: b.phone,
        website: b.website,
        openNow: b.openNow,
      });
    }
  }, [profile.data]);

  const save = useWsMutation((b, data: Record<string, unknown>) => b.updateProfile(data), {
    success: "Profile saved — changes are live on your public listing",
    invalidate: [qk.wsProfile, qk.wsSummary],
  });

  if (profile.isLoading) return <LoadingCard label="Loading your profile…" />;
  if (profile.isError)
    return (
      <LoadError message={(profile.error as Error)?.message} retry={() => void profile.refetch()} />
    );

  const b = profile.data!;
  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));
  const dirty =
    JSON.stringify(form) !==
    JSON.stringify({
      name: b.name,
      tagline: b.tagline,
      about: b.about,
      address: b.address,
      whatsapp: b.whatsapp,
      phone: b.phone,
      website: b.website,
      openNow: b.openNow,
    });

  return (
    <div>
      <SectionHead
        title="Business profile"
        subtitle="This is what customers see on your public listing."
        action={
          <div className="flex items-center gap-2">
            <VerifiedBadge level={b.verified} />
            <Button disabled={!dirty || save.isPending} onClick={() => save.mutate(form)}>
              {save.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="card-surface lg:col-span-2">
          <CardContent className="grid gap-4 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pf-name">Business name</Label>
                <Input
                  id="pf-name"
                  className="mt-2"
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pf-tagline">Tagline</Label>
                <Input
                  id="pf-tagline"
                  className="mt-2"
                  value={form.tagline}
                  onChange={(e) => set("tagline", e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="pf-about">About</Label>
              <Textarea
                id="pf-about"
                className="mt-2 min-h-32"
                value={form.about}
                onChange={(e) => set("about", e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pf-address">Address</Label>
              <Input
                id="pf-address"
                className="mt-2"
                value={form.address}
                onChange={(e) => set("address", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="pf-wa">WhatsApp</Label>
                <Input
                  id="pf-wa"
                  className="mt-2"
                  value={form.whatsapp}
                  onChange={(e) => set("whatsapp", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pf-phone">Phone</Label>
                <Input
                  id="pf-phone"
                  className="mt-2"
                  value={form.phone}
                  onChange={(e) => set("phone", e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="pf-web">Website</Label>
                <Input
                  id="pf-web"
                  className="mt-2"
                  value={form.website}
                  onChange={(e) => set("website", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-5 text-sm">
              {(() => {
                const checks: { label: string; done: boolean }[] = [
                  { label: "Add a tagline", done: b.tagline.trim().length > 0 },
                  {
                    label: "Write your about section (300+ chars)",
                    done: b.about.trim().length >= 300,
                  },
                  { label: "Add at least 3 services", done: b.services.length >= 3 },
                  { label: "Add at least 1 product", done: b.products.length >= 1 },
                  { label: "Add your address", done: b.address.trim().length > 0 },
                  { label: "Add your WhatsApp number", done: b.whatsapp.trim().length > 0 },
                  { label: "Add your opening hours", done: (b.hours?.length ?? 0) > 0 },
                  { label: "Link a social account", done: b.socials.length > 0 },
                  { label: "List your team", done: b.team.length > 0 },
                ];
                const done = checks.filter((c) => c.done).length;
                const pct = Math.round((done / checks.length) * 100);
                const missing = checks.filter((c) => !c.done).slice(0, 3);
                return (
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Profile completeness</p>
                      <span className="font-bold text-primary">{pct}%</span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Complete listings get up to 3× more WhatsApp contacts.
                    </p>
                    {missing.length ? (
                      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                        {missing.map((c) => (
                          <li key={c.label}>+ {c.label}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-primary">Fully complete — nice work!</p>
                    )}
                  </div>
                );
              })()}
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-5 text-sm">
              <p className="font-semibold">Listing status</p>
              <label className="flex items-center justify-between gap-3">
                <span>Show as open now</span>
                <Switch checked={form.openNow} onCheckedChange={(v) => set("openNow", v)} />
              </label>
              <p className="text-muted-foreground">
                Category: <Badge variant="secondary">{b.categorySlug}</Badge>
              </p>
              <p className="text-muted-foreground">Plan: {b.plan}</p>
              <p className="text-muted-foreground">
                Listing: <span className="capitalize">{b.id}</span>
              </p>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-2 p-5 text-sm">
              <p className="font-semibold">Verification</p>
              <p className="text-muted-foreground">
                {b.verified === "unverified"
                  ? "Verified listings get up to 3× more contacts. Submit your CAC certificate or utility bill to verification."
                  : `Your listing is ${b.verified}-verified.`}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
