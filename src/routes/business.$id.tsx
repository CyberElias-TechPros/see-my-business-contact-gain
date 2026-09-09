import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  Bookmark,
  Check,
  Clock,
  Flag,
  Globe,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Smartphone,
  Star,
} from "lucide-react";
import { useEffect, useState } from "react";
import { PublicShell } from "@/components/site/PublicShell";
import { BusinessCard, Stars, VerifiedBadge } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiFailure, apiFetch } from "@/lib/api-client.ts";
import {
  listingQuery,
  listingReviewsQuery,
  similarQuery,
  toCardBusiness,
  type ListingDto,
  type ListingPayload,
  type ReviewPage,
  type SimilarPage,
} from "@/lib/queries.ts";
import { formatNaira, waLink } from "../../shared/domain.ts";

type LoaderData = {
  payload: ListingPayload;
  reviews: ReviewPage;
  similar: SimilarPage;
};

/**
 * The listing page is the product, so it obeys three rules the prototype did not:
 *
 * 1. An unknown or unpublished slug is a real HTTP 404. `getBusiness(id) ?? businesses[0]` used
 *    to serve a *different* business under a valid-looking URL, which is the worst failure a
 *    directory can have: it pollutes the index and it lies to the customer.
 * 2. Every photo, hour, price, count and review is read from the API. Where the listing has no
 *    value, the page says so in words instead of showing a stock image or a made-up number.
 * 3. Contact actions are real: `tel:`, `wa.me`, Google Maps, and POSTs that create an enquiry, a
 *    review or a save — each with the API's own validation errors rendered per field.
 */
export const Route = createFileRoute("/business/$id")({
  // `head`'s parameter is annotated by hand: `head` and `loader` are mutually recursive generics,
  // and leaving either to inference collapses `useLoaderData()` to `unknown`/`undefined` for the
  // whole file (see also routes/search.tsx and the note in docs/FRONTEND.md).
  head: ({ params, loaderData }: { params: { id: string }; loaderData?: unknown }) => {
    const data = loaderData as LoaderData | undefined;
    const business = data?.payload.business;
    const title = business
      ? `${business.name} — ${business.categoryName} in ${business.city} | GainHub NG`
      : "Listing not found | GainHub NG";
    const description = business
      ? `${business.tagline}. ${business.city}${business.area ? ` (${business.area})` : ""}, ${business.state}. Photos, prices, opening hours, ${business.ratingCount} review${business.ratingCount === 1 ? "" : "s"} and WhatsApp contact.`
      : "This listing is not available.";
    const cover = business?.media.find((item) => item.kind === "cover") ?? business?.media[0];
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "profile" },
        { property: "og:site_name", content: "GainHub NG" },
        {
          property: "og:title",
          content: business
            ? `${business.name} — ${business.categoryName} in ${business.city}`
            : title,
        },
        { property: "og:description", content: description },
        // og:image only when a *moderated, approved* photo exists: a placeholder or a hotlinked
        // guess teaches crawlers to distrust this domain's previews.
        ...(cover ? [{ property: "og:image", content: cover.url }] : []),
        { property: "og:url", content: `/business/${business?.slug ?? params.id}` },
        { name: "twitter:card", content: cover ? "summary_large_image" : "summary" },
        // Deliberately no `nosnippet`: review text is what earns the click from a search result.
        { name: "robots", content: "index,follow,max-snippet:-1,max-image-preview:large" },
      ],
      links: [{ rel: "canonical", href: `/business/${business?.slug ?? params.id}` }],
      scripts: business
        ? [{ type: "application/ld+json" as const, children: structuredData(business) }]
        : [],
    };
  },
  loader: async ({ context, params }): Promise<LoaderData> => {
    try {
      const [payload, reviews, similar] = await Promise.all([
        context.queryClient.ensureQueryData(listingQuery(params.id)),
        context.queryClient.ensureQueryData(listingReviewsQuery(params.id, 1)),
        context.queryClient.ensureQueryData(similarQuery(params.id)),
      ]);
      return { payload, reviews, similar };
    } catch (error) {
      // The server helper already set the HTTP status; converting it to the router's not-found
      // path is what makes Start keep 404 instead of 200-with-soft-404-copy.
      if (error instanceof Error && error.name === "NotFoundError") throw notFound();
      throw error;
    }
  },
  component: BusinessProfile,
});

/** The absolute host for JSON-LD `url`/`sameAs` fields (search results need absolute URLs). */
const SITE_ORIGIN = "https://gainhub.ng";

/** Tab labels carry the real counts, so a tab never promises "Reviews (12)" over four reviews. */
function tabsFor(business: ListingDto): { value: string; label: string }[] {
  const count = (name: string, total: number): string => (total > 0 ? `${name} (${total})` : name);
  return [
    { value: "overview", label: "Overview" },
    { value: "services", label: count("Services", business.services.length) },
    { value: "products", label: count("Products", business.products.length) },
    { value: "gallery", label: count("Photos", business.media.length) },
    { value: "reviews", label: count("Reviews", business.ratingCount) },
    { value: "hours", label: "Hours" },
    { value: "team", label: count("Team", business.team.length) },
    { value: "enquire", label: "Enquire" },
  ];
}

function structuredData(business: ListingDto): string {
  const graph: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: business.name,
    description: business.tagline,
    url: `${SITE_ORIGIN}/business/${business.slug}`,
    address: {
      "@type": "PostalAddress",
      streetAddress: business.address ?? undefined,
      addressLocality: business.city,
      addressRegion: business.state,
      addressCountry: "NG",
    },
    areaServed: business.serviceAreas.map((name) => ({ "@type": "Place", name })),
    sameAs: [business.website, ...business.socials.map((social) => social.url)].filter(
      (value): value is string => typeof value === "string" && value.length > 0,
    ),
  };
  if (business.phone) graph["telephone"] = business.phone;
  if (business.logoMediaId) graph["logo"] = `${SITE_ORIGIN}${mediaPath(business.logoMediaId)}`;
  const cover = business.media.find((item) => item.kind === "cover");
  if (cover) graph["image"] = cover.url;
  // Google ignores aggregateRating without real reviews, so it is only emitted when there are any.
  if (business.ratingCount > 0) {
    graph["aggregateRating"] = {
      "@type": "AggregateRating",
      ratingValue: business.ratingAvg,
      reviewCount: business.ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }
  const open = business.hours.filter((day) => !day.closed && day.opens && day.closes);
  if (open.length > 0) {
    graph["openingHoursSpecification"] = open.map((day) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: day.label,
      opens: day.opens,
      closes: day.closes,
    }));
  }
  if (business.services.length > 0) {
    graph["hasOfferCatalog"] = {
      "@type": "OfferCatalog",
      name: `${business.categoryName} services`,
      itemListElement: business.services.map((service) => ({
        "@type": "Offer",
        itemOffered: {
          "@type": "Service",
          name: service.name,
          ...(service.note ? { description: service.note } : {}),
        },
        ...(service.priceMinor
          ? { price: (service.priceMinor / 100).toFixed(2), priceCurrency: "NGN" }
          : {}),
      })),
    };
  }
  return JSON.stringify(graph);
}

function mediaPath(mediaId: string): string {
  return `/media/${mediaId}`;
}

function BusinessProfile() {
  const { payload, reviews, similar } = Route.useLoaderData();
  const business = payload.business;
  const [tab, setTab] = useState("overview");
  const [prefill, setPrefill] = useState("");
  const [copied, setCopied] = useState(false);
  const queryClient = useQueryClient();
  // The server-rendered `savedByViewer` is a snapshot; the mutation's result is the truth from the
  // moment the visitor clicks, and it survives a re-render without a refetch loop.
  const [savedOverride, setSavedOverride] = useState<boolean | null>(null);
  const saved = savedOverride ?? business.savedByViewer;

  const save = useMutation({
    mutationFn: (shouldSave: boolean) =>
      apiFetch(`/api/v1/businesses/${business.id}/save`, {
        method: shouldSave ? "POST" : "DELETE",
      }),
    onSuccess: (_result, shouldSave) => {
      setSavedOverride(shouldSave);
      void queryClient.invalidateQueries({ queryKey: ["listing", business.slug] });
      void queryClient.invalidateQueries({ queryKey: ["listing", business.id] });
      void queryClient.invalidateQueries({ queryKey: ["my-saves"] });
    },
  });

  const saveError = save.error instanceof ApiFailure ? save.error : null;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(timer);
  }, [copied]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: business.name, text: business.tagline, url });
        return;
      } catch {
        /* the visitor dismissed the share sheet — fall through to the clipboard */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard permission (or an insecure origin): selecting the address bar is the
      // fallback a person can actually do, so we do not pretend a copy happened.
      window.prompt("Copy this link", url);
    }
  };

  const whatsapp = business.whatsapp
    ? waLink(business.whatsapp, `Hello ${business.name}, I found you on GainHub NG.`)
    : null;
  const cover = business.media.find((item) => item.kind === "cover") ?? business.media[0];
  const logo = business.media.find((item) => item.kind === "logo");

  const askAbout = (text: string) => {
    setPrefill(text);
    setTab("enquire");
  };

  return (
    <PublicShell>
      <div className={cover ? "h-56 w-full overflow-hidden bg-secondary md:h-72" : undefined}>
        {cover ? (
          <img
            src={cover.url}
            alt={cover.alt || `${business.name} — cover photo`}
            className="h-full w-full object-cover"
          />
        ) : (
          // No approved photo: a deterministic pattern derived from the slug, never stock art.
          <div
            className={`h-56 w-full md:h-72 ${toCardBusiness(business).cover}`}
            role="img"
            aria-label={`${business.name} has no photo yet`}
          />
        )}
      </div>

      <div className="mx-auto max-w-7xl px-4">
        <nav aria-label="Breadcrumb" className="pt-4 text-xs text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-1">
            <li>
              <Link to="/" className="hover:text-foreground">
                Home
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link
                to="/category/$slug"
                params={{ slug: business.categorySlug }}
                className="hover:text-foreground"
              >
                {business.categoryName}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>{business.city}</li>
            <li aria-hidden="true">/</li>
            <li aria-current="page" className="text-foreground">
              {business.name}
            </li>
          </ol>
        </nav>

        <div className="-mt-12 flex flex-col gap-5 md:-mt-16 md:flex-row md:items-end">
          <div className="grid size-28 place-items-center overflow-hidden rounded-3xl border-4 border-background bg-secondary font-display text-3xl font-bold">
            {logo ? (
              <img
                src={logo.url}
                alt={`${business.name} logo`}
                className="size-full object-cover"
              />
            ) : (
              <span aria-hidden="true">{initials(business.name)}</span>
            )}
          </div>

          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold">{business.name}</h1>
              <VerifiedBadge level={business.verifiedLevel} />
              {business.openNow ? (
                <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
                  <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" /> Open now
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <Clock className="size-3" aria-hidden="true" /> Closed right now
                </Badge>
              )}
            </div>
            <p className="mt-2 text-muted-foreground">{business.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              <span className="flex items-center gap-2">
                <Stars rating={business.ratingAvg} />
                <span>
                  {business.ratingCount > 0
                    ? `${business.ratingAvg.toFixed(1)} from ${business.ratingCount} review${business.ratingCount === 1 ? "" : "s"}`
                    : "No reviews yet"}
                </span>
              </span>
              <Link
                to="/search"
                search={{ category: business.categorySlug }}
                className="hover:text-foreground"
              >
                <Badge variant="secondary">{business.categoryName}</Badge>
              </Link>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {business.area ? `${business.area}, ` : ""}
                {business.city}, {business.state}
              </span>
              <span>
                {business.responseMinutes !== null
                  ? `Usually replies in about ${humanMinutes(business.responseMinutes)}`
                  : "No response-time record yet"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 pb-1">
            {whatsapp ? (
              <Button size="lg" className="gap-2" asChild>
                <a href={whatsapp} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="size-4" aria-hidden="true" /> Chat on WhatsApp
                </a>
              </Button>
            ) : (
              <Button
                size="lg"
                className="gap-2"
                onClick={() => askAbout(`Hello ${business.name}, I would like to ask about…`)}
              >
                <MessageCircle className="size-4" aria-hidden="true" /> Send an enquiry
              </Button>
            )}
            {business.phone ? (
              <Button size="lg" variant="outline" className="gap-2" asChild>
                <a href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}>
                  <Phone className="size-4" aria-hidden="true" /> Call
                </a>
              </Button>
            ) : null}
            <Button
              size="icon"
              variant="outline"
              aria-label={saved ? "Remove from your saved businesses" : "Save this business"}
              aria-pressed={saved}
              disabled={save.isPending}
              onClick={() => save.mutate(!saved)}
            >
              {saved ? (
                <Check className="size-4 text-primary" aria-hidden="true" />
              ) : (
                <Bookmark className="size-4" aria-hidden="true" />
              )}
            </Button>
            <Button
              size="icon"
              variant="outline"
              aria-label="Copy the link to this listing"
              onClick={share}
            >
              <Share2 className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div aria-live="polite" className="mt-2 min-h-5 space-y-1">
          {save.isPending ? <p className="text-sm text-muted-foreground">Saving…</p> : null}
          {saveError ? (
            <p className="text-sm">
              {saveError.status === 401 ? (
                <>
                  <Link
                    to="/auth"
                    search={{ next: `/business/${business.slug}` }}
                    className="font-medium text-primary hover:underline"
                  >
                    Sign in
                  </Link>{" "}
                  to save {business.name} and keep its number in one place.
                </>
              ) : (
                <span className="text-destructive">{saveError.message}</span>
              )}
            </p>
          ) : null}
          {copied ? <p className="text-sm text-primary">Link copied to your clipboard.</p> : null}
        </div>

        <div className="mt-10 grid gap-8 pb-16 lg:grid-cols-[1fr_320px]">
          <div>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="flex-wrap">
                {tabsFor(business).map((entry) => (
                  <TabsTrigger key={entry.value} value={entry.value}>
                    {entry.label}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-6">
                <Card className="card-surface">
                  <CardContent className="space-y-4 p-6">
                    <h2 className="text-lg font-semibold">About {business.name}</h2>
                    <p className="text-sm whitespace-pre-line text-muted-foreground">
                      {business.about ||
                        "The owner has not written an about section for this listing yet."}
                    </p>
                    <Separator />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          What they publish
                        </p>
                        {business.amenities.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {business.amenities.map((amenity) => (
                              <Badge key={amenity} variant="outline">
                                {amenity}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            Nothing recorded yet.
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Service areas
                        </p>
                        {business.serviceAreas.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {business.serviceAreas.map((area) => (
                              <Link
                                key={area}
                                to="/search"
                                search={{ q: area, location: locationSlug(business.state) }}
                              >
                                <Badge variant="outline" className="hover:border-primary/40">
                                  {area}
                                </Badge>
                              </Link>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-muted-foreground">
                            They have not listed areas beyond {business.city}.
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {business.address ? (
                  <Card className="card-surface">
                    <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                      <p className="text-sm">
                        <MapPin className="mr-1 inline size-4 text-primary" aria-hidden="true" />
                        {business.address}
                      </p>
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            `${business.name} ${business.address}`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                        >
                          Open in Google Maps
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-5 text-sm text-muted-foreground">
                      No street address published — many traders here agree on a meeting point in
                      the WhatsApp chat instead.
                    </CardContent>
                  </Card>
                )}

                {reviews.items.length > 0 ? (
                  // Radix only renders the active panel, so the review text that earns long-tail
                  // search traffic is repeated here — in the crawlable overview — rather than
                  // hidden behind a click. The Reviews tab keeps the full list and the histogram.
                  <Card className="card-surface">
                    <CardContent className="space-y-3 p-6">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-semibold">What customers said</h2>
                        <button
                          type="button"
                          onClick={() => setTab("reviews")}
                          className="text-sm font-medium text-primary hover:underline"
                        >
                          Read all {business.ratingCount} reviews
                        </button>
                      </div>
                      <ul className="space-y-3" role="list">
                        {reviews.items.slice(0, 2).map((review) => (
                          <li key={review.id} className="rounded-xl border p-4">
                            <p className="text-sm font-medium">
                              {review.author}
                              <span className="ml-2 text-xs font-normal text-muted-foreground">
                                {review.rating}★ · {shortDate(review.createdAt)}
                              </span>
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">“{review.body}”</p>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ) : null}
              </TabsContent>

              <TabsContent value="services" className="pt-6">
                {business.services.length === 0 ? (
                  <EmptyNote text="No services published yet. Ask for a quote — prices usually arrive in the chat." />
                ) : (
                  <Card className="card-surface">
                    <CardContent className="divide-y p-0">
                      {business.services.map((service) => (
                        <div
                          key={service.id}
                          className="flex items-center justify-between gap-4 p-5"
                        >
                          <div className="min-w-0">
                            <p className="font-medium">{service.name}</p>
                            {service.note ? (
                              <p className="text-sm text-muted-foreground">{service.note}</p>
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="font-semibold">
                              {service.priceMinor
                                ? `${formatNaira(service.priceMinor)} onwards`
                                : formatNaira(null)}
                            </p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => askAbout(`I would like a quote for: ${service.name}`)}
                            >
                              Request this
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="products" className="pt-6">
                {business.products.length === 0 ? (
                  <EmptyNote text="No products published yet." />
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-3" role="list">
                    {business.products.map((product) => (
                      <li key={product.id}>
                        <Card className="card-surface overflow-hidden">
                          <CardContent className="p-4">
                            {product.tag ? <Badge variant="secondary">{product.tag}</Badge> : null}
                            <p className="mt-2 font-medium">{product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatNaira(product.priceMinor)}
                            </p>
                            <Button
                              size="sm"
                              className="mt-3 w-full gap-1"
                              onClick={() => askAbout(`Is ${product.name} available?`)}
                            >
                              <MessageCircle className="size-3.5" aria-hidden="true" /> Ask about it
                            </Button>
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="gallery" className="pt-6">
                {business.media.length === 0 ? (
                  <EmptyNote text="No approved photos on this listing yet. Owners upload them in the workspace; they appear here once moderation clears them." />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-3" role="list">
                    {business.media.map((item) => (
                      <li key={item.id} className="overflow-hidden rounded-xl border">
                        <img
                          src={item.url}
                          alt={item.alt || `${business.name} — ${item.kind.replace(/-/g, " ")}`}
                          loading="lazy"
                          decoding="async"
                          className="h-32 w-full bg-muted object-cover"
                        />
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {item.label ?? item.kind.replace(/-/g, " ")}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="space-y-4 pt-6">
                <ReviewSummary business={business} />
                {reviews.items.length === 0 ? (
                  <EmptyNote text="No published review yet — yours could be the first." />
                ) : (
                  <ul className="space-y-4" role="list">
                    {reviews.items.map((review) => (
                      <li key={review.id}>
                        <Card className="card-surface">
                          <CardContent className="p-5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <span
                                  className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold"
                                  aria-hidden="true"
                                >
                                  {initials(review.author)}
                                </span>
                                <div>
                                  <p className="font-medium">{review.author}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {longDate(review.createdAt)}
                                  </p>
                                </div>
                              </div>
                              <span
                                className="flex items-center gap-0.5"
                                aria-label={`${review.rating} out of 5 stars`}
                              >
                                {Array.from({ length: 5 }).map((_, index) => (
                                  <Star
                                    key={index}
                                    className={
                                      index < review.rating
                                        ? "size-3.5 fill-accent text-accent"
                                        : "size-3.5 text-muted"
                                    }
                                    aria-hidden="true"
                                  />
                                ))}
                              </span>
                            </div>
                            <p className="mt-3 text-sm text-muted-foreground">{review.body}</p>
                            {review.ownerReply ? (
                              <div className="mt-3 rounded-xl border-l-2 border-primary/40 bg-secondary/40 p-3">
                                <p className="text-xs font-medium">
                                  {business.name} replied
                                  {review.ownerReplyAt
                                    ? ` · ${shortDate(review.ownerReplyAt)}`
                                    : ""}
                                </p>
                                <p className="mt-1 text-sm">{review.ownerReply}</p>
                              </div>
                            ) : null}
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
                <ReviewForm
                  businessId={business.id}
                  slug={business.slug}
                  ratingCount={business.ratingCount}
                />
                {reviews.meta.totalPages > 1 ? (
                  <p className="text-sm text-muted-foreground">
                    {reviews.meta.total} published reviews — the {reviews.items.length} most recent
                    are shown first.
                  </p>
                ) : null}
              </TabsContent>

              <TabsContent value="hours" className="pt-6">
                {business.hours.length === 0 ? (
                  <EmptyNote text="No opening hours published, so “open now” cannot be calculated for this listing." />
                ) : (
                  <Card className="card-surface">
                    <CardContent className="divide-y p-0">
                      {business.hours.map((day) => (
                        <div
                          key={day.dayOfWeek}
                          className="flex items-center justify-between p-4 text-sm"
                        >
                          <span className="font-medium">{day.label}</span>
                          <span className="text-muted-foreground">
                            {day.closed || !day.opens || !day.closes
                              ? "Closed"
                              : `${day.opens} – ${day.closes}`}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
                <p className="mt-3 text-xs text-muted-foreground">
                  “Open now” is calculated in West Africa Time from these hours; the owner edits
                  them from the workspace.
                </p>
              </TabsContent>

              <TabsContent value="team" className="pt-6">
                {business.team.length === 0 ? (
                  <EmptyNote text="This listing has no named team members." />
                ) : (
                  <ul className="grid gap-4 sm:grid-cols-2" role="list">
                    {business.team.map((member) => (
                      <li key={member.id}>
                        <Card className="card-surface">
                          <CardContent className="flex items-center gap-3 p-5">
                            <span
                              className="grid size-11 place-items-center rounded-full bg-secondary font-semibold"
                              aria-hidden="true"
                            >
                              {initials(member.name)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-medium">{member.name}</p>
                              <p className="text-sm text-muted-foreground capitalize">
                                {member.role.replace(/_/g, " ")}
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )}
              </TabsContent>

              <TabsContent value="enquire" className="pt-6">
                {/* Remounting on a new prefill resets the form state instead of syncing it in an
                    effect, which would leave a stale "sent" panel over a fresh message. */}
                <EnquiryForm key={prefill} business={business} prefill={prefill} />
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <Card className="card-surface">
              <CardContent className="space-y-3 p-5 text-sm">
                <p className="font-semibold">Contact</p>
                {business.whatsapp ? (
                  <a
                    href={whatsapp ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    <MessageCircle className="size-4 text-primary" aria-hidden="true" />
                    <span className="min-w-0 truncate">{business.whatsapp}</span>
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground">WhatsApp</span>
                  </a>
                ) : (
                  <p className="text-muted-foreground">No WhatsApp number published.</p>
                )}
                {business.phone ? (
                  <a
                    href={`tel:${business.phone.replace(/[^+\d]/g, "")}`}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    <Phone className="size-4 text-primary" aria-hidden="true" /> {business.phone}
                  </a>
                ) : null}
                {business.website ? (
                  <a
                    href={business.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    <Globe className="size-4 shrink-0 text-primary" aria-hidden="true" />
                    <span className="truncate">{hostOf(business.website)}</span>
                  </a>
                ) : null}
                {business.socials.length > 0 ? (
                  <>
                    <Separator />
                    <ul className="space-y-2" role="list">
                      {business.socials.map((social) => (
                        <li key={social.url}>
                          <a
                            href={social.url}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="flex items-center justify-between gap-2 text-muted-foreground hover:text-foreground"
                          >
                            <span className="flex items-center gap-2">
                              {socialIcon(social.label)}
                              {social.label}
                            </span>
                            <span className="truncate">{social.handle}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
              </CardContent>
            </Card>

            <Card className="card-surface">
              <CardContent className="space-y-2 p-5 text-sm">
                <p className="font-semibold">Activity on this listing</p>
                <p className="text-muted-foreground">
                  {business.contactsGained.toLocaleString("en-NG")} contact
                  {business.contactsGained === 1 ? "" : "s"} gained through GainHub
                </p>
                <p className="text-muted-foreground">
                  Saved by {business.savedCount.toLocaleString("en-NG")}{" "}
                  {business.savedCount === 1 ? "person" : "people"}
                </p>
                {business.publishedAt ? (
                  <p className="text-muted-foreground">Joined {monthYear(business.publishedAt)}</p>
                ) : null}
                <p className="text-muted-foreground">Listing plan: {planLabel(business.plan)}</p>
              </CardContent>
            </Card>

            <Card className="card-surface">
              <CardContent className="space-y-2 p-5 text-sm">
                <p className="font-semibold">Is this your business?</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/claim" search={{ slug: business.slug }}>
                    Claim this listing
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full gap-2 text-destructive">
                  <Link to="/report" search={{ targetType: "business", targetId: business.id }}>
                    <Flag className="size-3.5" aria-hidden="true" /> Report a problem
                  </Link>
                </Button>
                {payload.viewer.canManage ? (
                  <Button asChild size="sm" variant="secondary" className="w-full">
                    <Link to="/app/profile">Edit in workspace</Link>
                  </Button>
                ) : null}
              </CardContent>
            </Card>
          </aside>
        </div>

        {similar.items.length > 0 ? (
          <section className="pb-20" aria-labelledby="similar">
            <h2 id="similar" className="text-2xl font-bold">
              Similar {business.categoryName.toLowerCase()} listings
            </h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {similar.items.map((item) => (
                <BusinessCard key={item.id} business={toCardBusiness(item)} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </PublicShell>
  );
}

function ReviewSummary({ business }: { business: ListingDto }) {
  if (business.ratingCount === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-5 text-sm text-muted-foreground">
          No review has been published for {business.name} yet. A review appears once the reviewer’s
          account is confirmed and it has not been flagged.
        </CardContent>
      </Card>
    );
  }
  const total = business.ratingCount;
  return (
    <Card className="card-surface">
      <CardContent className="flex flex-wrap items-center gap-6 p-5">
        <div>
          <p className="font-display text-3xl font-bold">{business.ratingAvg.toFixed(1)}</p>
          <Stars rating={business.ratingAvg} />
          <p className="mt-1 text-xs text-muted-foreground">
            {total} published {total === 1 ? "review" : "reviews"}
          </p>
        </div>
        <ul className="min-w-40 flex-1 space-y-1" role="list">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = Number(business.claims.byStar[String(star)] ?? 0);
            const share = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li key={star} className="flex items-center gap-2 text-xs">
                <span className="w-6 tabular-nums text-muted-foreground">{star}★</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
                  <span className="block h-full bg-accent" style={{ width: `${share}%` }} />
                </span>
                <span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

function ReviewForm({
  businessId,
  slug,
  ratingCount,
}: {
  businessId: string;
  slug: string;
  ratingCount: number;
}) {
  const [state, setState] = useState<
    { status: "idle" | "sending" } | { status: "done" | "error"; message: string }
  >({ status: "idle" });
  const [rating, setRating] = useState(5);
  const queryClient = useQueryClient();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form).get("body");
    setState({ status: "sending" });
    try {
      await apiFetch(`/api/v1/businesses/${businessId}/reviews`, {
        method: "POST",
        body: { rating, body: typeof body === "string" ? body : "" },
      });
      setState({ status: "done", message: "Thanks — your review is published." });
      form.reset();
      void queryClient.invalidateQueries({ queryKey: ["listing-reviews", slug] });
      void queryClient.invalidateQueries({ queryKey: ["listing-reviews", businessId] });
      void queryClient.invalidateQueries({ queryKey: ["listing", slug] });
    } catch (error) {
      const failure = error instanceof ApiFailure ? error : null;
      setState({
        status: "error",
        message:
          failure?.status === 401
            ? "Sign in to leave a review."
            : (failure?.message ?? "We could not publish that review. Try again in a moment."),
      });
    }
  };

  return (
    <Card className="card-surface">
      <CardContent className="space-y-3 p-5">
        <p className="font-medium">Write a review</p>
        <p className="text-xs text-muted-foreground">
          One review per account per business
          {ratingCount > 0 ? ` (this listing has ${ratingCount})` : ""}, and the owner’s reply stays
          attached to it. Twenty characters minimum, so “nice job” alone will not submit.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <fieldset>
            <legend className="text-sm font-medium">Your rating</legend>
            <div className="mt-2 flex gap-1">
              {[1, 2, 3, 4, 5].map((value) => (
                <label
                  key={value}
                  className="cursor-pointer rounded focus-within:ring-2 focus-within:ring-ring"
                >
                  <input
                    type="radio"
                    name="stars"
                    value={value}
                    className="sr-only"
                    checked={rating === value}
                    onChange={() => setRating(value)}
                  />
                  <Star
                    className={
                      value <= rating
                        ? "size-6 fill-accent text-accent"
                        : "size-6 text-muted hover:text-accent"
                    }
                    aria-hidden="true"
                  />
                  <span className="sr-only">
                    {value} star{value === 1 ? "" : "s"}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <Label htmlFor="review-body">What happened?</Label>
            <Textarea
              id="review-body"
              name="body"
              rows={4}
              required
              minLength={20}
              maxLength={2000}
              placeholder="Was the price what they quoted? Did it finish when they said it would?"
            />
          </div>
          <Button type="submit" disabled={state.status === "sending"}>
            {state.status === "sending" ? "Publishing…" : "Publish review"}
          </Button>
        </form>
        {state.status === "done" || state.status === "error" ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={
              state.status === "error" ? "text-sm text-destructive" : "text-sm text-primary"
            }
          >
            {state.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

type EnquiryState =
  | { status: "idle" | "sending" }
  | { status: "sent"; reference: string | null; whatsappUrl: string | null }
  | { status: "error"; message: string; fields: Record<string, string> };

function EnquiryForm({ business, prefill }: { business: ListingDto; prefill: string }) {
  const [state, setState] = useState<EnquiryState>({ status: "idle" });

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const object = Object.fromEntries(new FormData(form).entries());
    setState({ status: "sending" });
    try {
      const result = await apiFetch<{
        ok: boolean;
        enquiryId?: string;
        lead?: { code?: string };
        whatsappUrl?: string | null;
      }>(`/api/v1/businesses/${business.id}/enquiries`, {
        method: "POST",
        body: {
          businessId: business.id,
          name: String(object["name"] ?? ""),
          phone: String(object["phone"] ?? ""),
          ...(object["email"] ? { email: String(object["email"]) } : {}),
          need: String(object["need"] ?? ""),
          ...(object["serviceId"] ? { serviceId: String(object["serviceId"]) } : {}),
          // Kept in the form so a bot that fills it lands here; a real visitor never sees the field.
          honeypot: String(object["fax"] ?? ""),
          source: "directory_profile",
        },
      });
      form.reset();
      setState({
        status: "sent",
        reference: result?.lead?.code ?? null,
        whatsappUrl: result?.whatsappUrl ?? null,
      });
    } catch (error) {
      const failure = error instanceof ApiFailure ? error : null;
      setState({
        status: "error",
        message: failure?.message ?? "We could not send that enquiry. Try again in a moment.",
        fields: failure?.formErrors ?? {},
      });
    }
  };

  if (state.status === "sent") {
    return (
      <Card className="card-surface border-primary/40">
        <CardContent className="space-y-3 p-6">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Check className="size-5 text-primary" aria-hidden="true" /> Enquiry sent to{" "}
            {business.name}
          </h2>
          <p className="text-sm text-muted-foreground">
            It is in their workspace inbox as a lead
            {state.reference ? (
              <>
                {" "}
                with reference <code className="rounded bg-secondary px-1">{state.reference}</code>
              </>
            ) : null}
            . They can reply on the number you gave, and this listing stays in your saves so you can
            come back to it.
          </p>
          {state.whatsappUrl ? (
            <Button asChild className="gap-2">
              <a href={state.whatsappUrl} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" /> Continue on WhatsApp
              </a>
            </Button>
          ) : null}
        </CardContent>
      </Card>
    );
  }

  const error = state.status === "error" ? state : null;

  return (
    <Card className="card-surface" id="enquire">
      <CardContent className="space-y-4 p-6">
        <div>
          <h2 className="font-semibold">Request a quote</h2>
          <p className="text-sm text-muted-foreground">
            This creates a lead in {business.name}’s workspace with the source “Directory profile”,
            so they know where you found them. Nothing is forwarded to a third party.
          </p>
        </div>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="enq-name">Your name</Label>
            <Input
              id="enq-name"
              name="name"
              className="mt-2"
              required
              maxLength={120}
              autoComplete="name"
              placeholder="Blessing Eze"
            />
            {error?.fields["name"] ? <FieldError text={error.fields["name"]!} /> : null}
          </div>
          <div>
            <Label htmlFor="enq-phone">WhatsApp number</Label>
            <Input
              id="enq-phone"
              name="phone"
              className="mt-2"
              required
              inputMode="tel"
              autoComplete="tel"
              placeholder="0803 000 0000"
            />
            <p className="mt-1 text-xs text-muted-foreground">They will message you here.</p>
            {error?.fields["phone"] ? <FieldError text={error.fields["phone"]!} /> : null}
          </div>
          <div>
            <Label htmlFor="enq-email">Email (optional)</Label>
            <Input
              id="enq-email"
              name="email"
              type="email"
              className="mt-2"
              autoComplete="email"
              placeholder="you@example.com"
            />
            {error?.fields["email"] ? <FieldError text={error.fields["email"]!} /> : null}
          </div>
          <div>
            <Label htmlFor="enq-service">About which service? (optional)</Label>
            <select
              id="enq-service"
              name="serviceId"
              defaultValue=""
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">No specific service</option>
              {business.services.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name}
                  {service.priceMinor ? ` — ${formatNaira(service.priceMinor)}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="enq-need">What do you need?</Label>
            <Textarea
              id="enq-need"
              name="need"
              className="mt-2"
              rows={4}
              required
              minLength={10}
              maxLength={2000}
              defaultValue={prefill}
              placeholder="Describe the job, your budget and the date you want it done."
            />
            {error?.fields["need"] ? <FieldError text={error.fields["need"]!} /> : null}
          </div>
          <div className="hidden" aria-hidden="true">
            <Label htmlFor="enq-fax">Fax number</Label>
            <Input id="enq-fax" name="fax" tabIndex={-1} autoComplete="off" defaultValue="" />
          </div>
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <Button type="submit" disabled={state.status === "sending"}>
              {state.status === "sending" ? "Sending…" : "Send enquiry"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Sending shares your name, number and message with this business only.
            </p>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive sm:col-span-2">
              {error.message}
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

function FieldError({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {text}
    </p>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-5 text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}

function socialIcon(label: string) {
  const className = "size-3.5";
  if (label === "Instagram") return <Instagram className={className} aria-hidden="true" />;
  if (label === "Email") return <Mail className={className} aria-hidden="true" />;
  if (label === "TikTok" || label === "X" || label === "Facebook") {
    return <Smartphone className={className} aria-hidden="true" />;
  }
  return <Globe className={className} aria-hidden="true" />;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] ?? url;
  }
}

function humanMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  return hours < 24
    ? `${hours.toFixed(hours < 10 ? 1 : 0)} hours`
    : `${Math.round(hours / 24)} days`;
}

function planLabel(plan: ListingDto["plan"]): string {
  return plan === "pro" ? "Pro" : plan === "growth" ? "Growth" : "Free";
}

/** Dates are rendered server-side in the visitor's own locale/timezone-independent form. */
function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function monthYear(iso: string): string {
  return new Date(iso).toLocaleDateString("en-NG", { month: "long", year: "numeric" });
}

function locationSlug(state: string): string {
  const cleaned = state
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-|-$/g, "");
  if (cleaned === "abuja" || cleaned === "fct") return "abuja";
  if (cleaned === "rivers") return "port-harcourt";
  if (cleaned === "oyo") return "ibadan";
  return cleaned;
}
