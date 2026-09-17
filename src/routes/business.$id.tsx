import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bookmark,
  Check,
  Clock3,
  Flag,
  Globe,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Send,
  Sparkles,
  Star,
} from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { BusinessMark, EmptyState, OpenNowPill, Stars, VerifiedBadge } from "@/components/kit";
import { FieldError, FormFeedback } from "@/components/forms/FormFeedback";
import { Magnetic, Reveal, Spotlight } from "@/components/motion";
import { PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useSession } from "@/hooks/use-session";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest, jsonBody } from "@/lib/api";
import type { MyReview, PublicBusiness, ReviewListResponse } from "@/lib/contracts";
import {
  getBusinessReviews,
  getDirectoryBusiness,
  getRelatedBusinesses,
} from "@/lib/directory.functions";
import { publicConfig } from "@/lib/public-config";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/business/$id")({
  loader: async ({ params }) => {
    const [directory, reviews, related] = await Promise.all([
      getDirectoryBusiness({ data: params.id }),
      getBusinessReviews({ data: params.id }),
      getRelatedBusinesses({ data: params.id }),
    ]);
    if (!directory.available) throw new Error("The directory service is unavailable");
    if (!directory.business) throw notFound();
    return { business: directory.business, reviews: reviews.reviews, related: related.items };
  },
  head: ({ loaderData }) => {
    const business = loaderData?.business;
    if (!business) return { meta: [{ title: "Business not found — GainHub NG" }] };
    const title = `${business.name} — ${business.categoryName} in ${business.city} | GainHub NG`;
    const description = `${business.tagline}. Location, opening hours, services, reviews and contact options for ${business.name} in ${business.city}, ${business.state}.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { name: "robots", content: "index, follow, max-image-preview:large" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "business.business" },
        { property: "business:contact_data:street_address", content: business.address },
        { property: "business:contact_data:locality", content: business.city },
        { property: "business:contact_data:region", content: business.state },
        { property: "business:contact_data:country_name", content: "Nigeria" },
        ...(business.phone
          ? [{ property: "business:contact_data:phone_number", content: business.phone }]
          : []),
        ...(business.website
          ? [{ property: "business:contact_data:website", content: business.website }]
          : []),
      ],
    };
  },
  component: BusinessProfile,
});

/* -------------------------------------------------------------------------- */
/* Structured data                                                            */
/* -------------------------------------------------------------------------- */

function localBusinessSchema(business: PublicBusiness, average: number, total: number) {
  const siteUrl = publicConfig.siteUrl?.replace(/\/$/, "");
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    description: business.tagline,
    ...(siteUrl ? { url: `${siteUrl}/business/${business.slug}` } : {}),
    telephone: business.phone || business.whatsapp,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address,
      addressLocality: business.city,
      addressRegion: business.state,
      addressCountry: "NG",
    },
    ...(business.website ? { sameAs: [business.website] } : {}),
    ...(business.hours.length
      ? {
          openingHoursSpecification: business.hours
            .filter((entry) => !entry.isClosed)
            .map((entry) => ({
              "@type": "OpeningHoursSpecification",
              dayOfWeek: `https://schema.org/${entry.label}`,
              opens: entry.opensAt,
              closes: entry.closesAt,
            })),
        }
      : {}),
    // Only emit an aggregate rating when real, readable reviews back it up.
    ...(total > 0
      ? {
          aggregateRating: { "@type": "AggregateRating", ratingValue: average, reviewCount: total },
        }
      : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Contact actions                                                            */
/* -------------------------------------------------------------------------- */

function useContactRecorder(businessId: string) {
  return function record(channel: "whatsapp" | "phone" | "website" | "directions") {
    // Fire-and-forget: analytics must never block the customer's action.
    void apiRequest("/v1/events/contact", {
      method: "POST",
      body: jsonBody({ businessId, channel }),
    }).catch(() => undefined);
  };
}

function whatsappHref(business: PublicBusiness): string {
  const digits = business.whatsapp.replace(/[^\d]/g, "");
  const message = encodeURIComponent(
    `Hello ${business.name}, I found you on GainHub NG and would like to ask about your services.`,
  );
  return `https://wa.me/${digits}?text=${message}`;
}

/* -------------------------------------------------------------------------- */
/* Enquiry form                                                               */
/* -------------------------------------------------------------------------- */

function EnquiryForm({ business }: { business: PublicBusiness }) {
  const session = useSession();
  const submission = useSubmission();
  const [consent, setConsent] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const idempotencyKey = crypto.randomUUID();
    await submission.submit(
      () =>
        apiRequest("/v1/enquiries", {
          method: "POST",
          headers: { "idempotency-key": idempotencyKey },
          body: jsonBody({
            businessId: business.id,
            name: String(form.get("name") ?? ""),
            phone: String(form.get("phone") ?? ""),
            message: String(form.get("message") ?? ""),
            consent: true,
          }),
        }),
      "Enquiry sent. The business sees it in its workspace and can reply directly.",
    );
    if (submission.state.status !== "error") event.currentTarget.reset();
  }

  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="p-6 sm:p-7">
        <h2 className="text-xl font-bold">Send a structured enquiry</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Prefer a written request? The business receives it in its workspace with your details
          attached, and only uses it to answer you.
        </p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="enquiry-name">Your name</Label>
              <Input
                id="enquiry-name"
                name="name"
                required
                minLength={2}
                maxLength={100}
                defaultValue={session.data?.user?.fullName ?? ""}
                className="mt-2"
                aria-describedby="enquiry-name-error"
              />
              <FieldError id="enquiry-name-error" message={submission.fieldError("name")} />
            </div>
            <div>
              <Label htmlFor="enquiry-phone">Phone or WhatsApp</Label>
              <Input
                id="enquiry-phone"
                name="phone"
                type="tel"
                required
                placeholder="+234 801 234 5678"
                className="mt-2"
                aria-describedby="enquiry-phone-error"
              />
              <FieldError id="enquiry-phone-error" message={submission.fieldError("phone")} />
            </div>
          </div>

          <div>
            <Label htmlFor="enquiry-message">What do you need?</Label>
            <Textarea
              id="enquiry-message"
              name="message"
              required
              minLength={20}
              maxLength={1500}
              rows={4}
              placeholder="Describe the job, the quantity and when you need it. Specific requests get faster replies."
              className="mt-2"
              aria-describedby="enquiry-message-error"
            />
            <FieldError id="enquiry-message-error" message={submission.fieldError("message")} />
          </div>

          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <input
              type="checkbox"
              checked={consent}
              onChange={(event) => setConsent(event.target.checked)}
              className="mt-1 size-4 shrink-0 accent-primary"
              required
            />
            <span className="text-muted-foreground">
              I agree that GainHub may pass these details to {business.name} so they can reply to my
              request.
            </span>
          </label>

          <FormFeedback
            status={submission.state.status}
            message={submission.state.message}
            {...("requestId" in submission.state ? { requestId: submission.state.requestId } : {})}
          />

          <Magnetic>
            <Button type="submit" size="lg" disabled={submission.isSubmitting || !consent}>
              {submission.isSubmitting ? (
                "Sending…"
              ) : (
                <>
                  <Send /> Send enquiry
                </>
              )}
            </Button>
          </Magnetic>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Review form                                                                */
/* -------------------------------------------------------------------------- */

const REVIEW_STATUS_COPY: Record<
  MyReview["status"],
  { label: string; tone: string; detail: string }
> = {
  pending: {
    label: "Awaiting moderation",
    tone: "bg-accent/15 text-accent-foreground border-accent/35",
    detail:
      "Our team is reading this now. It is not public yet, and it is not counted in the score above.",
  },
  published: {
    label: "Published",
    tone: "bg-primary/12 text-primary border-primary/30",
    detail: "This review is live and counted in the score above.",
  },
  rejected: {
    label: "Not published",
    tone: "bg-muted text-muted-foreground border-border",
    detail:
      "This review did not pass moderation, so it is not shown publicly. You can rewrite it and send it back.",
  },
  disputed: {
    label: "Under dispute",
    tone: "bg-destructive/12 text-destructive border-destructive/30",
    detail:
      "The business has raised a dispute about this review. Editing is paused until our team resolves it.",
  },
};

/**
 * A single composer for both writing and editing a review.
 *
 * The interesting half is the edit path: a published review that gets edited is
 * pulled back out of the public aggregate and re-moderated, so the interface has
 * to say that out loud *before* someone submits. Silently hiding a review a
 * person believes is already live reads like a bug.
 */
function ReviewComposer({
  business,
  mine,
  onChanged,
}: {
  business: PublicBusiness;
  mine: MyReview | null;
  onChanged: () => void;
}) {
  const session = useSession();
  const submission = useSubmission();
  const user = session.data?.user ?? null;
  const [rating, setRating] = useState(mine?.rating ?? 5);
  const [editing, setEditing] = useState(false);

  // Adopt the server's copy whenever it changes, so a successful edit collapses
  // the form and an out-of-band refresh does not leave stale text on screen.
  useEffect(() => {
    setRating(mine?.rating ?? 5);
    setEditing(false);
  }, [mine?.rating, mine?.updatedAt, mine?.status]);

  if (!user) {
    return (
      <Card className="rounded-3xl border-dashed border-border/70 bg-muted/25">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="text-lg font-bold">Have you used this business?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in to review. Each account may review a business once.
            </p>
          </div>
          <Button asChild>
            <Link to="/auth">Sign in to review</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const status = mine ? REVIEW_STATUS_COPY[mine.status] : null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = String(form.get("body") ?? "");
    const wasPublished = mine?.status === "published";

    const ok = mine
      ? await submission.submit(
          () =>
            apiRequest(`/v1/reviews/${mine.id}`, {
              method: "PATCH",
              body: jsonBody({ rating, body }),
            }),
          wasPublished
            ? "Saved. Your review is back in the moderation queue, and it is hidden from the page until it is approved again."
            : "Saved. Your review is in the moderation queue.",
        )
      : await submission.submit(
          () =>
            apiRequest("/v1/reviews", {
              method: "POST",
              body: jsonBody({ businessId: business.id, rating, body }),
            }),
          "Thanks. Your review is awaiting moderation before it appears publicly.",
        );

    if (ok) {
      event.currentTarget.reset();
      onChanged();
    }
  }

  /* ---------------- Your existing review, read-only ---------------- */

  if (mine && !editing) {
    const locked = mine.status === "disputed";
    return (
      <Card className="rounded-3xl border-border/70">
        <CardContent className="p-6 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Your review</h2>
              <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
                {status?.detail}
              </p>
            </div>
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
                status?.tone,
              )}
            >
              <Clock3 className="size-3.5" aria-hidden="true" />
              {status?.label}
            </span>
          </div>

          <div className="mt-5 rounded-2xl border border-border/70 bg-muted/25 p-5">
            <div className="flex items-center justify-between gap-3">
              <Stars rating={mine.rating} />
              <span className="text-xs text-muted-foreground">
                {mine.editedAt
                  ? `Edited ${new Date(mine.editedAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`
                  : `Written ${new Date(mine.createdAt).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}`}
              </span>
            </div>
            <p className="mt-3 whitespace-pre-line text-sm leading-7">{mine.body}</p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button
              variant={mine.status === "published" ? "outline" : "default"}
              onClick={() => {
                submission.reset();
                setEditing(true);
              }}
              disabled={locked}
            >
              {mine.status === "rejected" ? "Rewrite and resubmit" : "Edit your review"}
            </Button>
            {locked ? (
              <p className="text-xs text-muted-foreground">
                Editing is unavailable while the dispute is open.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  /* ---------------- Write / edit form ---------------- */

  const isEdit = Boolean(mine);
  const willBeHidden = mine?.status === "published";

  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold">
              {isEdit ? "Edit your review" : `Review ${business.name}`}
            </h2>
            <p className="mt-2 max-w-prose text-sm leading-6 text-muted-foreground">
              {isEdit
                ? "You are updating the review already on file for this business."
                : "Reviews are moderated before publication, and each account may review a business once."}
            </p>
          </div>
          {isEdit ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                submission.reset();
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          ) : null}
        </div>

        {willBeHidden ? (
          <p className="mt-5 rounded-2xl border border-accent/35 bg-accent/10 p-4 text-sm leading-6">
            <strong className="font-semibold">This review is currently published.</strong> Saving
            changes sends it back to moderation, so it disappears from this page and stops counting
            toward the score until it is approved again.
          </p>
        ) : null}

        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <fieldset>
            <legend className="text-sm font-semibold">Your rating</legend>
            <div className="mt-2 flex gap-1.5" role="radiogroup" aria-label="Rating out of 5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  aria-pressed={rating === value}
                  aria-label={`${value} star${value === 1 ? "" : "s"}`}
                  className={cn(
                    "grid size-11 place-items-center rounded-xl border transition-all duration-300",
                    value <= rating
                      ? "border-accent/45 bg-accent/15 text-accent"
                      : "border-border text-muted-foreground hover:border-accent/30",
                  )}
                >
                  <Star
                    className={cn("size-5", value <= rating ? "fill-accent" : "")}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <Label htmlFor="review-body">Your review</Label>
            <Textarea
              id="review-body"
              name="body"
              required
              minLength={20}
              maxLength={1500}
              rows={4}
              defaultValue={mine?.body ?? ""}
              placeholder="What did you ask for, how did it go, and what should the next customer know?"
              className="mt-2"
              aria-describedby="review-body-error"
            />
            <FieldError id="review-body-error" message={submission.fieldError("body")} />
          </div>

          <FormFeedback
            status={submission.state.status}
            message={submission.state.message}
            {...("requestId" in submission.state ? { requestId: submission.state.requestId } : {})}
          />

          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={submission.isSubmitting}>
              {submission.isSubmitting
                ? isEdit
                  ? "Saving…"
                  : "Submitting…"
                : isEdit
                  ? "Save changes"
                  : "Submit review"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Reviews list                                                               */
/* -------------------------------------------------------------------------- */

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

function ReviewsSection({
  business,
  reviews,
  onChanged,
}: {
  business: PublicBusiness;
  reviews: ReviewListResponse;
  onChanged: () => void;
}) {
  const maxBucket = Math.max(1, ...Object.values(reviews.summary.distribution));

  return (
    <section aria-labelledby="reviews-heading" className="space-y-6">
      <div>
        <h2 id="reviews-heading" className="display-md">
          Reviews
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Published reviews only. Anything pending or rejected is never shown.
        </p>
      </div>

      {reviews.summary.total > 0 ? (
        <div className="grid gap-6 rounded-3xl border border-border/70 bg-card p-6 sm:grid-cols-[13rem_1fr] sm:p-7">
          <div className="text-center sm:text-left">
            <p className="font-display text-5xl font-extrabold tabular-nums">
              {reviews.summary.average.toFixed(1)}
            </p>
            <div className="mt-1">
              <Stars rating={reviews.summary.average} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {reviews.summary.total} published review{reviews.summary.total === 1 ? "" : "s"}
            </p>
          </div>

          <div className="space-y-1.5">
            {[5, 4, 3, 2, 1].map((bucket) => {
              const count = reviews.summary.distribution[bucket as 1 | 2 | 3 | 4 | 5] ?? 0;
              return (
                <div key={bucket} className="flex items-center gap-3 text-xs">
                  <span className="w-8 shrink-0 tabular-nums text-muted-foreground">
                    {bucket} <Star className="inline size-3 fill-accent text-accent" />
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span
                      className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                      style={{ width: `${(count / maxBucket) * 100}%` }}
                    />
                  </span>
                  <span className="w-6 shrink-0 text-right tabular-nums text-muted-foreground">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {reviews.items.length ? (
        <ul className="grid gap-4">
          {reviews.items.map((review, index) => (
            <Reveal as="li" key={review.id} delay={index % 4}>
              <Spotlight className="h-full rounded-3xl">
                <article className="h-full rounded-3xl border border-border/70 bg-card p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <BusinessMark
                        name={review.authorName}
                        id={review.id}
                        className="size-9 text-xs"
                      />
                      <div>
                        <p className="text-sm font-bold">{review.authorName}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(review.createdAt).toLocaleDateString("en-NG", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </div>
                    <Stars rating={review.rating} />
                  </div>
                  <p className="mt-4 text-sm leading-7 text-muted-foreground">{review.body}</p>
                </article>
              </Spotlight>
            </Reveal>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={<Star className="size-7" />}
          title="No published reviews yet"
          body="This listing has not received a review that passed moderation. Nothing is shown here until a real customer review is approved."
        />
      )}

      <ReviewComposer business={business} mine={reviews.mine} onChanged={onChanged} />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                       */
/* -------------------------------------------------------------------------- */

function BusinessProfile() {
  const { business, related, reviews: initialReviews } = Route.useLoaderData();
  const [reviews, setReviews] = useState(initialReviews);
  const session = useSession();
  const queryClient = useQueryClient();
  const record = useContactRecorder(business.id);
  const [actionMessage, setActionMessage] = useState("");

  const reviewsQuery = useQuery({
    queryKey: ["business-reviews", business.id],
    queryFn: () =>
      apiRequest<ReviewListResponse>(`/v1/businesses/${business.slug}/reviews`).catch(() => null),
    enabled: false,
    staleTime: 0,
  });

  const savedQuery = useQuery({
    queryKey: ["saved-businesses"],
    queryFn: () => apiRequest<{ items: PublicBusiness[] }>("/v1/me/saved-businesses"),
    enabled: Boolean(session.data?.user),
    retry: false,
  });
  const saved = useMemo(
    () => Boolean(savedQuery.data?.items.some((item) => item.id === business.id)),
    [savedQuery.data, business.id],
  );

  // Re-read reviews from the API after a successful submission so the page shows
  // the truth rather than an optimistic guess about what moderation will accept.
  const refreshReviews = () => {
    void reviewsQuery.refetch();
  };

  useEffect(() => {
    if (reviewsQuery.data) setReviews(reviewsQuery.data);
  }, [reviewsQuery.data]);

  useEffect(() => {
    if (!actionMessage) return;
    const timer = setTimeout(() => setActionMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [actionMessage]);

  async function toggleSaved() {
    const next = !saved;
    queryClient.setQueryData<{ items: PublicBusiness[] }>(["saved-businesses"], (current) => {
      const items = current?.items ?? [];
      return {
        items: next ? [...items, business] : items.filter((item) => item.id !== business.id),
      };
    });
    try {
      await apiRequest("/v1/me/saved-businesses", {
        method: "PUT",
        body: jsonBody({ businessId: business.id, saved: next }),
      });
      setActionMessage(next ? "Saved to your account." : "Removed from saved items.");
    } catch {
      void queryClient.invalidateQueries({ queryKey: ["saved-businesses"] });
      setActionMessage("We could not update your saved items. Please try again.");
    }
  }

  const schema = useMemo(
    () => localBusinessSchema(business, reviews.summary.average, reviews.summary.total),
    [business, reviews],
  );

  const orderedHours = DAY_ORDER.map((day) =>
    business.hours.find((entry) => entry.dayOfWeek === day),
  ).filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

  const today = new Date().getDay();

  return (
    <PublicShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
      />

      {/* ================= MASTHEAD ================= */}
      <section className="grain relative overflow-hidden bg-ink text-ink-foreground">
        <div className="aurora opacity-55" aria-hidden="true" />
        <div
          className="absolute -right-28 -top-24 size-96 rounded-full border border-white/10"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-7xl px-5 pb-12 pt-10 md:pb-16 md:pt-14">
          <nav aria-label="Breadcrumb" className="text-xs text-ink-foreground/50">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link to="/" className="hover:text-sidebar-primary">
                  Home
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  to="/category/$slug"
                  params={{ slug: business.categorySlug }}
                  className="hover:text-sidebar-primary"
                >
                  {business.categoryName}
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>
                <Link
                  to="/locations/$slug"
                  params={{ slug: business.locationSlug }}
                  className="hover:text-sidebar-primary"
                >
                  {business.city}
                </Link>
              </li>
            </ol>
          </nav>

          <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div className="flex gap-5">
              <BusinessMark
                name={business.name}
                id={business.id}
                className="size-20 shrink-0 border-4 border-white/10 text-2xl md:size-24"
              />
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <OpenNowPill open={business.openNow} hours={business.hours} />
                  <Badge
                    variant="secondary"
                    className="border-white/12 bg-white/8 text-ink-foreground backdrop-blur"
                  >
                    {business.categoryName}
                  </Badge>
                  {business.priceRange ? (
                    <Badge
                      variant="secondary"
                      className="border-white/12 bg-white/8 text-ink-foreground backdrop-blur"
                    >
                      {business.priceRange}
                    </Badge>
                  ) : null}
                </div>
                <h1 className="display-md mt-3 text-ink-foreground">{business.name}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-foreground/65">
                  {business.tagline}
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-foreground/55">
                  {business.reviewCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-ink-foreground/85">
                      <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
                      <strong className="tabular-nums">{business.rating.toFixed(1)}</strong>
                      <span>
                        ({business.reviewCount} review
                        {business.reviewCount === 1 ? "" : "s"})
                      </span>
                    </span>
                  ) : (
                    <span>No reviews yet</span>
                  )}
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-3.5" aria-hidden="true" />
                    {business.city}, {business.state}
                  </span>
                  <VerifiedBadge level={business.verificationLevel} />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Magnetic strength={0.2}>
                <Button
                  asChild
                  size="lg"
                  className="bg-[#25D366] text-[#052e12] hover:bg-[#25D366]/90"
                >
                  <a
                    href={whatsappHref(business)}
                    onClick={() => record("whatsapp")}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    <MessageCircle /> WhatsApp
                  </a>
                </Button>
              </Magnetic>
              {business.phone ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-transparent text-ink-foreground hover:bg-white/10"
                >
                  <a
                    href={`tel:${business.phone.replace(/\s/g, "")}`}
                    onClick={() => record("phone")}
                  >
                    <Phone /> Call
                  </a>
                </Button>
              ) : null}
              {business.website ? (
                <Button
                  asChild
                  size="lg"
                  variant="outline"
                  className="border-white/20 bg-transparent text-ink-foreground hover:bg-white/10"
                >
                  <a
                    href={business.website}
                    onClick={() => record("website")}
                    rel="noopener noreferrer nofollow"
                    target="_blank"
                  >
                    <Globe /> Website
                  </a>
                </Button>
              ) : null}
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/20 bg-transparent text-ink-foreground hover:bg-white/10"
              >
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                    `${business.name} ${business.address} ${business.city} ${business.state}`,
                  )}`}
                  onClick={() => record("directions")}
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  <Navigation /> Directions
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BODY ================= */}
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 lg:grid-cols-[1fr_22rem] lg:py-16">
        <div className="min-w-0 space-y-12">
          {actionMessage ? (
            <p
              className="rounded-2xl border border-primary/25 bg-primary/8 px-4 py-3 text-sm font-medium"
              role="status"
            >
              {actionMessage}
            </p>
          ) : null}

          {/* About */}
          <Reveal>
            <section aria-labelledby="about-heading">
              <h2 id="about-heading" className="display-md">
                About
              </h2>
              <p className="mt-4 max-w-3xl whitespace-pre-line text-base leading-8 text-muted-foreground">
                {business.about}
              </p>

              {business.serviceAreas.length ? (
                <div className="mt-6">
                  <h3 className="eyebrow text-muted-foreground">Areas served</h3>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {business.serviceAreas.map((area) => (
                      <Badge key={area} variant="secondary">
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}
            </section>
          </Reveal>

          {/* Services */}
          {business.services?.length ? (
            <Reveal>
              <section aria-labelledby="services-heading">
                <h2 id="services-heading" className="display-md">
                  Services
                </h2>
                <ul className="mt-5 divide-y overflow-hidden rounded-3xl border border-border/70">
                  {business.services.map((service, index) => (
                    <li
                      key={service.id}
                      className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-4 transition-colors hover:bg-muted/40"
                    >
                      <span className="flex items-center gap-3">
                        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-secondary text-[0.7rem] font-bold text-primary">
                          {index + 1}
                        </span>
                        <span>
                          <span className="font-semibold">{service.name}</span>
                          {service.note ? (
                            <span className="block text-xs text-muted-foreground">
                              {service.note}
                            </span>
                          ) : null}
                        </span>
                      </span>
                      {service.price ? (
                        <span className="text-sm font-bold tabular-nums text-primary">
                          {service.price}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            </Reveal>
          ) : null}

          {/* Reviews */}
          <ReviewsSection business={business} reviews={reviews} onChanged={refreshReviews} />

          {/* Enquiry */}
          <Reveal>
            <EnquiryForm business={business} />
          </Reveal>
        </div>

        {/* ================= SIDEBAR ================= */}
        <aside className="space-y-5 lg:sticky lg:top-28 lg:h-fit">
          <Reveal>
            <Card className="rounded-3xl border-border/70">
              <CardContent className="space-y-4 p-5">
                <div>
                  <h2 className="eyebrow text-muted-foreground">Address</h2>
                  <p className="mt-1.5 text-sm leading-6">
                    {business.address}
                    <br />
                    {business.city}, {business.state}
                  </p>
                </div>

                {orderedHours.length ? (
                  <>
                    <Separator />
                    <div>
                      <h2 className="eyebrow flex items-center gap-2 text-muted-foreground">
                        <Clock3 className="size-3.5" aria-hidden="true" /> Opening hours
                      </h2>
                      <ul className="mt-2.5 space-y-1 text-sm">
                        {orderedHours.map((entry) => (
                          <li
                            key={entry.dayOfWeek}
                            className={cn(
                              "flex justify-between gap-3",
                              entry.dayOfWeek === today ? "font-bold text-primary" : "",
                            )}
                          >
                            <span>{entry.label}</span>
                            <span className="tabular-nums text-muted-foreground">
                              {entry.isClosed ? "Closed" : `${entry.opensAt} – ${entry.closesAt}`}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs text-muted-foreground">Times are Africa/Lagos.</p>
                    </div>
                  </>
                ) : null}

                {business.amenities.length ? (
                  <>
                    <Separator />
                    <div>
                      <h2 className="eyebrow text-muted-foreground">At this business</h2>
                      <ul className="mt-2.5 grid gap-1.5 text-sm">
                        {business.amenities.map((amenity) => (
                          <li key={amenity} className="flex items-center gap-2">
                            <Check className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                            {amenity}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}

                {business.socials.length ? (
                  <>
                    <Separator />
                    <div>
                      <h2 className="eyebrow text-muted-foreground">Elsewhere</h2>
                      <ul className="mt-2.5 space-y-1.5 text-sm">
                        {business.socials.map((social) => (
                          <li
                            key={`${social.label}-${social.handle}`}
                            className="flex justify-between gap-3"
                          >
                            <span className="text-muted-foreground">{social.label}</span>
                            <span className="font-medium">{social.handle}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : null}

                <Separator />

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={saved ? "secondary" : "outline"}
                    onClick={() => void toggleSaved()}
                    disabled={!session.data?.user}
                    aria-pressed={saved}
                    title={session.data?.user ? undefined : "Sign in to save businesses"}
                  >
                    <Bookmark className={saved ? "fill-current" : ""} />
                    {saved ? "Saved" : "Save"}
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/report">
                      <Flag /> Report
                    </Link>
                  </Button>
                </div>
                {!session.data?.user ? (
                  <p className="text-xs text-muted-foreground">
                    <Link to="/auth" className="link-underline font-semibold">
                      Sign in
                    </Link>{" "}
                    to save this business to your account.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={1}>
            <Card className="rounded-3xl border-border/70 bg-muted/35">
              <CardContent className="p-5">
                <h2 className="eyebrow text-muted-foreground">Verification</h2>
                <div className="mt-3">
                  <VerifiedBadge level={business.verificationLevel} />
                </div>
                <p className="mt-3 text-xs leading-6 text-muted-foreground">
                  This label records what our review team checked. It is not a warranty, a ranking
                  purchase, or a guarantee of service quality.
                </p>
              </CardContent>
            </Card>
          </Reveal>

          <Reveal delay={2}>
            <Card className="grain relative overflow-hidden rounded-3xl bg-primary text-primary-foreground">
              <CardContent className="relative p-5">
                <Sparkles className="size-5" aria-hidden="true" />
                <h2 className="mt-3 text-lg font-bold">Own this business?</h2>
                <p className="mt-2 text-xs leading-6 text-primary-foreground/80">
                  Claim it to manage this profile, update hours and services, and see the enquiries
                  it generates.
                </p>
                <Button
                  asChild
                  size="sm"
                  className="mt-4 bg-background text-foreground hover:bg-background/90"
                >
                  <Link to="/claim">
                    Claim this listing <ArrowRight />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </Reveal>
        </aside>
      </div>

      {/* ================= RELATED ================= */}
      {related.length ? (
        <section className="mx-auto max-w-7xl px-5 pb-20">
          <Reveal>
            <div className="flex items-end justify-between gap-5">
              <div>
                <p className="eyebrow text-primary">Keep looking</p>
                <h2 className="display-md mt-3">Similar businesses</h2>
              </div>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link to="/search">
                  Search all <ArrowRight />
                </Link>
              </Button>
            </div>
          </Reveal>
          <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {related.slice(0, 3).map((item, index) => (
              <Reveal key={item.id} delay={index} className="h-full">
                <a
                  href={`/business/${item.slug}`}
                  className="group flex h-full items-start gap-4 rounded-2xl border border-border/70 bg-card p-5 transition-[transform,border-color,box-shadow] duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lift"
                >
                  <BusinessMark name={item.name} id={item.id} className="size-11 text-sm" />
                  <span className="min-w-0">
                    <span className="block font-bold leading-tight transition-colors group-hover:text-primary">
                      {item.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {item.city}, {item.state} · {item.categoryName}
                    </span>
                    {item.reviewCount > 0 ? (
                      <span className="mt-2 block">
                        <Stars rating={item.rating} count={item.reviewCount} />
                      </span>
                    ) : null}
                  </span>
                </a>
              </Reveal>
            ))}
          </div>
        </section>
      ) : null}
    </PublicShell>
  );
}
