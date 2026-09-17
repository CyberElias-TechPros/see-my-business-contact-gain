import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LockKeyhole, Send, ShieldCheck } from "lucide-react";
import { type FormEvent } from "react";
import { FieldError, FormFeedback } from "@/components/forms/FormFeedback";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest, jsonBody } from "@/lib/api";

export const Route = createFileRoute("/contact-gain/create")({
  head: () => ({
    meta: [
      { title: "Propose an opt-in contact circle — GainHub NG" },
      {
        name: "description",
        content:
          "Propose a scoped, moderated business contact circle with explicit rules and a clear member limit.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: CreateRoom,
});

function CreateRoom() {
  const session = useSession();
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const succeeded = await submission.submit(
      () =>
        apiRequest("/v1/rooms", {
          method: "POST",
          body: jsonBody({
            name: data.get("name"),
            purpose: data.get("purpose"),
            state: data.get("state"),
            slotLimit: data.get("slotLimit"),
            rules: data.get("rules"),
            verifiedOnly: data.get("verifiedOnly") === "on",
          }),
        }),
      "Proposal received. The circle remains private until trust and safety approves it.",
    );
    if (succeeded) form.reset();
  }

  return (
    <PublicShell>
      <PageHead
        eyebrow="Opt-in contact circles"
        title="Propose a focused circle"
        subtitle="Clear purpose, explicit consent and enforceable rules come before growth."
      />
      <div className="mx-auto grid max-w-5xl gap-8 px-5 py-12 lg:grid-cols-[1fr_19rem]">
        {session.isLoading ? (
          <div className="rounded-3xl border-border/70 h-96 animate-pulse bg-muted" />
        ) : !session.data?.user ? (
          <Card className="rounded-3xl border-border/70 border-dashed">
            <CardContent className="grid min-h-96 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
                  <LockKeyhole className="size-6" />
                </span>
                <h2 className="mt-5 text-3xl font-bold">An accountable owner is required</h2>
                <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
                  Sign in before proposing a circle. Ownership, moderation decisions and changes are
                  retained in the audit trail.
                </p>
                <Button asChild size="lg" className="mt-7">
                  <Link to="/auth" search={{ next: "/contact-gain/create" }}>
                    Sign in <ArrowRight />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-3xl border-border/70">
            <CardContent className="p-6 sm:p-8">
              <form
                className="grid gap-5 sm:grid-cols-2"
                onSubmit={(event) => void onSubmit(event)}
                noValidate
              >
                <div className="sm:col-span-2">
                  <Label htmlFor="room-name">Circle name *</Label>
                  <Input id="room-name" name="name" className="mt-2" required />
                  <FieldError id="room-name-error" message={submission.fieldError("name")} />
                </div>
                <div>
                  <Label htmlFor="room-purpose">Purpose *</Label>
                  <select
                    id="room-purpose"
                    name="purpose"
                    className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    defaultValue="business"
                  >
                    <option value="business">Business promotion</option>
                    <option value="niche">Niche vendors</option>
                    <option value="network">Professional networking</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="room-state">Coverage *</Label>
                  <Input
                    id="room-state"
                    name="state"
                    className="mt-2"
                    placeholder="Lagos or Nationwide"
                    required
                  />
                  <FieldError id="room-state-error" message={submission.fieldError("state")} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="room-limit">Member limit *</Label>
                  <Input
                    id="room-limit"
                    name="slotLimit"
                    type="number"
                    inputMode="numeric"
                    min={20}
                    max={5000}
                    defaultValue={100}
                    className="mt-2"
                    required
                  />
                  <FieldError id="room-limit-error" message={submission.fieldError("slotLimit")} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="room-rules">Published rules *</Label>
                  <Textarea
                    id="room-rules"
                    name="rules"
                    className="mt-2 min-h-40"
                    placeholder="Explain eligibility, allowed promotion, privacy expectations, moderation and removal criteria."
                    minLength={30}
                    maxLength={2000}
                    required
                  />
                  <FieldError id="room-rules-error" message={submission.fieldError("rules")} />
                </div>
                <label className="flex items-start gap-3 rounded-xl border p-4 text-sm sm:col-span-2">
                  <input
                    type="checkbox"
                    name="verifiedOnly"
                    className="mt-1 size-4 accent-primary"
                    defaultChecked
                  />
                  Require a verified business profile before a member may apply.
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
                  <Send /> {submission.isSubmitting ? "Submitting…" : "Send proposal for review"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
        <aside className="space-y-5">
          <div className="network-stage rounded-[1.5rem] p-6 text-ink-foreground">
            <ShieldCheck className="size-6 text-sidebar-primary" />
            <h2 className="mt-5 text-2xl font-bold">No contact scraping.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-foreground/65">
              GainHub stores applications and membership status—not a public phone-number dump or a
              copy of personal address books.
            </p>
          </div>
          <div className="rounded-2xl border p-5 text-sm leading-6 text-muted-foreground">
            <p className="font-bold text-foreground">Approval gate</p>
            <p className="mt-2">
              A proposal can be rejected for vague purpose, unsafe rules, deceptive claims or an
              unmanageable member cap.
            </p>
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
