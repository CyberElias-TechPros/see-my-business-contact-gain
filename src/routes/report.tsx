import { createFileRoute, Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiFailure, apiFetch } from "@/lib/api-client.ts";
import { listingQuery, type ListingPayload } from "@/lib/queries.ts";
import { REPORT_REASONS, REPORT_TARGETS } from "../../shared/domain.ts";

/**
 * Reports are the input to the moderation queue, so this page is a real `POST
 * /api/v1/businesses/:idOrSlug/report` — the handler derives the target business itself from
 * `targetType`/`targetId` (see `resolveReportBusiness`) and returns a reference the reporter can
 * quote. The path segment is only the REST location; a wrong slug cannot make the report land on
 * somebody else's listing, because the body's `targetId` is what the Worker resolves.
 */
const searchSchema = z.object({
  targetType: z.enum(REPORT_TARGETS).optional(),
  targetId: z.string().trim().max(64).optional(),
});

type LoaderData = { target: { name: string; slug: string; city: string } | null };

export const Route = createFileRoute("/report")({
  validateSearch: (raw: Record<string, unknown>) => searchSchema.parse(raw),
  head: () => ({
    meta: [
      { title: "Report a listing, review or member — GainHub NG" },
      {
        name: "description",
        content:
          "Tell us what happened. Reports enter the moderation queue with a risk score, and you get a reference number to quote.",
      },
      // Useful to humans arriving from a listing, worthless in a search index.
      { name: "robots", content: "noindex,follow" },
    ],
    links: [{ rel: "canonical", href: "/report" }],
  }),
  loader: async ({ context, location }): Promise<LoaderData> => {
    const query = searchSchema.parse(location.search);
    if (query.targetType !== "business" && query.targetType !== "listing") return { target: null };
    if (!query.targetId) return { target: null };
    try {
      const payload = await context.queryClient.ensureQueryData(listingQuery(query.targetId));
      const business = (payload as ListingPayload).business;
      return { target: { name: business.name, slug: business.slug, city: business.city } };
    } catch {
      // A report about a listing that has already been unpublished must still be submittable —
      // that is often exactly what a reporter is telling us about.
      return { target: null };
    }
  },
  component: ReportPage,
});

const REASON_LABELS: Record<(typeof REPORT_REASONS)[number], string> = {
  scam: "Scam or advance-fee request",
  impersonation: "Impersonating another business or person",
  fake_review: "Fake or paid review",
  inappropriate_media: "Adult, violent or otherwise inappropriate image",
  closed_or_wrong: "Listing is closed, wrong or duplicated",
  spam: "Spam or repeated promotional content",
  harassment: "Harassment, threats or hate speech",
  other: "Something else",
};

const TARGET_LABELS: Record<(typeof REPORT_TARGETS)[number], string> = {
  business: "A business listing",
  listing: "A business listing",
  review: "A review",
  user: "A member account",
  room: "A contact-gain room",
  media: "A photo or document",
};

function ReportPage() {
  const { target } = Route.useLoaderData();
  const search = Route.useSearch();
  const [state, setState] = useState<
    | { status: "idle" | "sending" }
    | { status: "sent"; reference: string | null; risk: number | null }
    | {
        status: "error";
        message: string;
        fields: Record<string, string>;
        retryAfter: number | null;
      }
  >({ status: "idle" });

  if (state.status === "sent") {
    return (
      <PublicShell>
        <PageHead eyebrow="Safety" title="Report received" />
        <div className="mx-auto max-w-2xl px-4 pb-16">
          <Card className="card-surface border-primary/40">
            <CardContent className="space-y-3 p-6">
              <p className="text-lg font-semibold">
                Thanks — a moderator will look at this
                {state.risk !== null && state.risk >= 60 ? " shortly" : " in the next queue pass"}.
              </p>
              {state.reference ? (
                <p className="text-sm text-muted-foreground">
                  Your reference is{" "}
                  <code className="rounded bg-secondary px-1">{state.reference}</code>. Quote it if
                  you write to us again about the same thing.
                </p>
              ) : null}
              <p className="text-sm text-muted-foreground">
                Reports are ranked by risk, so scam and impersonation claims are read before
                formatting complaints. We do not send the reported party your name or contact
                details unless a legal process requires it.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="outline" size="sm">
                  <Link to="/trust-safety">How moderation works</Link>
                </Button>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/search">Back to the directory</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </PublicShell>
    );
  }

  const error = state.status === "error" ? state : null;

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    const targetType = String(values["targetType"] ?? "business");
    const targetId = String(values["targetId"] ?? "").trim();
    if (!targetId) {
      setState({
        status: "error",
        message:
          "We need to know what you are reporting — add the listing link, review id or handle.",
        fields: { targetId: "Tell us which one." },
        retryAfter: null,
      });
      return;
    }
    setState({ status: "sending" });
    try {
      const result = await apiFetch<{ ok: boolean; reference?: string; risk?: number }>(
        `/api/v1/businesses/${encodeURIComponent(targetId)}/report`,
        {
          method: "POST",
          body: {
            targetType,
            targetId,
            reason: String(values["reason"] ?? "other"),
            detail: String(values["detail"] ?? ""),
            ...(values["contact"] ? { contact: String(values["contact"]) } : {}),
            honeypot: String(values["website"] ?? ""),
          },
        },
      );
      form.reset();
      setState({
        status: "sent",
        reference: result?.reference ?? null,
        risk: typeof result?.risk === "number" ? result.risk : null,
      });
    } catch (submissionError) {
      const failure = submissionError instanceof ApiFailure ? submissionError : null;
      setState({
        status: "error",
        message: failure?.message ?? "We could not record that report. Try again in a moment.",
        fields: failure?.formErrors ?? {},
        retryAfter: failure?.retryAfterSeconds ?? null,
      });
    }
  };

  return (
    <PublicShell>
      <PageHead
        eyebrow="Safety"
        title="Report a listing, review or member"
        subtitle="Tell us what happened and what you saw. Reports go straight to the moderation queue with a risk ranking, and you get a reference to quote."
      />
      <div className="mx-auto max-w-5xl px-4 py-12">
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <Card className="card-surface">
            <CardContent className="space-y-4 p-6">
              <form onSubmit={submit} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="targetType">What are you reporting?</Label>
                    <select
                      id="targetType"
                      name="targetType"
                      defaultValue={search.targetType ?? "business"}
                      className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                    >
                      {REPORT_TARGETS.map((value) => (
                        <option key={value} value={value}>
                          {TARGET_LABELS[value]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="targetId">Which one?</Label>
                    <Input
                      id="targetId"
                      name="targetId"
                      defaultValue={search.targetId ?? ""}
                      required
                      maxLength={64}
                      placeholder="listing link or id, e.g. swiftfix-gadgets"
                      className="mt-2"
                    />
                    {error?.fields["targetId"] ? (
                      <p role="alert" className="mt-1 text-xs text-destructive">
                        {error.fields["targetId"]}
                      </p>
                    ) : null}
                  </div>
                </div>

                {target ? (
                  <p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                    Reporting <span className="font-medium">{target.name}</span> in {target.city}.{" "}
                    <Link
                      to="/business/$id"
                      params={{ id: target.slug }}
                      className="text-primary hover:underline"
                    >
                      Open the listing
                    </Link>
                  </p>
                ) : search.targetId ? (
                  <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                    We could not load a published listing at that link — you can still report it,
                    and a moderator will look at the raw id.
                  </p>
                ) : null}

                <div>
                  <Label htmlFor="reason">Reason</Label>
                  <select
                    id="reason"
                    name="reason"
                    defaultValue="scam"
                    className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    {REPORT_REASONS.map((reason) => (
                      <option key={reason} value={reason}>
                        {REASON_LABELS[reason]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="detail">What happened?</Label>
                  <Textarea
                    id="detail"
                    name="detail"
                    rows={6}
                    required
                    minLength={10}
                    maxLength={2000}
                    className="mt-2"
                    placeholder="Dates, amounts, what was promised and what actually happened. Screenshots help — you can email them to moderation@gainhub.ng quoting your reference."
                  />
                  <p className="mt-1 text-xs text-muted-foreground">
                    Ten characters minimum. This text is what the moderator reads first, and it is
                    not shown to the reported party.
                  </p>
                  {error?.fields["detail"] ? (
                    <p role="alert" className="mt-1 text-xs text-destructive">
                      {error.fields["detail"]}
                    </p>
                  ) : null}
                </div>

                <div>
                  <Label htmlFor="contact">Contact if we need proof (optional)</Label>
                  <Input
                    id="contact"
                    name="contact"
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    className="mt-2"
                    placeholder="you@example.com"
                  />
                  {error?.fields["contact"] ? (
                    <p role="alert" className="mt-1 text-xs text-destructive">
                      {error.fields["contact"]}
                    </p>
                  ) : null}
                </div>

                <div className="hidden" aria-hidden="true">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    defaultValue=""
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={state.status === "sending"}>
                    {state.status === "sending" ? "Sending…" : "Send report"}
                  </Button>
                  {error?.retryAfter ? (
                    <span className="text-xs text-muted-foreground">
                      Too many reports from this device — try again in {error.retryAfter} seconds.
                    </span>
                  ) : null}
                </div>

                {error ? (
                  <p role="alert" className="flex items-start gap-2 text-sm text-destructive">
                    <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {error.message}
                  </p>
                ) : null}
              </form>
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
                  <li>The report is scored for risk and enters the moderation queue.</li>
                  <li>
                    High-risk items are looked at first; a listing can be hidden while it is
                    reviewed.
                  </li>
                  <li>
                    Decisions and notes stay in the audit log against the listing, not against you.
                  </li>
                </ul>
                <p className="text-sm text-muted-foreground">
                  In an emergency, contact the police — a directory report is not a response to a
                  crime in progress.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </PublicShell>
  );
}
