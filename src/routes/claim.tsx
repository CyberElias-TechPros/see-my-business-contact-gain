import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { LoadingCard } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { useBusinesses, useMeta } from "@/lib/queries";
import { useSubmitForm } from "@/lib/forms";

export const Route = createFileRoute("/claim")({
  validateSearch: (search: Record<string, unknown>): { business?: string } => ({
    business: typeof search["business"] === "string" ? search["business"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Claim your business listing — GainHub NG" },
      {
        name: "description",
        content:
          "Already listed? Claim your business profile with CAC documents, a utility bill or shop verification and take control.",
      },
    ],
  }),
  component: ClaimPage,
});

function ClaimPage() {
  const { business } = Route.useSearch();
  const navigate = useNavigate();
  const { data: meta } = useMeta();
  const catalog = useBusinesses({ pageSize: 48 });
  const suggestions = (catalog.data?.items ?? []).slice(0, 5);
  const [selected, setSelected] = useState(business ?? "");
  const [query, setQuery] = useState("");
  const [claimant, setClaimant] = useState("");
  const [role, setRole] = useState("Owner");
  const [contact, setContact] = useState("");
  const [evidence, setEvidence] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!selected && suggestions[0]) setSelected(suggestions[0].id);
  }, [selected, suggestions]);

  const submit = useSubmitForm("claim", (backend, data) => backend.postClaim(data), {
    success: "Claim submitted — our verification team reviews claims within 48 hours.",
    onDone: () => void navigate({ to: "/" }),
  });

  const filtered = query
    ? (catalog.data?.items ?? []).filter((b) =>
        `${b.name} ${b.city}`.toLowerCase().includes(query.toLowerCase()),
      )
    : suggestions;

  const selectedBusiness = (catalog.data?.items ?? []).find((b) => b.id === selected);

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
              <Label htmlFor="claim-search">Search for your business</Label>
              <Input
                id="claim-search"
                className="mt-2"
                placeholder="Business name or phone number"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Matching listings</Label>
              {catalog.isLoading ? (
                <LoadingCard />
              ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No listings match “{query}”. It may not be listed yet — you can add it free
                  instead.
                </p>
              ) : (
                <RadioGroup value={selected} onValueChange={setSelected} className="space-y-2">
                  {filtered.slice(0, 6).map((b) => (
                    <label
                      key={b.id}
                      className="flex items-center gap-3 rounded-xl border p-3 text-sm"
                    >
                      <RadioGroupItem value={b.id} />
                      <span>
                        <span className="font-medium">{b.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {b.categoryName ?? b.categorySlug} • {b.city}, {b.state}
                        </span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="claim-name">Your name</Label>
                <Input
                  id="claim-name"
                  required
                  className="mt-2"
                  value={claimant}
                  onChange={(e) => setClaimant(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="claim-role">Your role</Label>
                <Input
                  id="claim-role"
                  className="mt-2"
                  placeholder="Owner / Manager"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="claim-contact">Contact email</Label>
                <Input
                  id="claim-contact"
                  type="email"
                  required
                  className="mt-2"
                  placeholder="you@business.ng"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="claim-evidence">Evidence of ownership</Label>
                <Textarea
                  id="claim-evidence"
                  required
                  className="mt-2"
                  placeholder="Describe the documents you hold: CAC certificate number, utility bill, shop photo with signage, or bank statement"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Originals are verified during the review call — never email passwords or full bank
                  details.
                </p>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="claim-notes">Anything else we should know?</Label>
                <Textarea
                  id="claim-notes"
                  className="mt-2"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
            <Button
              disabled={submit.isPending || !selectedBusiness || !claimant || !contact || !evidence}
              onClick={() =>
                submit.mutate({
                  ...(selectedBusiness ? { businessId: selectedBusiness.id } : {}),
                  claimant,
                  role,
                  contact,
                  evidence,
                  notes,
                })
              }
            >
              {submit.isPending ? "Submitting…" : "Submit claim"}
            </Button>
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
