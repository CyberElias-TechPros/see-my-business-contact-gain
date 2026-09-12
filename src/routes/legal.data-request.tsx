import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Database, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { type FormEvent } from "react";
import { FormFeedback } from "@/components/forms/FormFeedback";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest, jsonBody } from "@/lib/api";

export const Route = createFileRoute("/legal/data-request")({
  head: () => ({
    meta: [
      { title: "Personal data requests — GainHub NG" },
      {
        name: "description",
        content:
          "Submit an authenticated request for access, portability, correction or deletion of personal data held by GainHub NG.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: DataRequestPage,
});

function DataRequestPage() {
  const session = useSession();
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const succeeded = await submission.submit(
      () =>
        apiRequest("/v1/data-requests", {
          method: "POST",
          body: jsonBody({ kind: data.get("kind"), details: data.get("details") }),
        }),
      "Request received. It is tied to your verified session and has entered the privacy queue.",
    );
    if (succeeded) form.reset();
  }

  return (
    <PublicShell>
      <PageHead
        eyebrow="Privacy controls"
        title="Request your personal data"
        subtitle="Use an authenticated account to request access, portability, correction or deletion. This helps us verify identity before acting on private records."
      />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[1fr_20rem]">
        {session.isLoading ? (
          <div className="card-surface h-80 animate-pulse bg-muted" />
        ) : !session.data?.user ? (
          <Card className="card-surface border-dashed">
            <CardContent className="grid min-h-80 place-items-center p-8 text-center">
              <div>
                <LockKeyhole className="mx-auto size-8 text-primary" />
                <h2 className="mt-5 text-3xl font-bold">Identity first</h2>
                <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
                  Sign in so we do not disclose, change or erase account data based on an unverified
                  email form.
                </p>
                <Button asChild className="mt-7">
                  <Link to="/auth" search={{ next: "/legal/data-request" }}>
                    Sign in securely <ArrowRight />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="card-surface">
            <CardContent className="p-6 sm:p-8">
              <form className="space-y-5" onSubmit={(event) => void onSubmit(event)}>
                <div className="block">
                  <Label htmlFor="request-kind">Request type</Label>
                  <select
                    id="request-kind"
                    name="kind"
                    className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    defaultValue="access"
                  >
                    <option value="access">Access a copy of my data</option>
                    <option value="portability">Receive a portable export</option>
                    <option value="correction">Correct inaccurate data</option>
                    <option value="deletion">Delete my account and eligible data</option>
                  </select>
                </div>
                <div className="block">
                  <Label htmlFor="request-details">Useful detail (optional)</Label>
                  <Textarea
                    id="request-details"
                    name="details"
                    className="mt-2 min-h-36"
                    maxLength={1000}
                    placeholder="For a correction, describe the record. Never include a password or payment secret."
                  />
                </div>
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
                  <Send /> {submission.isSubmitting ? "Submitting…" : "Submit verified request"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        <aside className="space-y-5">
          <div className="network-stage rounded-[1.5rem] p-6 text-ink-foreground">
            <Database className="size-6 text-sidebar-primary" />
            <h2 className="mt-5 text-2xl font-bold">Designed for traceability.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-foreground/65">
              Each request receives an ID, lifecycle status and auditable timestamps.
            </p>
          </div>
          <div className="rounded-2xl border p-5 text-sm leading-6 text-muted-foreground">
            <p className="flex items-center gap-2 font-bold text-foreground">
              <ShieldCheck className="size-4 text-primary" /> Important
            </p>
            <p className="mt-2">
              Deletion may not cover records that must be retained for security, dispute resolution
              or legal obligations. Eligible data is erased or de-identified.
            </p>
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
