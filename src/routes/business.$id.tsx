import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Bookmark,
  Clock3,
  ExternalLink,
  Flag,
  Globe,
  GitCompareArrows,
  MapPin,
  MessageCircle,
  Navigation,
  Phone,
  Send,
  Share2,
  ShieldCheck,
  Star,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { BusinessCard, Stars, VerifiedBadge } from "@/components/kit";
import { FormFeedback, FieldError } from "@/components/forms/FormFeedback";
import { PreviewNotice, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { businesses, getBusiness, type Business } from "@/data/mock";
import { useSubmission } from "@/hooks/use-submission";
import { ApiClientError, apiRequest, jsonBody } from "@/lib/api";
import type { PublicBusiness } from "@/lib/contracts";
import { publicConfig } from "@/lib/public-config";
import { getDirectoryBusiness } from "@/lib/directory.functions";

export const Route = createFileRoute("/business/$id")({
  loader: async ({ params }) => {
    const preview = getBusiness(params.id);
    if (preview) return { kind: "preview" as const, business: preview };
    const response = await getDirectoryBusiness({ data: params.id });
    if (!response.available) throw new Error("The directory service is unavailable");
    if (!response.business) throw notFound();
    return { kind: "live" as const, business: response.business };
  },
  head: ({ loaderData }) => {
    const business = loaderData?.business;
    if (!business) return { meta: [{ title: "Business not found — GainHub NG" }] };
    const isPreview = loaderData.kind === "preview";
    const category = "isDemo" in business ? business.category : business.categoryName;
    const title = `${business.name} — ${category} in ${business.city} | GainHub NG`;
    const description = `${business.tagline}. View location, verification detail, services and contact options.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        {
          name: "robots",
          content: isPreview ? "noindex, follow" : "index, follow, max-image-preview:large",
        },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "business.business" },
      ],
    };
  },
  component: BusinessProfile,
});

type Profile = {
  source: "preview" | "live";
  id: string;
  routeId: string;
  name: string;
  tagline: string;
  about: string;
  category: string;
  categorySlug: string;
  city: string;
  state: string;
  address: string;
  rating: number;
  reviewCount: number;
  verified: Business["verified"];
  openNow: boolean;
  whatsapp: string;
  phone: string;
  website: string;
  services: Array<{ id: string; name: string; price: string; note: string }>;
};

function normalizeProfile(kind: "preview" | "live", business: Business | PublicBusiness): Profile {
  if (kind === "preview" && "isDemo" in business) {
    return {
      source: "preview",
      id: business.id,
      routeId: business.id,
      name: business.name,
      tagline: business.tagline,
      about: business.about,
      category: business.category,
      categorySlug: business.categorySlug,
      city: business.city,
      state: business.state,
      address: business.address,
      rating: business.rating,
      reviewCount: business.reviews,
      verified: business.verified,
      openNow: business.openNow,
      whatsapp: business.whatsapp,
      phone: business.phone,
      website: business.website,
      services: business.services.map((service, index) => ({ id: `preview-${index}`, ...service })),
    };
  }
  const live = business as PublicBusiness;
  return {
    source: "live",
    id: live.id,
    routeId: live.slug,
    name: live.name,
    tagline: live.tagline,
    about: live.about,
    category: live.categoryName,
    categorySlug: live.categorySlug,
    city: live.city,
    state: live.state,
    address: live.address,
    rating: live.rating,
    reviewCount: live.reviewCount,
    verified: live.verificationLevel,
    openNow: live.openNow,
    whatsapp: live.whatsapp,
    phone: live.phone,
    website: live.website,
    services: live.services ?? [],
  };
}

function digits(phone: string): string {
  return phone.replace(/\D/g, "");
}

function safeWebsite(value: string): string | null {
  if (!value) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(withProtocol);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function trackContact(profile: Profile, channel: "whatsapp" | "phone" | "website" | "directions") {
  if (profile.source !== "live") return;
  void apiRequest("/v1/events/contact", {
    method: "POST",
    body: jsonBody({ businessId: profile.id, channel, source: "profile" }),
  }).catch(() => undefined);
}

function ProfileActions({ profile }: { profile: Profile }) {
  const [saved, setSaved] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const website = safeWebsite(profile.website);
  const whatsappUrl = `https://wa.me/${digits(profile.whatsapp)}?text=${encodeURIComponent(
    `Hello ${profile.name}, I found your profile on GainHub NG and would like to ask about your services.`,
  )}`;

  async function toggleSaved() {
    if (profile.source === "preview") return;
    const next = !saved;
    setActionMessage("");
    try {
      await apiRequest("/v1/me/saved-businesses", {
        method: "PUT",
        body: jsonBody({ businessId: profile.id, saved: next }),
      });
      setSaved(next);
      setActionMessage(next ? "Business saved." : "Business removed from saved items.");
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        window.location.assign(`/auth?next=${encodeURIComponent(`/business/${profile.routeId}`)}`);
        return;
      }
      setActionMessage("We could not update your saved items. Please try again.");
    }
  }

  async function share() {
    const url = window.location.href;
    setActionMessage("");
    try {
      if (navigator.share) {
        await navigator.share({ title: profile.name, text: profile.tagline, url });
        setActionMessage("Share options opened.");
      } else {
        await navigator.clipboard.writeText(url);
        setActionMessage("Profile link copied.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setActionMessage("We could not share this profile. Copy the address from your browser.");
    }
  }

  if (profile.source === "preview") {
    return (
      <Button asChild size="lg">
        <Link to="/join">
          Create a real listing <ArrowRight />
        </Link>
      </Button>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="lg">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackContact(profile, "whatsapp")}
          >
            <MessageCircle /> WhatsApp
          </a>
        </Button>
        {profile.phone ? (
          <Button asChild size="lg" variant="outline">
            <a href={`tel:${digits(profile.phone)}`} onClick={() => trackContact(profile, "phone")}>
              <Phone /> Call
            </a>
          </Button>
        ) : null}
        <Button
          size="icon"
          variant="outline"
          aria-label={saved ? "Remove saved business" : "Save business"}
          aria-pressed={saved}
          onClick={() => void toggleSaved()}
        >
          <Bookmark className={saved ? "fill-primary text-primary" : ""} />
        </Button>
        <Button
          size="icon"
          variant="outline"
          aria-label="Share profile"
          onClick={() => void share()}
        >
          <Share2 />
        </Button>
        <Button asChild size="icon" variant="outline">
          <Link to="/compare" search={{ ids: profile.id }} aria-label="Add business to comparison">
            <GitCompareArrows />
          </Link>
        </Button>
        {website ? (
          <Button asChild size="icon" variant="outline">
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer nofollow"
              aria-label="Visit business website"
              onClick={() => trackContact(profile, "website")}
            >
              <ExternalLink />
            </a>
          </Button>
        ) : null}
      </div>
      {actionMessage ? (
        <p className="mt-2 text-sm text-ink-foreground/70" role="status">
          {actionMessage}
        </p>
      ) : null}
    </div>
  );
}

function EnquiryForm({ profile }: { profile: Profile }) {
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const succeeded = await submission.submit(
      () =>
        apiRequest("/v1/enquiries", {
          method: "POST",
          idempotencyKey: crypto.randomUUID(),
          body: jsonBody({
            businessId: profile.id,
            name: data.get("name"),
            phone: data.get("phone"),
            message: data.get("message"),
            consent: data.get("consent") === "on",
          }),
        }),
      "Your enquiry was sent. The business can now respond using the number you provided.",
    );
    if (succeeded) form.reset();
  }

  if (profile.source === "preview") {
    return (
      <Card className="card-surface border-dashed">
        <CardContent className="p-6">
          <p className="font-bold">Enquiries are disabled on preview profiles</p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            This protects visitors from sending personal information to fictional records. Live,
            reviewed profiles accept enquiries here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card-surface" id="enquire">
      <CardContent className="p-6 sm:p-8">
        <p className="eyebrow text-primary">Structured enquiry</p>
        <h2 className="mt-3 text-2xl font-bold">Tell {profile.name} what you need</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Include enough detail for a useful first reply. Your number is shared only with this
          business for this enquiry.
        </p>
        <form
          className="mt-6 grid gap-4 sm:grid-cols-2"
          onSubmit={(event) => void onSubmit(event)}
          noValidate
        >
          <div>
            <Label htmlFor="enquiry-name">Your name</Label>
            <Input
              id="enquiry-name"
              name="name"
              autoComplete="name"
              className="mt-2"
              aria-invalid={Boolean(submission.fieldError("name"))}
              aria-describedby={submission.fieldError("name") ? "enquiry-name-error" : undefined}
              required
            />
            <FieldError id="enquiry-name-error" message={submission.fieldError("name")} />
          </div>
          <div>
            <Label htmlFor="enquiry-phone">Phone or WhatsApp</Label>
            <Input
              id="enquiry-phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              className="mt-2"
              aria-invalid={Boolean(submission.fieldError("phone"))}
              aria-describedby={submission.fieldError("phone") ? "enquiry-phone-error" : undefined}
              required
            />
            <FieldError id="enquiry-phone-error" message={submission.fieldError("phone")} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="enquiry-message">What do you need?</Label>
            <Textarea
              id="enquiry-message"
              name="message"
              className="mt-2 min-h-32"
              placeholder="The job, timing, location and any useful constraints…"
              aria-invalid={Boolean(submission.fieldError("message"))}
              aria-describedby={
                submission.fieldError("message") ? "enquiry-message-error" : undefined
              }
              required
            />
            <FieldError id="enquiry-message-error" message={submission.fieldError("message")} />
          </div>
          <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground sm:col-span-2">
            <input type="checkbox" name="consent" className="mt-1 size-4 accent-primary" required />
            I agree that GainHub may send these details to this business so it can respond to my
            enquiry.
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
          <Button type="submit" disabled={submission.isSubmitting} className="sm:col-span-2">
            <Send /> {submission.isSubmitting ? "Sending securely…" : "Send enquiry"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ReviewForm({ profile }: { profile: Profile }) {
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const succeeded = await submission.submit(
      () =>
        apiRequest("/v1/reviews", {
          method: "POST",
          body: jsonBody({
            businessId: profile.id,
            rating: data.get("rating"),
            body: data.get("body"),
          }),
        }),
      "Thanks. Your review is awaiting moderation before it appears publicly.",
    );
    if (succeeded) form.reset();
  }

  if (profile.source === "preview") return null;
  return (
    <Card className="card-surface">
      <CardContent className="p-6">
        <h2 className="text-xl font-bold">Share a genuine experience</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          You must sign in, and each account may review a business once.
        </p>
        <form className="mt-5 space-y-4" onSubmit={(event) => void onSubmit(event)}>
          <div className="block">
            <Label htmlFor="review-rating">Rating</Label>
            <select
              id="review-rating"
              name="rating"
              className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
              required
            >
              <option value="">Choose a rating</option>
              {[5, 4, 3, 2, 1].map((rating) => (
                <option key={rating} value={rating}>
                  {rating} {rating === 1 ? "star" : "stars"}
                </option>
              ))}
            </select>
          </div>
          <div className="block">
            <Label htmlFor="review-body">Your review</Label>
            <Textarea
              id="review-body"
              name="body"
              className="mt-2 min-h-28"
              minLength={20}
              maxLength={1500}
              required
            />
          </div>
          <FormFeedback
            status={submission.state.status}
            message={submission.state.message}
            {...(submission.state.status === "error" && submission.state.requestId
              ? { requestId: submission.state.requestId }
              : {})}
          />
          <Button type="submit" disabled={submission.isSubmitting}>
            <Star /> {submission.isSubmitting ? "Submitting…" : "Submit for review"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BusinessProfile() {
  const loaderData = Route.useLoaderData();
  const profile = normalizeProfile(loaderData.kind, loaderData.business);
  const previewBusiness = loaderData.kind === "preview" ? loaderData.business : null;
  const related = businesses.filter((business) => business.id !== profile.routeId).slice(0, 3);
  const directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(profile.address)}`;
  const schema =
    profile.source === "live"
      ? {
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: profile.name,
          description: profile.about,
          address: profile.address,
          telephone: profile.phone || profile.whatsapp,
          ...(publicConfig.siteUrl
            ? {
                url: `${publicConfig.siteUrl.replace(/\/$/, "")}/business/${encodeURIComponent(profile.routeId)}`,
              }
            : {}),
          ...(profile.reviewCount > 0
            ? {
                aggregateRating: {
                  "@type": "AggregateRating",
                  ratingValue: profile.rating,
                  reviewCount: profile.reviewCount,
                },
              }
            : {}),
        }
      : null;

  return (
    <PublicShell>
      {profile.source === "preview" ? (
        <PreviewNotice>
          Product preview: this profile is fictional, contact actions are disabled, and this route
          is excluded from search indexing.
        </PreviewNotice>
      ) : null}
      {schema ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
        />
      ) : null}
      <section className="network-stage relative overflow-hidden text-ink-foreground">
        <div className="paper-grid absolute inset-0 opacity-50" aria-hidden="true" />
        <div
          className="absolute -right-20 -top-40 size-[32rem] rounded-full border border-white/10"
          aria-hidden="true"
        />
        <div className="relative mx-auto max-w-7xl px-5 pb-12 pt-14 md:pb-16 md:pt-20">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <VerifiedBadge level={profile.verified} />
                <Badge variant="outline" className="border-white/15 bg-white/5 text-ink-foreground">
                  {profile.category}
                </Badge>
              </div>
              <h1 className="mt-5 text-5xl font-extrabold leading-[0.9] tracking-[-0.055em] md:text-7xl">
                {profile.name}
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-ink-foreground/70">
                {profile.tagline}
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-ink-foreground/65">
                {profile.rating > 0 ? (
                  <span className="flex items-center gap-2 text-ink-foreground">
                    <Stars rating={profile.rating} /> <span>{profile.reviewCount} reviews</span>
                  </span>
                ) : (
                  <span>New listing</span>
                )}
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-4 text-sidebar-primary" /> {profile.city}, {profile.state}
                </span>
                <span className="flex items-center gap-1.5">
                  <Clock3 className="size-4 text-sidebar-primary" />{" "}
                  {profile.openNow ? "Recorded as open" : "Open status not confirmed"}
                </span>
              </div>
            </div>
            <ProfileActions profile={profile} />
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1fr_21rem] lg:py-16">
        <div className="space-y-8">
          <Card className="card-surface">
            <CardContent className="p-6 sm:p-8">
              <p className="eyebrow text-primary">About the business</p>
              <h2 className="mt-3 text-2xl font-bold">What to expect</h2>
              <p className="mt-4 leading-7 text-muted-foreground">{profile.about}</p>
            </CardContent>
          </Card>

          <section aria-labelledby="services-heading">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-primary">Services</p>
                <h2 id="services-heading" className="mt-3 text-3xl font-bold">
                  Published service guide
                </h2>
              </div>
            </div>
            {profile.services.length ? (
              <div className="mt-5 divide-y rounded-2xl border bg-card shadow-soft">
                {profile.services.map((service) => (
                  <div
                    key={service.id}
                    className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6"
                  >
                    <div>
                      <h3 className="font-bold">{service.name}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{service.note}</p>
                    </div>
                    <p className="font-display text-lg font-bold text-primary">{service.price}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                This business has not published a service list yet. Ask for a written quote before
                paying.
              </div>
            )}
          </section>

          <EnquiryForm profile={profile} />
          <ReviewForm profile={profile} />
        </div>

        <aside className="space-y-5">
          <Card className="card-surface">
            <CardContent className="space-y-4 p-6 text-sm">
              <p className="eyebrow text-primary">Location</p>
              <p className="leading-6">{profile.address}</p>
              {profile.source === "live" ? (
                <Button asChild variant="outline" className="w-full">
                  <a
                    href={directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackContact(profile, "directions")}
                  >
                    <Navigation /> Get directions
                  </a>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card className="card-surface">
            <CardContent className="space-y-4 p-6 text-sm">
              <p className="eyebrow text-primary">Verification, explained</p>
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
                <p className="leading-6 text-muted-foreground">
                  A badge shows which checks GainHub completed. It is not a guarantee of service,
                  pricing or outcome.
                </p>
              </div>
              <Separator />
              <div className="flex items-center gap-2 font-semibold">
                <BadgeCheck className="size-4 text-primary" /> Current level: {profile.verified}
              </div>
              <Link
                to="/trust-safety"
                className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
              >
                How verification works <ArrowRight className="size-3.5" />
              </Link>
            </CardContent>
          </Card>

          {profile.source === "live" ? (
            <Card className="card-surface">
              <CardContent className="space-y-3 p-6 text-sm">
                <p className="font-bold">Own this business?</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/claim" search={{ business: profile.id }}>
                    Claim this listing
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full text-destructive">
                  <Link to="/report" search={{ type: "business", target: profile.id }}>
                    <Flag /> Report a concern
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : null}

          {safeWebsite(profile.website) && profile.source === "live" ? (
            <a
              href={safeWebsite(profile.website) ?? undefined}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="flex items-center gap-3 rounded-2xl border p-4 text-sm font-semibold transition-colors hover:bg-secondary"
            >
              <Globe className="size-4 text-primary" /> Visit business website{" "}
              <ExternalLink className="ml-auto size-3.5" />
            </a>
          ) : null}
        </aside>
      </div>

      {previewBusiness ? (
        <section className="border-t bg-muted/50 py-16">
          <div className="mx-auto max-w-7xl px-5">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-primary">More product previews</p>
                <h2 className="mt-3 text-3xl font-bold">Explore other profile shapes</h2>
              </div>
            </div>
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {related.map((business) => (
                <BusinessCard key={business.id} business={business} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </PublicShell>
  );
}
