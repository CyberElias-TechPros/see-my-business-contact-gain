import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { BusinessCard, SimpleTable } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { businesses, reviews } from "@/data/mock";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My account — saved businesses, enquiries and reviews | GainHub NG" },
      {
        name: "description",
        content:
          "Manage your saved businesses, enquiry history, reviews, notifications and privacy preferences.",
      },
      { property: "og:title", content: "My account — GainHub NG" },
      {
        property: "og:description",
        content: "Saved businesses, enquiry history, reviews and notification settings.",
      },
    ],
  }),
  component: AccountPage,
});

function AccountPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Consumer"
        title="My account"
        subtitle="Everything you have saved, asked and reviewed."
      />
      <div className="mx-auto max-w-6xl px-4 py-12">
        <Tabs defaultValue="saved">
          <TabsList className="flex-wrap">
            <TabsTrigger value="saved">Saved</TabsTrigger>
            <TabsTrigger value="enquiries">Enquiries</TabsTrigger>
            <TabsTrigger value="reviews">My reviews</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="settings">Settings & privacy</TabsTrigger>
          </TabsList>
          <TabsContent value="saved" className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.slice(0, 6).map((b) => (
                <BusinessCard key={b.id} business={b} />
              ))}
            </div>
          </TabsContent>
          <TabsContent value="enquiries" className="pt-6">
            <Card className="card-surface">
              <CardContent className="p-4">
                <SimpleTable
                  columns={["Business", "Request", "Channel", "Status", "Date"]}
                  rows={[
                    ["SwiftFix Gadgets", "iPhone 13 screen", "WhatsApp", "Replied", "Today"],
                    ["Adire Atelier", "Aso-oke set quote", "Form", "Awaiting quote", "Yesterday"],
                    ["Rapid Dispatch NG", "Same-day pickup", "WhatsApp", "Completed", "2 Aug"],
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="reviews" className="space-y-3 pt-6">
            {reviews.map((r) => (
              <Card key={r.author} className="card-surface">
                <CardContent className="p-5">
                  <p className="font-medium">
                    {r.rating}★ — {r.when}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
          <TabsContent value="notifications" className="pt-6">
            <Card className="card-surface">
              <CardContent className="divide-y p-0 text-sm">
                {[
                  "SwiftFix replied to your enquiry",
                  "Adire Atelier posted a new offer",
                  "Your review was published",
                ].map((n) => (
                  <p key={n} className="p-4">
                    {n}
                  </p>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="settings" className="pt-6">
            <Card className="card-surface">
              <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
                <div>
                  <Label>Full name</Label>
                  <Input className="mt-2" defaultValue="Blessing Eze" />
                </div>
                <div>
                  <Label>WhatsApp number</Label>
                  <Input className="mt-2" defaultValue="0803 000 0000" />
                </div>
                <div className="space-y-3 sm:col-span-2">
                  {[
                    "Allow businesses to message me on WhatsApp",
                    "Show my name on reviews",
                    "Email me weekly recommendations",
                  ].map((s) => (
                    <label key={s} className="flex items-center justify-between gap-3 text-sm">
                      <span>{s}</span>
                      <Switch defaultChecked />
                    </label>
                  ))}
                </div>
                <Button className="sm:col-span-2">Save changes</Button>
                <Button variant="outline" className="sm:col-span-2">
                  Request my data / delete account
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </PublicShell>
  );
}
