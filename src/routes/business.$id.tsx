import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Clock, Flag, Globe, MapPin, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { PublicShell } from "@/components/site/PublicShell";
import {
  BusinessCard,
  EmptyState,
  LoadError,
  LoadingCard,
  Stars,
  VerifiedBadge,
} from "@/components/kit";
import { CallButton, SaveButton, ShareButton, WhatsAppButton } from "@/components/actions";
import { QRCodeSVG } from "qrcode.react";
import { Download, IdCard, QrCode } from "lucide-react";
import { downloadBusinessVCard } from "@/lib/vcard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { timeAgo } from "@/lib/api";
import { useBusiness, useBusinesses, useMe, usePostEnquiry, usePostReview } from "@/lib/queries";
import { peekBusiness } from "@/data/mock";

export const Route = createFileRoute("/business/$id")({
  head: ({ params }) => {
    const b = peekBusiness(params.id);
    const name = b?.name ?? "Business profile";
    return {
      meta: [
        { title: `${name} — GainHub NG` },
        {
          name: "description",
          content: b
            ? `${b.tagline}. ${b.name} in ${b.city}, ${b.state}. Photos, prices, opening hours, reviews and WhatsApp contact.`
            : `Find this business on GainHub NG — photos, prices, opening hours, reviews and WhatsApp contact.`,
        },
        { property: "og:title", content: `${name} — GainHub NG` },
        {
          property: "og:description",
          content: b?.tagline ?? "WhatsApp-first Nigerian business directory.",
        },
      ],
    };
  },
  component: BusinessProfile,
});

function BusinessProfile() {
  const { id } = Route.useParams();
  const query = useBusiness(id);
  const { data: me } = useMe();
  const enquiry = usePostEnquiry(id);
  const review = usePostReview(id);
  const similar = useBusinesses({ category: query.data?.business.categorySlug, pageSize: 4 });

  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [message, setMessage] = useState("");
  const [service, setService] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [qrOpen, setQrOpen] = useState(false);

  if (query.isLoading) {
    return (
      <PublicShell>
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-16">
          <LoadingCard label="Loading profile…" />
        </div>
      </PublicShell>
    );
  }

  if (query.isError) {
    const notFoundError = (query.error as { notFound?: boolean }).notFound === true;
    if (notFoundError) throw notFound();
    return (
      <PublicShell>
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-16">
          <LoadError message={(query.error as Error)?.message} retry={() => void query.refetch()} />
        </div>
      </PublicShell>
    );
  }

  const { business: b, reviews, saved } = query.data!;
  const shownSimilar = (similar.data?.items ?? []).filter((x) => x.id !== b.id).slice(0, 4);

  const submitEnquiry = (e: React.FormEvent) => {
    e.preventDefault();
    enquiry.mutate(
      { name, whatsapp, message, service },
      {
        onSuccess: () => {
          toast.success("Enquiry sent — the business will reply on WhatsApp.");
          setName("");
          setWhatsapp("");
          setMessage("");
          setService("");
        },
      },
    );
  };

  return (
    <PublicShell>
      <div className={`h-56 ${b.cover} md:h-72`} />
      <div className="mx-auto max-w-7xl px-4">
        <div className="-mt-16 flex flex-col gap-5 md:flex-row md:items-end">
          <div className="grid size-28 place-items-center rounded-3xl border-4 border-background bg-secondary font-display text-3xl font-bold">
            {b.name.slice(0, 2)}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">{b.name}</h1>
              <VerifiedBadge level={b.verified} />
            </div>
            <p className="mt-2 text-muted-foreground">{b.tagline}</p>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <Stars rating={b.rating} />
              <button
                className="hover:text-foreground"
                onClick={() => document.getElementById("tab-reviews")?.click()}
              >
                {b.reviewsCount} reviews
              </button>
              <Badge variant="secondary">{b.categoryName ?? b.categorySlug}</Badge>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {b.city}, {b.state}
              </span>
              <span className={`flex items-center gap-1 ${b.openNow ? "text-primary" : ""}`}>
                <Clock className="size-3.5" /> {b.openNow ? "Open now" : "Closed"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pb-1">
            <WhatsAppButton business={b} source="Profile — header" size="lg" />
            <CallButton business={b} size="lg" />
            <SaveButton business={b} saved={saved} />
            <ShareButton business={b} />
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                downloadBusinessVCard(b);
                toast.success("Contact card downloaded — open it to save the business");
              }}
            >
              <IdCard className="size-4" /> Save contact
            </Button>
            <Button variant="outline" size="lg" onClick={() => setQrOpen(true)}>
              <QrCode className="size-4" /> QR code
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-8 pb-16 lg:grid-cols-[1fr_320px]">
          <div>
            <Tabs defaultValue="overview">
              <TabsList className="flex-wrap">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="services">Services</TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="gallery">Gallery</TabsTrigger>
                <TabsTrigger value="reviews" id="tab-reviews">
                  Reviews
                </TabsTrigger>
                <TabsTrigger value="hours">Hours</TabsTrigger>
                {b.team.length ? <TabsTrigger value="team">Team</TabsTrigger> : null}
                <TabsTrigger value="enquire" id="tab-enquire">
                  Enquire
                </TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-6">
                <Card className="card-surface">
                  <CardContent className="p-6">
                    <p className="text-muted-foreground">{b.about}</p>
                    {b.amenities.length ? (
                      <>
                        <Separator className="my-4" />
                        <div className="flex flex-wrap gap-2">
                          {b.amenities.map((a) => (
                            <Badge key={a} variant="outline" className="bg-card">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      </>
                    ) : null}
                  </CardContent>
                </Card>
                <Card className="card-surface overflow-hidden">
                  <div className="grid h-52 place-items-center bg-hero-mesh text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <MapPin className="size-4" /> {b.address}
                    </span>
                  </div>
                  <CardContent className="flex items-center justify-between p-4">
                    <p className="text-sm">{b.address}</p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        window.open(
                          `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(b.address)}`,
                          "_blank",
                          "noopener",
                        )
                      }
                    >
                      Get directions
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services" className="pt-6">
                {b.services.length === 0 ? (
                  <EmptyState
                    title="No services published yet"
                    body="This business hasn't added its service list. Ask on WhatsApp for a quote."
                  />
                ) : (
                  <Card className="card-surface">
                    <CardContent className="divide-y p-0">
                      {b.services.map((s) => (
                        <div key={s.name} className="flex items-center justify-between gap-4 p-5">
                          <div>
                            <p className="font-medium">{s.name}</p>
                            <p className="text-sm text-muted-foreground">{s.note}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{s.price}</p>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setService(s.name);
                                document.getElementById("tab-enquire")?.click();
                              }}
                            >
                              Request
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="products" className="pt-6">
                {b.products.length === 0 ? (
                  <EmptyState
                    title="No products listed yet"
                    body="Ask this business on WhatsApp for their catalogue."
                  />
                ) : (
                  <div className="grid gap-4 sm:grid-cols-3">
                    {b.products.map((p) => (
                      <Card key={p.name} className="card-surface overflow-hidden">
                        <div className="h-32 bg-hero-mesh" />
                        <CardContent className="p-4">
                          <Badge variant="secondary">{p.tag}</Badge>
                          <p className="mt-2 font-medium">{p.name}</p>
                          <p className="text-sm text-muted-foreground">{p.price}</p>
                          <WhatsAppButton
                            business={b}
                            source={`Product — ${p.name}`}
                            label="Ask price"
                            size="sm"
                            className="mt-3 w-full"
                            message={`Hi ${b.name}! I'm interested in your ${p.name} (${p.price}). I found it on GainHub NG.`}
                          />
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="gallery" className="pt-6">
                {b.gallery.length === 0 ? (
                  <EmptyState title="No photos yet" />
                ) : (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {b.gallery.map((g) => (
                      <div key={g.label} className="overflow-hidden rounded-xl border">
                        <div className="grid h-32 place-items-center bg-hero-mesh text-xs text-muted-foreground">
                          {g.label}
                        </div>
                        <p className="px-3 py-2 text-xs text-muted-foreground">{g.kind}</p>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reviews" className="space-y-4 pt-6">
                {reviews.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No reviews yet — be the first to share your experience.
                  </p>
                ) : (
                  reviews.map((r) => (
                    <Card key={r.id} className="card-surface">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <p className="font-medium">{r.author}</p>
                          <span className="flex items-center gap-1 text-sm">
                            {Array.from({ length: r.rating }).map((_, i) => (
                              <Star key={i} className="size-3.5 fill-accent text-accent" />
                            ))}
                          </span>
                        </div>
                        <p className="mt-2 text-sm text-muted-foreground">{r.body}</p>
                        <p className="mt-2 text-xs text-muted-foreground">{timeAgo(r.ts)}</p>
                        {r.reply ? (
                          <div className="mt-3 rounded-lg border-l-2 border-primary bg-muted/60 px-4 py-3">
                            <p className="text-xs font-semibold">Reply from {b.name}</p>
                            <p className="mt-1 text-sm text-muted-foreground">{r.reply}</p>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  ))
                )}
                <Card className="card-surface">
                  <CardContent className="space-y-3 p-5">
                    <p className="font-medium">Write a review</p>
                    {me ? (
                      <form
                        className="space-y-3"
                        onSubmit={(e) => {
                          e.preventDefault();
                          review.mutate(
                            { author: me.name, rating: reviewRating, body: reviewBody },
                            { onSuccess: () => setReviewBody("") },
                          );
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <button
                              key={i}
                              type="button"
                              aria-label={`${i + 1} star${i ? "s" : ""}`}
                              onClick={() => setReviewRating(i + 1)}
                            >
                              <Star
                                className={`size-6 ${i < reviewRating ? "fill-accent text-accent" : "text-muted-foreground"}`}
                              />
                            </button>
                          ))}
                        </div>
                        <Textarea
                          required
                          minLength={10}
                          value={reviewBody}
                          onChange={(e) => setReviewBody(e.target.value)}
                          placeholder="Share your experience with this business…"
                        />
                        <Button type="submit" disabled={review.isPending}>
                          {review.isPending ? "Publishing…" : "Submit review"}
                        </Button>
                      </form>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">Sign in to leave a review.</p>
                        <Button asChild size="sm" variant="outline">
                          <Link to="/auth" search={{ redirect: `/business/${b.id}` }}>
                            Sign in
                          </Link>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hours" className="pt-6">
                <Card className="card-surface">
                  <CardContent className="divide-y p-0">
                    {(b.hours ?? []).map((h) => (
                      <div key={h.day} className="flex justify-between p-4 text-sm">
                        <span>{h.day}</span>
                        <span className="text-muted-foreground">{h.open}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="team" className="pt-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  {b.team.map((t) => (
                    <Card key={t.name} className="card-surface">
                      <CardContent className="flex items-center gap-3 p-5">
                        <span className="grid size-11 place-items-center rounded-full bg-secondary font-semibold">
                          {t.name.slice(0, 1)}
                        </span>
                        <div>
                          <p className="font-medium">{t.name}</p>
                          <p className="text-sm text-muted-foreground">{t.role}</p>
                        </div>
                        <Badge variant="outline" className="ml-auto gap-1">
                          <BadgeCheck className="size-3" /> Professional
                        </Badge>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="enquire" className="pt-6" id="tab-enquire-content">
                <Card className="card-surface">
                  <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <p className="font-semibold">Request a quote</p>
                      <p className="text-sm text-muted-foreground">
                        This creates a lead in the business workspace with source “Directory
                        profile”.
                      </p>
                    </div>
                    <form
                      id="enquire-form"
                      className="grid gap-4 sm:col-span-2 sm:grid-cols-2"
                      onSubmit={submitEnquiry}
                    >
                      <div>
                        <Label htmlFor="enq-name">Your name</Label>
                        <Input
                          id="enq-name"
                          required
                          className="mt-2"
                          placeholder="Blessing Eze"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="enq-wa">WhatsApp number</Label>
                        <Input
                          id="enq-wa"
                          required
                          className="mt-2"
                          placeholder="0803 000 0000"
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                        />
                      </div>
                      {service ? (
                        <div className="sm:col-span-2">
                          <Label>Service requested</Label>
                          <Input
                            className="mt-2"
                            value={service}
                            onChange={(e) => setService(e.target.value)}
                          />
                        </div>
                      ) : null}
                      <div className="sm:col-span-2">
                        <Label htmlFor="enq-msg">What do you need?</Label>
                        <Textarea
                          id="enq-msg"
                          className="mt-2"
                          placeholder="Describe the job, budget and preferred date"
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                      </div>
                      <Button type="submit" className="sm:col-span-2" disabled={enquiry.isPending}>
                        {enquiry.isPending ? "Sending…" : "Send enquiry"}
                      </Button>
                    </form>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          <aside className="space-y-4">
            <Card className="card-surface">
              <CardContent className="space-y-3 p-5 text-sm">
                <p className="font-semibold">Contact</p>
                <p className="flex items-center gap-2">
                  <MessageCircle className="size-4 text-primary" /> {b.whatsapp}
                </p>
                <p className="flex items-center gap-2">
                  <Globe className="size-4 text-primary" />{" "}
                  {b.website ? (
                    <a
                      href={b.website.startsWith("http") ? b.website : `https://${b.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-primary hover:underline"
                    >
                      {b.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    "No website yet"
                  )}
                </p>
                <Separator />
                {b.socials.map((s) => (
                  <p key={s.label} className="flex justify-between text-muted-foreground">
                    <span>{s.label}</span>
                    <span>{s.handle}</span>
                  </p>
                ))}
              </CardContent>
            </Card>
            <Card className="card-surface">
              <CardContent className="space-y-2 p-5 text-sm">
                <p className="font-semibold">Trust signals</p>
                <p className="text-muted-foreground">
                  Contacts gained: {b.contactsGained.toLocaleString()}
                </p>
                <p className="text-muted-foreground">
                  Saved by {b.savedBy.toLocaleString()} people
                </p>
                <p className="text-muted-foreground">
                  Typically replies in ~{b.responseMinutes} minutes
                </p>
                <p className="text-muted-foreground">Plan: {b.plan}</p>
              </CardContent>
            </Card>
            <Card className="card-surface">
              <CardContent className="space-y-2 p-5 text-sm">
                <p className="font-semibold">Is this your business?</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/claim" search={{ business: b.id }}>
                    Claim this listing
                  </Link>
                </Button>
                <Button asChild variant="ghost" className="w-full gap-2 text-destructive">
                  <Link to="/report" search={{ business: b.name }}>
                    <Flag className="size-3.5" /> Report a problem
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>

        {shownSimilar.length ? (
          <section className="pb-20">
            <h2 className="text-2xl font-bold">Similar businesses</h2>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {shownSimilar.map((x) => (
                <BusinessCard key={x.id} business={x} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
      {/* Business profile QR — scannable print asset for shop fronts & flyers */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{b.name} — QR code</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="qr-holder rounded-2xl border bg-white p-4">
              <QRCodeSVG
                value={
                  typeof window !== "undefined"
                    ? `${window.location.origin}/business/${b.id}`
                    : `/business/${b.id}`
                }
                size={192}
              />
            </div>
            <p className="text-center text-sm text-muted-foreground">
              Print this on your shop window, receipts or flyers — one scan opens your full profile
              where customers can chat with you on WhatsApp.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                const svg = document.querySelector<HTMLCanvasElement | SVGSVGElement>(
                  "[data-qr] svg",
                );
                const el = document.querySelector<SVGSVGElement>(".qr-holder svg");
                const source = el ?? svg;
                if (!source) return;
                const xml = new XMLSerializer().serializeToString(source);
                const blob = new Blob([xml], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `${b.id}-qr.svg`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success("QR downloaded (SVG — ready to print)");
              }}
            >
              <Download className="size-4" /> Download QR
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </PublicShell>
  );
}
