import { createFileRoute } from "@tanstack/react-router";
import { Lightbulb, Send, ShieldCheck } from "lucide-react";
import { type FormEvent } from "react";
import { FieldError, FormFeedback } from "@/components/forms/FormFeedback";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getDirectoryTaxonomy } from "@/lib/directory.functions";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest, jsonBody } from "@/lib/api";

export const Route = createFileRoute("/suggest-business")({
  loader: () => getDirectoryTaxonomy(),
  head: () => ({
    meta: [
      { title: "Suggest a business or correction — GainHub NG" },
      {
        name: "description",
        content:
          "Suggest a missing Nigerian business, correct listing details, flag a duplicate or tell us a business has closed.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: SuggestPage,
});

function SuggestPage() {
  const { taxonomy } = Route.useLoaderData();
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const succeeded = await submission.submit(
      () =>
        apiRequest("/v1/suggestions", {
          method: "POST",
          body: jsonBody({
            type: data.get("type"),
            categorySlug: data.get("categorySlug") || undefined,
            businessName: data.get("businessName"),
            phone: data.get("phone"),
            address: data.get("address"),
            details: data.get("details"),
            contactEmail: data.get("contactEmail"),
            company: data.get("company"),
          }),
        }),
      "Thank you. The suggestion is in the directory review queue.",
    );
    if (succeeded) form.reset();
  }

  return (
    <PublicShell>
      <PageHead
        eyebrow="Community accuracy"
        title="Help make the map more useful"
        subtitle="Suggest a missing business or explain a correction. Suggestions never transfer ownership and never publish automatically."
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
                <Label htmlFor="suggestion-type">What changed?</Label>
                <select
                  id="suggestion-type"
                  name="type"
                  className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                  defaultValue="new"
                >
                  <option value="new">A business is missing</option>
                  <option value="correction">Details need correcting</option>
                  <option value="closed">Business has closed</option>
                  <option value="duplicate">Duplicate listing</option>
                </select>
              </div>
              <div>
                <Label htmlFor="suggestion-category">Category</Label>
                <select
                  id="suggestion-category"
                  name="categorySlug"
                  className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                  defaultValue=""
                >
                  <option value="">Not sure</option>
                  {taxonomy.categories.map((category) => (
                    <option key={category.slug} value={category.slug}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="suggestion-name">Business name *</Label>
                <Input
                  id="suggestion-name"
                  name="businessName"
                  className="mt-2"
                  required
                  aria-invalid={Boolean(submission.fieldError("businessName"))}
                />
                <FieldError
                  id="suggestion-name-error"
                  message={submission.fieldError("businessName")}
                />
              </div>
              <div>
                <Label htmlFor="suggestion-phone">Public phone</Label>
                <Input
                  id="suggestion-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  className="mt-2"
                />
                <FieldError id="suggestion-phone-error" message={submission.fieldError("phone")} />
              </div>
              <div>
                <Label htmlFor="suggestion-email">Your email (optional)</Label>
                <Input
                  id="suggestion-email"
                  name="contactEmail"
                  type="email"
                  autoComplete="email"
                  className="mt-2"
                />
                <FieldError
                  id="suggestion-email-error"
                  message={submission.fieldError("contactEmail")}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="suggestion-address">Address or area</Label>
                <Input id="suggestion-address" name="address" className="mt-2" />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="suggestion-details">What should the review team know? *</Label>
                <Textarea
                  id="suggestion-details"
                  name="details"
                  className="mt-2 min-h-32"
                  minLength={20}
                  maxLength={2000}
                  required
                />
                <FieldError
                  id="suggestion-details-error"
                  message={submission.fieldError("details")}
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
                <Send /> {submission.isSubmitting ? "Sending…" : "Send for review"}
              </Button>
            </form>
          </CardContent>
        </Card>
        <aside className="space-y-5">
          <div className="network-stage rounded-[1.5rem] p-6 text-ink-foreground">
            <Lightbulb className="size-6 text-sidebar-primary" />
            <h2 className="mt-5 text-2xl font-bold">Evidence beats guesswork.</h2>
            <p className="mt-3 text-sm leading-6 text-ink-foreground/65">
              Share only information you reasonably believe is accurate and publicly appropriate.
            </p>
          </div>
          <div className="rounded-2xl border p-5 text-sm leading-6 text-muted-foreground">
            <p className="flex items-center gap-2 font-bold text-foreground">
              <ShieldCheck className="size-4 text-primary" /> Privacy note
            </p>
            <p className="mt-2">
              Your optional email is for follow-up on this suggestion. It is not added to the public
              listing.
            </p>
          </div>
        </aside>
      </div>
    </PublicShell>
  );
}
