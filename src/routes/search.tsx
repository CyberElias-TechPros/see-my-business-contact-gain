import { createFileRoute, Link } from "@tanstack/react-router";
import { LayoutGrid, Map, SlidersHorizontal } from "lucide-react";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { BusinessCard } from "@/components/kit";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { businesses, categories, locations } from "@/data/mock";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Nigerian businesses — GainHub NG Directory" },
      {
        name: "description",
        content:
          "Search verified businesses by category, city, rating and opening hours. Filter, compare and start a WhatsApp chat in one tap.",
      },
      { property: "og:title", content: "Search Nigerian businesses — GainHub NG" },
      {
        property: "og:description",
        content: "Filter by category, location, verification and rating, then chat on WhatsApp.",
      },
    ],
  }),
  component: SearchPage,
});

function Filters() {
  return (
    <div className="space-y-6">
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Keyword</Label>
        <Input placeholder="e.g. iPhone screen" className="mt-2" />
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">Location</Label>
        <Select defaultValue="lagos">
          <SelectTrigger className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {locations.map((l) => (
              <SelectItem key={l.slug} value={l.slug}>
                {l.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Separator />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
        <div className="mt-3 space-y-2">
          {categories.slice(0, 6).map((c) => (
            <label key={c.slug} className="flex items-center gap-2 text-sm">
              <Checkbox /> {c.name}
            </label>
          ))}
        </div>
      </div>
      <Separator />
      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Quick filters</p>
        {[
          "Open now",
          "Verified only",
          "Offers delivery",
          "Accepts card",
          "Home service",
          "Near me",
        ].map((f) => (
          <label key={f} className="flex items-center gap-2 text-sm">
            <Checkbox /> {f}
          </label>
        ))}
      </div>
      <Separator />
      <div>
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Minimum rating</p>
        <Slider defaultValue={[4]} min={1} max={5} step={0.5} className="mt-4" />
      </div>
      <Button className="w-full">Apply filters</Button>
      <Button variant="ghost" className="w-full">
        Reset
      </Button>
    </div>
  );
}

function SearchPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Directory"
        title="Search businesses"
        subtitle="58,412 listings across 36 states. Results are ranked by relevance, responsiveness and verification level."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link to="/compare">Compare selected</Link>
            </Button>
            <Button asChild>
              <Link to="/join">List your business</Link>
            </Button>
          </div>
        }
      />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 lg:grid-cols-[260px_1fr]">
        <aside className="card-surface h-fit p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <SlidersHorizontal className="size-4" /> Filters
          </div>
          <Filters />
        </aside>
        <div>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">12</span> of 4,820 results
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Select defaultValue="relevance">
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">Sort: Relevance</SelectItem>
                  <SelectItem value="rating">Sort: Highest rated</SelectItem>
                  <SelectItem value="response">Sort: Fastest response</SelectItem>
                  <SelectItem value="nearest">Sort: Nearest to me</SelectItem>
                </SelectContent>
              </Select>
              <Tabs defaultValue="grid">
                <TabsList>
                  <TabsTrigger value="grid" className="gap-1">
                    <LayoutGrid className="size-3.5" /> Grid
                  </TabsTrigger>
                  <TabsTrigger value="map" className="gap-1">
                    <Map className="size-3.5" /> Map
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
          <div className="mb-6 flex flex-wrap gap-2">
            {["Lagos", "Open now", "Verified", "4.0+"].map((t) => (
              <Badge key={t} variant="secondary">
                {t} ×
              </Badge>
            ))}
          </div>
          <Card className="card-surface mb-6 overflow-hidden">
            <div className="grid h-48 place-items-center bg-hero-mesh text-sm text-muted-foreground">
              Map view — 12 pins in this area
            </div>
          </Card>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {businesses.map((b) => (
              <BusinessCard key={b.id} business={b} />
            ))}
          </div>
          <Card className="card-surface mt-8">
            <CardContent className="flex items-center justify-between p-4 text-sm">
              <Button variant="outline" size="sm">
                Previous
              </Button>
              <span className="text-muted-foreground">Page 1 of 402</span>
              <Button variant="outline" size="sm">
                Next
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
