import { createFileRoute } from "@tanstack/react-router";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { businesses } from "@/data/mock";

export const Route = createFileRoute("/claim")({
  head: () => ({
    meta: [
      { title: "Claim your business listing — GainHub NG" },
      { name: "description", content: "Already listed? Claim your business profile with CAC documents, a utility bill or shop verification and take control." },
      { property: "og:title", content: "Claim your business listing — GainHub NG" },
      { property: "og:description", content: "Prove ownership and take control of your public profile and leads." },
    ],
  }),
  component: ClaimPage,
});

function ClaimPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Ownership"
        title="Claim an existing listing"
        subtitle="Find the listing, prove ownership, and our verification team reviews it within 48 hours."
      />
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 lg:grid-cols-[1fr_320px]">
        <Card className="card-surface">
          <CardContent className="grid gap-5 p-6">
            <div>
              <Label>Search for your business</Label>
              <Input className="mt-2" placeholder="Business name or phone number" />
            </div>
            <div className="space-y-2">
              <Label>Matching listings</Label>
              <RadioGroup defaultValue={businesses[0]!.id} className="space-y-2">
                {businesses.slice(0, 3).map((b) => (
                  <label key={b.id} className="flex items-center gap-3 rounded-xl border p-3 text-sm">
                    <RadioGroupItem value={b.id} />
                    <span>
                      <span className="font-medium">{b.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {b.category} • {b.city}, {b.state}
                      </span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            </div>
            <div>
              <Label>Your role</Label>
              <Input className="mt-2" placeholder="Owner / Manager" />
            </div>
            <div>
              <Label>Evidence of ownership</Label>
              <div className="mt-2 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                Upload CAC certificate, utility bill, shop photo with signage, or bank statement
              </div>
            </div>
            <div>
              <Label>Anything else we should know?</Label>
              <Textarea className="mt-2" />
            </div>
            <Button>Submit claim</Button>
          </CardContent>
        </Card>
        <Card className="card-surface h-fit">
          <CardContent className="space-y-3 p-5 text-sm text-muted-foreground">
            <p className="font-semibold text-foreground">What happens next</p>
            <p>1. We notify the current listing contact, if one exists.</p>
            <p>2. A support agent reviews your documents.</p>
            <p>3. If approved, control transfers and you get workspace access.</p>
            <p>4. If contested, the case goes to the trust &amp; safety team.</p>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
