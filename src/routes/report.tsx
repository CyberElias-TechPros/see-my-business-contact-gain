import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

export const Route = createFileRoute("/report")({
  validateSearch: (search: Record<string, unknown>): { business?: string } => ({
    business: typeof search["business"] === "string" ? search["business"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Report a listing, review or member — GainHub NG" },
      {
        name: "description",
        content:
          "Tell us what happened. Reports go straight to the moderation queue with risk ranking.",
      },
    ],
  }),
  component: ReportPage,
});

const REASONS = [
  "Scam or advance-fee requests",
  "Impersonation of another business",
  "Fake reviews",
  "Adult or violent images",
  "Wrong or closed listing",
  "Something else",
];

function ReportPage() {
  const { business } = Route.useSearch();
  const navigate = useNavigate();
  const [targetType, setTargetType] = useState("Listing");
  const [targetLabel, setTargetLabel] = useState(business ?? "");
  const [reason, setReason] = useState(REASONS[0] ?? "Something else");
  const [details, setDetails] = useState("");
  const [contact, setContact] = useState("");

  const submit = useSubmitForm("report", (backend, data) => backend.postReport(data), {
    success: "Report received — it's now in the moderation queue with automatic risk ranking.",
    onDone: () => void navigate({ to: "/" }),
  });

  return (
    <PublicShell>
      <PageHead
        eyebrow="Safety"
        title="Report a listing, review or member"
        subtitle="Tell us what happened. Reports go straight to the moderation queue with risk ranking."
      />
      <div className="mx-auto grid max-w-5xl gap-6 px-4 py-12 lg:grid-cols-[1fr_320px]">
        <Card className="card-surface">
          <CardContent className="grid gap-5 p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>What are you reporting?</Label>
                <Select value={targetType} onValueChange={setTargetType}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Listing">A business listing</SelectItem>
                    <SelectItem value="Review">A review</SelectItem>
                    <SelectItem value="Member">A room member</SelectItem>
                    <SelectItem value="Room">A contact-gain room</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="rp-target">Name or link</Label>
                <Input
                  id="rp-target"
                  required
                  className="mt-2"
                  placeholder="e.g. Quick Loans Naija"
                  value={targetLabel}
                  onChange={(e) => setTargetLabel(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Reason</Label>
              <Select value={reason} onValueChange={setReason}>
                <SelectTrigger className="mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REASONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rp-details">What happened?</Label>
              <Textarea
                id="rp-details"
                required
                className="mt-2"
                placeholder="Describe exactly what was said or shown, and when."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="rp-contact">
                Your email or WhatsApp <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="rp-contact"
                className="mt-2"
                placeholder="So we can follow up on the outcome"
                value={contact}
                onChange={(e) => setContact(e.target.value)}
              />
            </div>
            <Button
              disabled={submit.isPending || !targetLabel || details.trim().length < 5}
              onClick={() =>
                submit.mutate({
                  targetType,
                  targetLabel,
                  reason,
                  details,
                  contact,
                })
              }
            >
              {submit.isPending ? "Sending…" : "Send report"}
            </Button>
          </CardContent>
        </Card>
        <div className="space-y-4">
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">What to report</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Scam or advance-fee requests</li>
                <li>Impersonation of another business</li>
                <li>Fake reviews</li>
                <li>Adult or violent images</li>
                <li>Wrong or closed listing</li>
              </ul>
            </CardContent>
          </Card>
          <Card className="card-surface">
            <CardContent className="space-y-3 p-6">
              <h2 className="text-lg font-semibold">What happens next</h2>
              <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
                <li>Automatic risk scoring on submission</li>
                <li>Human moderator review</li>
                <li>Action: warning, hide, suspend or ban</li>
                <li>You get notified of the outcome</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
