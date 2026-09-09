import { createFileRoute, Link } from "@tanstack/react-router";
import {
  BadgeCheck,
  Bookmark,
  Clock,
  Flag,
  Globe,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  Star,
} from "lucide-react";
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
import { businesses, getBusiness, reviews } from "@/data/mock";

export const Route = createFileRoute("/business/$id")({
  head: ({ params }) => {
    const b = getBusiness(params.id);
    return {
      meta: [
        { title: `${b.name} — ${b.category} in ${b.city} | GainHub NG` },
        {
          name: "description",
          content: `${b.tagline}. ${b.name} in ${b.city}, ${b.state}. Photos, prices, opening hours, reviews and WhatsApp contact.`,
        },
        { property: "og:title", content: `${b.name} — ${b.category} in ${b.city}` },
        { property: "og:description", content: b.tagline },
      ],
    };
  },
  component: BusinessProfile,
});

function BusinessProfile() {
  const { id } = Route.useParams();
  const b = getBusiness(id);

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
              <span>{b.reviews} reviews</span>
              <Badge variant="secondary">{b.category}</Badge>
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" /> {b.city}, {b.state}
              </span>
              <span className={`flex items-center gap-1 ${b.openNow ? "text-primary" : ""}`}>
                <Clock className="size-3.5" /> {b.openNow ? "Open now" : "Closed"}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pb-1">
            <Button size="lg" className="gap-2">
              <MessageCircle className="size-4" /> Chat on WhatsApp
            </Button>
            <Button size="lg" variant="outline" className="gap-2">
              <Phone className="size-4" /> Call
            </Button>
            <Button size="icon" variant="outline" aria-label="Save business">
              <Bookmark className="size-4" />
            </Button>
            <Button size="icon" variant="outline" aria-label="Share profile">
              <Share2 className="size-4" />
            </Button>
          </div>
        </div>

        <div className="mt-10 grid gap-8 pb-16 lg:grid-cols-[1fr_320px]">
          <div>
            <Tabs defaultValue="overview">
              <TabsList className="flex-wrap">
                {[
                  "overview",
                  "services",
                  "products",
                  "gallery",
                  "reviews",
                  "hours",
                  "team",
                  "enquire",
                ].map((t) => (
                  <TabsTrigger key={t} value={t} className="capitalize">
                    {t}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-4 pt-6">
                <Card className="card-surface">
                  <CardContent className="space-y-4 p-6">
                    <h2 className="text-lg font-semibold">About {b.name}</h2>
                    <p className="text-sm text-muted-foreground">{b.about}</p>
                    <Separator />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Amenities
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {b.amenities.map((a) => (
                            <Badge key={a} variant="outline">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          Service areas
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {b.serviceAreas.map((a) => (
                            <Badge key={a} variant="outline">
                              {a}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="card-surface overflow-hidden">
                  <div className="grid h-52 place-items-center bg-hero-mesh text-sm text-muted-foreground">
                    Map — {b.address}
                  </div>
                  <CardContent className="flex items-center justify-between p-4">
                    <p className="text-sm">{b.address}</p>
                    <Button variant="outline" size="sm">
                      Get directions
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="services" className="pt-6">
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
                          <Button size="sm" variant="ghost">
                            Request
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="products" className="pt-6">
                <div className="grid gap-4 sm:grid-cols-3">
                  {b.products.map((p) => (
                    <Card key={p.name} className="card-surface overflow-hidden">
                      <div className="h-32 bg-hero-mesh" />
                      <CardContent className="p-4">
                        <Badge variant="secondary">{p.tag}</Badge>
                        <p className="mt-2 font-medium">{p.name}</p>
                        <p className="text-sm text-muted-foreground">{p.price}</p>
                        <Button size="sm" className="mt-3 w-full gap-1">
                          <MessageCircle className="size-3.5" /> Ask price
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="gallery" className="pt-6">
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
              </TabsContent>

              <TabsContent value="reviews" className="space-y-4 pt-6">
                {reviews.map((r) => (
                  <Card key={r.author} className="card-surface">
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
                      <p className="mt-2 text-xs text-muted-foreground">{r.when}</p>
                    </CardContent>
                  </Card>
                ))}
                <Card className="card-surface">
                  <CardContent className="space-y-3 p-5">
                    <p className="font-medium">Write a review</p>
                    <Textarea placeholder="Share your experience with this business…" />
                    <Button>Submit review</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="hours" className="pt-6">
                <Card className="card-surface">
                  <CardContent className="divide-y p-0">
                    {b.hours.map((h) => (
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

              <TabsContent value="enquire" className="pt-6">
                <Card className="card-surface">
                  <CardContent className="grid gap-4 p-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <p className="font-semibold">Request a quote</p>
                      <p className="text-sm text-muted-foreground">
                        This form creates a lead in the business workspace with source “Directory
                        profile”.
                      </p>
                    </div>
                    <div>
                      <Label>Your name</Label>
                      <Input className="mt-2" placeholder="Blessing Eze" />
                    </div>
                    <div>
                      <Label>WhatsApp number</Label>
                      <Input className="mt-2" placeholder="0803 000 0000" />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>What do you need?</Label>
                      <Textarea
                        className="mt-2"
                        placeholder="Describe the job, budget and preferred date"
                      />
                    </div>
                    <Button className="sm:col-span-2">Send enquiry</Button>
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
                  <Phone className="size-4 text-primary" /> {b.phone}
                </p>
                <p className="flex items-center gap-2">
                  <Globe className="size-4 text-primary" /> {b.website}
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
                <p className="text-muted-foreground">Saved by {b.savedBy} people</p>
                <p className="text-muted-foreground">Typically replies in 5 minutes</p>
                <p className="text-muted-foreground">Plan: {b.plan}</p>
              </CardContent>
            </Card>
            <Card className="card-surface">
              <CardContent className="space-y-2 p-5 text-sm">
                <p className="font-semibold">Is this your business?</p>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/claim">Claim this listing</Link>
                </Button>
                <Button asChild variant="ghost" className="w-full gap-2 text-destructive">
                  <Link to="/report">
                    <Flag className="size-3.5" /> Report a problem
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </aside>
        </div>

        <section className="pb-20">
          <h2 className="text-2xl font-bold">Similar businesses</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {businesses
              .filter((x) => x.id !== b.id)
              .slice(0, 4)
              .map((x) => (
                <BusinessCard key={x.id} business={x} />
              ))}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
