import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Flag, Send, ShieldCheck } from "lucide-react";
import { type FormEvent } from "react";
import { z } from "zod";
import { FieldError, FormFeedback } from "@/components/forms/FormFeedback";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest, jsonBody } from "@/lib/api";

const reportSearchSchema = z.object({
  type: z.enum(["business", "review", "room", "member", "other"]).optional().catch(undefined),
  target: z.string().trim().max(100).optional().catch(undefined),
});

export const Route = createFileRoute("/report")({
  validateSearch: (search) => reportSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Report a safety or accuracy concern — GainHub NG" },
      {
        name: "description",
        content:
          "Privately report scams, impersonation, abusive content, incorrect information or a closed business to GainHub NG.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const rawSearch = Route.useSearch();
  const search = { type: rawSearch.type ?? "other", target: rawSearch.target ?? "general" };
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const succeeded = await submission.submit(
      () =>
        apiRequest("/v1/reports", {
          method: "POST",
          body: jsonBody({
            targetType: data.get("targetType"),
            targetId: data.get("targetId"),
            reason: data.get("reason"),
            details: data.get("details"),
            contactEmail: data.get("contactEmail"),
            company: data.get("company"),
          }),
        }),
      "Report received. High-risk concerns are prioritised automatically for review.",
    );
    if (succeeded) form.reset();
  }

  return (
    <PublicShell>
      <PageHead
        eyebrow="Trust & safety"
        title="Tell us what is wrong"
        subtitle="Reports are private and never publish automatically. Give the moderation team specific, factual detail so it can assess the concern."
      />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[1fr_19rem]">
        <Card className="card-surface">
          <CardContent className="p-6 sm:p-8">
            <form
              className="grid gap-5 sm:grid-cols-2"
              onSubmit={(event) => void onSubmit(event)}
              noValidate
            >
              <div>
                <Label htmlFor="report-target-type">What are you reporting?</Label>
                <select
                  id="report-target-type"
                  name="targetType"
                  defaultValue={search.type}
                  className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="business">Business listing</option>
                  <option value="review">Review</option>
                  <option value="room">Contact circle</option>
                  <option value="member">Member</option>
                  <option value="other">Something else</option>
                </select>
              </div>
              <div>
                <Label htmlFor="report-reason">Reason</Label>
                <select
                  id="report-reason"
                  name="reason"
                  defaultValue="scam"
                  className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                >
                  <option value="scam">Suspected scam</option>
                  <option value="impersonation">Impersonation</option>
                  <option value="incorrect">Incorrect information</option>
                  <option value="closed">Permanently closed</option>
                  <option value="abuse">Abusive or unsafe content</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="report-target">Listing, room or item reference *</Label>
                <Input
                  id="report-target"
                  name="targetId"
                  defaultValue={search.target === "general" ? "" : search.target}
                  className="mt-2"
                  placeholder="Paste the URL or enter the reference"
                  required
                />
                <FieldError id="report-target-error" message={submission.fieldError("targetId")} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="report-details">What happened? *</Label>
                <Textarea
                  id="report-details"
                  name="details"
                  className="mt-2 min-h-40"
                  placeholder="Dates, messages, payment requests or other specific facts help the team assess risk."
                  minLength={20}
                  maxLength={2000}
                  required
                />
                <FieldError id="report-details-error" message={submission.fieldError("details")} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="report-email">Email for confidential follow-up (optional)</Label>
                <Input
                  id="report-email"
                  name="contactEmail"
                  type="email"
                  autoComplete="email"
                  className="mt-2"
                />
                <FieldError
                  id="report-email-error"
                  message={submission.fieldError("contactEmail")}
                />
              </div>
              <label className="hidden" aria-hidden="true">
                Company
                <input name="company" tabIndex={-1} autoComplete="off" />
              </label>
              <div className="sm:col-span-2">
                <FormFeedback
                  status={submission.state.status}
                  message={submission.state.message}
                  {...(submission.state.status === "error" && submission.state.requestId
                    ? { requestId: submission.state.requestId }
                    : {})}
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="sm:col-span-2"
                disabled={submission.isSubmitting}
              >
                <Flag /> {submission.isSubmitting ? "Sending privately…" : "Submit private report"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <aside className="space-y-5">
          <div className="rounded-[1.5rem] bg-destructive p-6 text-destructive-foreground">
            <AlertTriangle className="size-6" />
            <h2 className="mt-5 text-2xl font-bold">Immediate danger?</h2>
            <p className="mt-3 text-sm leading-6 text-destructive-foreground/75">
              GainHub is not an emergency service. Contact the appropriate local authority if anyone
              is at immediate risk.
            </p>
          </div>
          <div className="rounded-2xl border p-5 text-sm leading-6 text-muted-foreground">
            <p className="flex items-center gap-2 font-bold text-foreground">
              <ShieldCheck className="size-4 text-primary" /> What happens next
            </p>
            <p className="mt-2">
              Risk rules prioritise scam, impersonation and abuse reports. A human reviewer decides
              whether to hide, suspend, correct or dismiss.
            </p>
            <Link
              to="/trust-safety"
              className="mt-3 inline-block font-bold text-primary hover:underline"
            >
              Read the safety process
            </Link>
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
