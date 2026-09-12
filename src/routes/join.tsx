import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Check, Clock3, Eye, Send, ShieldCheck, Sparkles } from "lucide-react";
import { type FormEvent } from "react";
import { FieldError, FormFeedback } from "@/components/forms/FormFeedback";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { categories, locations } from "@/data/mock";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest, jsonBody } from "@/lib/api";

export const Route = createFileRoute("/join")({
  head: () => ({
    meta: [
      { title: "List your business for review — GainHub NG" },
      {
        name: "description",
        content:
          "Submit your Nigerian business for review. Add accurate contact, category, location and service details before your profile is published.",
      },
      { property: "og:title", content: "Put your business on the GainHub map" },
      {
        property: "og:description",
        content:
          "A clear profile, a direct route to conversation, and a review process designed to keep the directory useful.",
      },
    ],
  }),
  component: JoinPage,
});

const reviewSteps = [
  {
    icon: Send,
    title: "You submit",
    body: "Share the public facts customers need to understand and contact your business.",
  },
  {
    icon: Eye,
    title: "We review",
    body: "The listing stays private while the team checks quality, category fit and obvious duplication.",
  },
  {
    icon: Sparkles,
    title: "You publish",
    body: "Approved records receive a public profile. Verification is a separate, clearly labelled process.",
  },
];

function JoinPage() {
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const succeeded = await submission.submit(
      () =>
        apiRequest("/v1/listing-applications", {
          method: "POST",
          body: jsonBody({
            ownerName: data.get("ownerName"),
            email: data.get("email"),
            businessName: data.get("businessName"),
            tagline: data.get("tagline"),
            categorySlug: data.get("categorySlug"),
            locationSlug: data.get("locationSlug"),
            address: data.get("address"),
            whatsapp: data.get("whatsapp"),
            phone: data.get("phone"),
            website: data.get("website"),
            about: data.get("about"),
            acceptedTerms: data.get("acceptedTerms") === "on",
            company: data.get("company"),
          }),
        }),
      "Application received. Your details are private until the review team approves the listing.",
    );
    if (succeeded) {
      form.reset();
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const errorFor = (name: string) => submission.fieldError(name);

  return (
    <PublicShell>
      <PageHead
        eyebrow="For business owners"
        title="Put your business on the map"
        subtitle="Submit accurate, customer-facing information. Nothing is published automatically: every new listing enters a review queue first."
      />
      <div className="mx-auto max-w-7xl px-5 py-12 lg:py-16">
        <FormFeedback
          status={submission.state.status}
          message={submission.state.message}
          {...(submission.state.status === "error" && submission.state.requestId
            ? { requestId: submission.state.requestId }
            : {})}
        />
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <Card className="card-surface overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/55 px-6 py-4">
              <div>
                <p className="font-bold">New listing application</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Fields marked * are required</p>
              </div>
              <Badge variant="secondary" className="gap-1.5">
                <Clock3 className="size-3.5" /> Saved when submitted
              </Badge>
            </div>
            <CardContent className="p-6 sm:p-8">
              <form
                className="grid gap-5 sm:grid-cols-2"
                onSubmit={(event) => void onSubmit(event)}
                noValidate
              >
                <div className="sm:col-span-2">
                  <p className="eyebrow text-primary">About you</p>
                  <h2 className="mt-2 text-2xl font-bold">Who should we contact?</h2>
                </div>
                <div>
                  <Label htmlFor="owner-name">Your full name *</Label>
                  <Input
                    id="owner-name"
                    name="ownerName"
                    autoComplete="name"
                    className="mt-2"
                    aria-invalid={Boolean(errorFor("ownerName"))}
                    aria-describedby={errorFor("ownerName") ? "owner-name-error" : undefined}
                    required
                  />
                  <FieldError id="owner-name-error" message={errorFor("ownerName")} />
                </div>
                <div>
                  <Label htmlFor="owner-email">Email *</Label>
                  <Input
                    id="owner-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    className="mt-2"
                    aria-invalid={Boolean(errorFor("email"))}
                    aria-describedby={errorFor("email") ? "owner-email-error" : undefined}
                    required
                  />
                  <FieldError id="owner-email-error" message={errorFor("email")} />
                </div>

                <div className="mt-3 border-t pt-7 sm:col-span-2">
                  <p className="eyebrow text-primary">Business essentials</p>
                  <h2 className="mt-2 text-2xl font-bold">What should customers know?</h2>
                </div>
                <div>
                  <Label htmlFor="business-name">Business name *</Label>
                  <Input
                    id="business-name"
                    name="businessName"
                    autoComplete="organization"
                    className="mt-2"
                    placeholder="The public trading name"
                    aria-invalid={Boolean(errorFor("businessName"))}
                    aria-describedby={errorFor("businessName") ? "business-name-error" : undefined}
                    required
                  />
                  <FieldError id="business-name-error" message={errorFor("businessName")} />
                </div>
                <div>
                  <Label htmlFor="tagline">One-line promise *</Label>
                  <Input
                    id="tagline"
                    name="tagline"
                    className="mt-2"
                    placeholder="What you do and where"
                    aria-invalid={Boolean(errorFor("tagline"))}
                    aria-describedby={errorFor("tagline") ? "tagline-error" : undefined}
                    required
                  />
                  <FieldError id="tagline-error" message={errorFor("tagline")} />
                </div>
                <div>
                  <Label htmlFor="category">Category *</Label>
                  <select
                    id="category"
                    name="categorySlug"
                    defaultValue=""
                    className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    aria-invalid={Boolean(errorFor("categorySlug"))}
                    required
                  >
                    <option value="" disabled>
                      Choose a category
                    </option>
                    {categories.map((category) => (
                      <option key={category.slug} value={category.slug}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <FieldError id="category-error" message={errorFor("categorySlug")} />
                </div>
                <div>
                  <Label htmlFor="location">Closest city hub *</Label>
                  <select
                    id="location"
                    name="locationSlug"
                    defaultValue=""
                    className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
                    aria-invalid={Boolean(errorFor("locationSlug"))}
                    required
                  >
                    <option value="" disabled>
                      Choose a city
                    </option>
                    {locations.map((location) => (
                      <option key={location.slug} value={location.slug}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                  <FieldError id="location-error" message={errorFor("locationSlug")} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="address">Public business address or service area *</Label>
                  <Input
                    id="address"
                    name="address"
                    autoComplete="street-address"
                    className="mt-2"
                    placeholder="Use a location customers can understand"
                    aria-invalid={Boolean(errorFor("address"))}
                    aria-describedby={errorFor("address") ? "address-error" : undefined}
                    required
                  />
                  <FieldError id="address-error" message={errorFor("address")} />
                </div>
                <div>
                  <Label htmlFor="whatsapp">WhatsApp number *</Label>
                  <Input
                    id="whatsapp"
                    name="whatsapp"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="mt-2"
                    placeholder="+234…"
                    aria-invalid={Boolean(errorFor("whatsapp"))}
                    aria-describedby={errorFor("whatsapp") ? "whatsapp-error" : undefined}
                    required
                  />
                  <FieldError id="whatsapp-error" message={errorFor("whatsapp")} />
                </div>
                <div>
                  <Label htmlFor="phone">Other phone</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    className="mt-2"
                  />
                  <FieldError id="phone-error" message={errorFor("phone")} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    name="website"
                    type="url"
                    inputMode="url"
                    autoComplete="url"
                    className="mt-2"
                    placeholder="https://"
                  />
                  <FieldError id="website-error" message={errorFor("website")} />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="about">Business description *</Label>
                  <Textarea
                    id="about"
                    name="about"
                    className="mt-2 min-h-36"
                    placeholder="Explain what you offer, who you serve, your coverage and anything a customer should know before contacting you."
                    maxLength={2000}
                    aria-invalid={Boolean(errorFor("about"))}
                    aria-describedby={errorFor("about") ? "about-error" : "about-hint"}
                    required
                  />
                  <p id="about-hint" className="mt-1.5 text-xs text-muted-foreground">
                    At least 40 characters. Avoid slogans with no service detail.
                  </p>
                  <FieldError id="about-error" message={errorFor("about")} />
                </div>

                <label className="hidden" aria-hidden="true">
                  Company
                  <input name="company" tabIndex={-1} autoComplete="off" />
                </label>
                <label className="flex items-start gap-3 rounded-2xl border bg-muted/40 p-4 text-sm leading-6 sm:col-span-2">
                  <input
                    type="checkbox"
                    name="acceptedTerms"
                    className="mt-1 size-4 shrink-0 accent-primary"
                    required
                  />
                  <span>
                    I confirm I may submit this business, the details are accurate, and I agree to
                    the{" "}
                    <Link to="/legal/terms" className="font-bold text-primary hover:underline">
                      listing terms
                    </Link>{" "}
                    and{" "}
                    <Link to="/legal/privacy" className="font-bold text-primary hover:underline">
                      privacy policy
                    </Link>
                    .
                  </span>
                </label>
                <FieldError id="terms-error" message={errorFor("acceptedTerms")} />
                <Button
                  type="submit"
                  size="lg"
                  className="sm:col-span-2"
                  disabled={submission.isSubmitting}
                >
                  {submission.isSubmitting ? "Sending for review…" : "Submit listing for review"}{" "}
                  <ArrowRight />
                </Button>
              </form>
            </CardContent>
          </Card>

          <aside className="space-y-5 lg:sticky lg:top-32 lg:self-start">
            <div className="network-stage rounded-[1.75rem] p-6 text-ink-foreground">
              <ShieldCheck className="size-7 text-sidebar-primary" />
              <h2 className="mt-5 text-2xl font-bold">Private until approved.</h2>
              <p className="mt-3 text-sm leading-6 text-ink-foreground/65">
                Submitting does not create a public page. Reviewers check completeness and obvious
                risk before publishing.
              </p>
            </div>
            <Card className="card-surface">
              <CardContent className="p-6">
                <p className="eyebrow text-primary">What happens next</p>
                <ol className="mt-5 space-y-5">
                  {reviewSteps.map((step, index) => (
                    <li key={step.title} className="flex gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                        <step.icon className="size-4" />
                      </span>
                      <div>
                        <p className="font-bold">
                          {index + 1}. {step.title}
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{step.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
            <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-bold text-foreground">
                <Check className="size-4 text-primary" /> Already listed?
              </p>
              <p className="mt-2 leading-6">
                Use the ownership claim flow instead of creating a duplicate.
              </p>
              <Button asChild variant="link" className="mt-3">
                <Link to="/claim">
                  Claim an existing profile <ArrowRight />
                </Link>
              </Button>
            </div>
          </aside>
        </div>
      </div>
    </PublicShell>
  );
}
