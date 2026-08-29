import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useSubmitForm } from "@/lib/forms";

export const Route = createFileRoute("/advertise")({
  head: () => ({
    meta: [
      { title: "Advertise & sponsored placement — GainHub NG" },
      {
        name: "description",
        content:
          "Buy sponsored placement in category and location results, room spotlights and homepage features.",
      },
      { property: "og:title", content: "Advertise & sponsored placement — GainHub NG" },
      {
        property: "og:description",
        content:
          "Buy sponsored placement in category and location results, room spotlights and homepage features.",
      },
    ],
  }),
  component: Page5435,
});

function Page5435() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Advertisers"
        title="Advertise & sponsored placement"
        subtitle="Buy sponsored placement in category and location results, room spotlights and homepage features."
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Inventory</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Category result spotlight</li>
                <li>Location landing feature</li>
                <li>Contact-gain room banner</li>
                <li>Homepage featured card</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">Reporting</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Impressions, clicks and WhatsApp chats started</li>
                <li>Cost per contact gained</li>
                <li>Campaign pacing and budget alerts</li>
              </ul>
            </CardContent>
          </Card>
        </div>
        <AdvertiseForm />
      </div>
    </PublicShell>
  );
}

function AdvertiseForm() {
  const navigate = useNavigate();
  const [business, setBusiness] = useState("");
  const [inventory, setInventory] = useState("Category result spotlight");
  const [budget, setBudget] = useState("");
  const [contact, setContact] = useState("");
  const [details, setDetails] = useState("");
  const submit = useSubmitForm("suggestion", (backend, data) => backend.postSuggestion(data), {
    success: "Enquiry sent — the ads team will reach out within one business day.",
    onDone: () => void navigate({ to: "/" }),
  });
  return (
    <Card className="card-surface mt-8">
      <CardContent className="grid gap-4 p-6">
        <div>
          <h2 className="text-lg font-semibold">Request a placement</h2>
          <p className="text-sm text-muted-foreground">
            Tell us your budget and goal — we'll recommend inventory and pacing.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="ad-biz">Business name</Label>
            <Input
              id="ad-biz"
              required
              className="mt-2"
              value={business}
              onChange={(e) => setBusiness(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="ad-contact">Contact (email or WhatsApp)</Label>
            <Input
              id="ad-contact"
              required
              className="mt-2"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
            />
          </div>
          <div>
            <Label>Inventory</Label>
            <Select value={inventory} onValueChange={setInventory}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Category result spotlight">Category result spotlight</SelectItem>
                <SelectItem value="Location landing feature">Location landing feature</SelectItem>
                <SelectItem value="Contact-gain room banner">Contact-gain room banner</SelectItem>
                <SelectItem value="Homepage featured card">Homepage featured card</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="ad-budget">Monthly budget (₦)</Label>
            <Input
              id="ad-budget"
              className="mt-2"
              placeholder="₦120,000"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="ad-details">What are you promoting?</Label>
          <Textarea
            id="ad-details"
            className="mt-2"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
        <Button
          disabled={submit.isPending || !business || !contact}
          onClick={() =>
            submit.mutate({
              type: "Advertising enquiry",
              categorySlug: "",
              name: business,
              contact,
              address: inventory,
              details: `Budget: ${budget || "not set"}. ${details}`,
            })
          }
        >
          {submit.isPending ? "Sending…" : "Request placement"}
        </Button>
      </CardContent>
    </Card>
  );
}
