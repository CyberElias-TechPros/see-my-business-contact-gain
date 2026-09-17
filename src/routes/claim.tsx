import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileCheck2, LockKeyhole, Search, ShieldCheck, Upload } from "lucide-react";
import { type FormEvent } from "react";
import { z } from "zod";
import { FieldError, FormFeedback } from "@/components/forms/FormFeedback";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest } from "@/lib/api";

const claimSearchSchema = z.object({
  business: z.string().uuid().optional().catch(undefined),
});

export const Route = createFileRoute("/claim")({
  validateSearch: (search) => claimSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Claim a published business listing — GainHub NG" },
      {
        name: "description",
        content:
          "Request control of a published GainHub listing with private ownership evidence reviewed by an authorized team member.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: ClaimPage,
});

function ClaimPage() {
  const { business } = Route.useSearch();
  const session = useSession();
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const succeeded = await submission.submit(
      () => apiRequest("/v1/claims", { method: "POST", body: data }),
      "Ownership claim received. Evidence stays private while an authorized reviewer assesses it.",
    );
    if (succeeded) form.reset();
  }

  const next = business ? `/claim?business=${encodeURIComponent(business)}` : "/claim";

  return (
    <PublicShell>
      <PageHead
        eyebrow="Ownership"
        title="Claim an existing listing"
        subtitle="Claims use private evidence and a human review. A claim never transfers control automatically."
      />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[1fr_20rem]">
        {session.isLoading ? (
          <div className="rounded-3xl border-border/70 h-96 animate-pulse bg-muted" />
        ) : !session.data?.user ? (
          <Card className="rounded-3xl border-border/70 border-dashed">
            <CardContent className="grid min-h-96 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
                  <LockKeyhole className="size-6" />
                </span>
                <h2 className="mt-5 text-3xl font-bold">Sign in before sending evidence</h2>
                <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
                  An authenticated account is required so the team can verify identity, prevent
                  duplicate claims and return a decision securely.
                </p>
                <Button asChild size="lg" className="mt-7">
                  <Link to="/auth" search={{ next }}>
                    Sign in to claim <ArrowRight />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : !business ? (
          <Card className="rounded-3xl border-border/70 border-dashed">
            <CardContent className="grid min-h-96 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
                  <Search className="size-6" />
                </span>
                <h2 className="mt-5 text-3xl font-bold">Start from the live profile</h2>
                <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
                  Find the published business first, then choose “Claim this listing.” This keeps
                  the claim tied to the exact database record.
                </p>
                <Button asChild size="lg" className="mt-7">
                  <Link to="/search" search={{ page: 1 }}>
                    Find the business <ArrowRight />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border-border/70">
            <CardContent className="p-6 sm:p-8">
              <form
                encType="multipart/form-data"
                className="space-y-5"
                onSubmit={(event) => void onSubmit(event)}
                noValidate
              >
                <input type="hidden" name="businessId" value={business} />
                <div className="rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
                  Listing reference:{" "}
                  <code className="break-all font-semibold text-foreground">{business}</code>
                </div>
                <div className="block">
                  <Label htmlFor="claim-role">Your relationship to the business *</Label>
                  <Input
                    id="claim-role"
                    name="claimantRole"
                    className="mt-2"
                    placeholder="Owner, director, authorized manager…"
                    required
                  />
                  <FieldError
                    id="claim-role-error"
                    message={submission.fieldError("claimantRole")}
                  />
                </div>
                <div className="block">
                  <Label htmlFor="claim-details">Supporting context</Label>
                  <Textarea
                    id="claim-details"
                    name="details"
                    className="mt-2 min-h-28"
                    maxLength={2000}
                    placeholder="Explain any name difference, contested ownership or useful review context."
                  />
                  <FieldError id="claim-details-error" message={submission.fieldError("details")} />
                </div>
                <label className="block rounded-2xl border border-dashed p-5">
                  <span className="flex items-center gap-2 font-bold">
                    <Upload className="size-4 text-primary" /> Private ownership evidence *
                  </span>
                  <span className="mt-2 block text-xs leading-5 text-muted-foreground">
                    PDF, JPEG, PNG or WebP · maximum 8 MB. Use a CAC document, relevant utility
                    record or other strong evidence.
                  </span>
                  <Input
                    id="claim-evidence"
                    name="evidence"
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="mt-4"
                    required
                  />
                  <FieldError
                    id="claim-evidence-error"
                    message={submission.fieldError("evidence")}
                  />
                </label>
                <FormFeedback
                  status={submission.state.status}
                  message={submission.state.message}
                  {...(submission.state.status === "error" && submission.state.requestId
                    ? { requestId: submission.state.requestId }
                    : {})}
                />
                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  disabled={submission.isSubmitting}
                >
                  <FileCheck2 />{" "}
                  {submission.isSubmitting ? "Uploading securely…" : "Submit ownership claim"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <aside className="space-y-5">
          <div className="network-stage rounded-[1.5rem] p-6 text-ink-foreground">
            <ShieldCheck className="size-6 text-sidebar-primary" />
            <h2 className="mt-5 text-2xl font-bold">Evidence is never public.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-foreground/65">
              Files go to a private R2 bucket under random keys. Public routes have no download
              path.
            </p>
          </div>
          <div className="rounded-2xl border p-5 text-sm leading-6 text-muted-foreground">
            <p className="font-bold text-foreground">Review sequence</p>
            <ol className="mt-3 list-decimal space-y-2 pl-4">
              <li>Confirm account and listing reference.</li>
              <li>Assess evidence and existing ownership.</li>
              <li>Escalate contested claims.</li>
              <li>Record the decision in the audit trail.</li>
            </ol>
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
