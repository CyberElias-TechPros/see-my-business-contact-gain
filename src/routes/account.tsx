import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import {
  BusinessCard,
  EmptyState,
  LoadError,
  LoadingCard,
  SimpleTable,
  TimeAgo,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { timeAgo } from "@/lib/api";
import {
  useMe,
  useMyEnquiries,
  useMyReviews,
  useSaved,
  useSignOut,
  useUpdateMe,
} from "@/lib/queries";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — saved businesses, enquiries and reviews | GainHub NG" },
      {
        name: "description",
        content:
          "Manage your saved businesses, enquiry history, reviews, notifications and privacy preferences.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  const { data: me, isLoading } = useMe();
  const saved = useSaved();
  const myReviews = useMyReviews();
  const myEnquiries = useMyEnquiries();
  const updateMe = useUpdateMe();
  const signOut = useSignOut();
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [prefs, setPrefs] = useState<{ wa: boolean; showName: boolean; weekly: boolean }>({
    wa: true,
    showName: true,
    weekly: false,
  });

  if (isLoading) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-5xl px-4 py-16">
          <LoadingCard label="Loading your account…" />
        </div>
      </PublicShell>
    );
  }

  if (!me) {
    return (
      <PublicShell>
        <PageHead eyebrow="Account" title="My account" />
        <div className="mx-auto max-w-md px-4 py-12">
          <EmptyState
            title="You're not signed in"
            body="Sign in to see your saved businesses, enquiries and reviews — or create an account in seconds."
            action={
              <Button asChild>
                <Link to="/auth" search={{ redirect: "/account" }}>
                  Sign in
                </Link>
              </Button>
            }
          />
        </div>
      </PublicShell>
    );
  }

  return (
    <PublicShell>
      <PageHead
        eyebrow="Account"
        title={`Hi, ${me.name.split(" ")[0]}`}
        subtitle="Saved businesses, enquiries, reviews and privacy settings."
        action={
          <Button
            variant="outline"
            onClick={() =>
              signOut.mutate(undefined, {
                onSuccess: () => toast.success("Signed out"),
              })
            }
          >
            Sign out
          </Button>
        }
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <Tabs defaultValue="saved">
          <TabsList>
            <TabsTrigger value="saved">Saved ({saved.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="enquiries">
              My enquiries ({myEnquiries.data?.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="reviews">My reviews ({myReviews.data?.length ?? 0})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="saved" className="pt-6">
            {saved.isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <LoadingCard key={i} />
                ))}
              </div>
            ) : saved.isError ? (
              <LoadError
                message={(saved.error as Error).message}
                retry={() => void saved.refetch()}
              />
            ) : (saved.data ?? []).length === 0 ? (
              <EmptyState
                title="Nothing saved yet"
                body="Tap the bookmark on any business profile to keep it here for later."
                action={
                  <Button asChild variant="outline">
                    <Link to="/search">Browse businesses</Link>
                  </Button>
                }
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {(saved.data ?? []).map((b) => (
                  <BusinessCard key={b.id} business={b} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="enquiries" className="pt-6">
            {(myEnquiries.data ?? []).length === 0 ? (
              <EmptyState
                title="No enquiries yet"
                body="When you request a quote from a business, it shows up here."
              />
            ) : (
              <Card className="card-surface">
                <CardContent className="p-4">
                  <SimpleTable
                    columns={["Business", "Message", "Service", "Status", "When"]}
                    rows={(myEnquiries.data ?? []).map((e) => [
                      String(e["businessName"] ?? e["businessId"] ?? "—"),
                      <span className="block max-w-xs truncate">{String(e["message"] ?? "")}</span>,
                      String(e["service"] ?? "—"),
                      String(e["status"] ?? "New"),
                      <TimeAgo minutes={Number(e["ts"] ?? 0)} />,
                    ])}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="reviews" className="space-y-4 pt-6">
            {(myReviews.data ?? []).length === 0 ? (
              <EmptyState
                title="No reviews written yet"
                body="Reviews you publish on business profiles appear here."
              />
            ) : (
              (myReviews.data ?? []).map((r) => (
                <Card key={r.id} className="card-surface">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <Link
                        to="/business/$id"
                        params={{ id: r.businessId }}
                        className="font-medium hover:text-primary"
                      >
                        {r.businessId.replace(/-/g, " ")}
                      </Link>
                      <span className="flex items-center gap-1 text-sm">
                        {Array.from({ length: r.rating }).map((_, i) => (
                          <Star key={i} className="size-3.5 fill-accent text-accent" />
                        ))}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{r.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {timeAgo(r.ts)} • {r.status}
                    </p>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="settings" className="pt-6">
            <Card className="card-surface">
              <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                <div>
                  <Label htmlFor="acct-name">Full name</Label>
                  <Input
                    id="acct-name"
                    className="mt-2"
                    placeholder={me.name}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="acct-wa">WhatsApp number</Label>
                  <Input
                    id="acct-wa"
                    className="mt-2"
                    placeholder={me.whatsapp ?? "0803 000 0000"}
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                  />
                </div>
                <div className="space-y-3 sm:col-span-2">
                  {(
                    [
                      ["Allow businesses to message me on WhatsApp", "wa"],
                      ["Show my name on reviews", "showName"],
                      ["Email me weekly recommendations", "weekly"],
                    ] as const
                  ).map(([label, key]) => (
                    <label key={key} className="flex items-center justify-between gap-3 text-sm">
                      <span>{label}</span>
                      <Switch
                        checked={prefs[key]}
                        onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                      />
                    </label>
                  ))}
                </div>
                <Button
                  className="sm:col-span-2"
                  disabled={updateMe.isPending}
                  onClick={() =>
                    updateMe.mutate(
                      {
                        ...(name ? { name } : {}),
                        ...(whatsapp ? { whatsapp } : {}),
                        prefs: {
                          allowWhatsapp: prefs.wa,
                          showNameOnReviews: prefs.showName,
                          weeklyEmail: prefs.weekly,
                        },
                      },
                      {
                        onSuccess: () => {
                          setName("");
                          setWhatsapp("");
                        },
                      },
                    )
                  }
                >
                  Save changes
                </Button>
                <Button asChild variant="outline" className="sm:col-span-2">
                  <Link to="/legal/data-request">Request my data / delete account</Link>
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PublicShell>
  );
}
