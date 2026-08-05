import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { categories, locations } from "@/data/mock";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "List your business free — GainHub NG onboarding" },
      {
        name: "description",
        content: "Create a full business profile in minutes: category, address, hours, services, products, photos and a WhatsApp contact button.",
      },
      { property: "og:title", content: "List your business free — GainHub NG" },
      { property: "og:description", content: "Publish a complete profile and start receiving WhatsApp leads today." },
    ],
  }),
  component: JoinPage,
});

const steps = [
  "Account",
  "Business basics",
  "Category & attributes",
  "Location & hours",
  "Contact channels",
  "Services & products",
  "Media",
  "Verification",
  "Publish",
];

function JoinPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Onboarding"
        title="List your business"
        subtitle="Nine short steps. You can publish after step 5 and finish the rest later."
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[240px_1fr]">
        <aside className="card-surface h-fit p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Progress</p>
          <Progress value={45} className="mt-3 h-2" />
          <ol className="mt-4 space-y-2 text-sm">
            {steps.map((s, i) => (
              <li key={s} className={`flex items-center gap-2 ${i < 4 ? "text-primary" : "text-muted-foreground"}`}>
                {i < 4 ? <Check className="size-4" /> : <span className="grid size-4 place-items-center text-xs">{i + 1}</span>}
                {s}
              </li>
            ))}
          </ol>
        </aside>
        <Card className="card-surface">
          <CardContent className="grid gap-5 p-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Badge variant="secondary">Step 5 of 9 — Contact channels</Badge>
            </div>
            <div>
              <Label>Business name</Label>
              <Input className="mt-2" placeholder="SwiftFix Gadgets" />
            </div>
            <div>
              <Label>Tagline</Label>
              <Input className="mt-2" placeholder="Phone & laptop repair in 45 minutes" />
            </div>
            <div>
              <Label>Category</Label>
              <Select defaultValue={categories[0]!.slug}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>City</Label>
              <Select defaultValue={locations[0]!.slug}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.slug} value={l.slug}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>WhatsApp number</Label>
              <Input className="mt-2" placeholder="0803 000 0000" />
            </div>
            <div>
              <Label>Phone number</Label>
              <Input className="mt-2" placeholder="0803 000 0000" />
            </div>
            <div className="sm:col-span-2">
              <Label>About your business</Label>
              <Textarea className="mt-2" placeholder="What you do, who you serve, and how fast you respond" />
            </div>
            <div className="sm:col-span-2 space-y-2">
              <p className="text-sm font-medium">Lead capture</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox defaultChecked /> Generate a click-to-WhatsApp link and QR code
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox defaultChecked /> Send an automatic acknowledgement to new enquiries
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox /> Show a quote request form on my profile
              </label>
            </div>
            <div className="sm:col-span-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Drag and drop your logo, cover photo, shop photos, product images and CAC certificate
            </div>
            <div className="flex gap-2 sm:col-span-2">
              <Button variant="outline">Back</Button>
              <Button className="flex-1">Save and continue</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
