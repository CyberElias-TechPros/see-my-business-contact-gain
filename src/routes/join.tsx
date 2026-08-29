import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, ChevronLeft, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { PublicShell, PageHead } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCreateBusiness, useMeta, useMe, useSignIn, useSignUp } from "@/lib/queries";

export const Route = createFileRoute("/join")({
  validateSearch: (search: Record<string, unknown>): { category?: string } => ({
    category: typeof search["category"] === "string" ? search["category"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "List your business free — GainHub NG onboarding" },
      {
        name: "description",
        content:
          "Create a full business profile in minutes: category, address, hours, services, products, photos and a WhatsApp contact button.",
      },
    ],
  }),
  component: JoinPage,
});

const STEPS = [
  "Account",
  "Business basics",
  "Category & location",
  "Contact channels",
  "Review & publish",
];

function JoinPage() {
  const { category } = Route.useSearch();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const { data: meta } = useMeta();
  const signUp = useSignUp();
  const signIn = useSignIn();
  const create = useCreateBusiness();

  const [step, setStep] = useState(me ? 1 : 0);
  const [name, setName] = useState("");
  const [tagline, setTagline] = useState("");
  const [about, setAbout] = useState("");
  const [categorySlug, setCategorySlug] = useState(category ?? "");
  const [city, setCity] = useState("Ikeja");
  const [stateName, setStateName] = useState("Lagos");
  const [address, setAddress] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [qr, setQr] = useState(true);
  const [autoAck, setAutoAck] = useState(true);
  const [quoteForm, setQuoteForm] = useState(false);

  const selectedLocation = meta?.locations.find(
    (l) => l.name === stateName || l.name.startsWith(stateName),
  );

  const finish = () => {
    create.mutate(
      {
        name,
        tagline,
        about,
        categorySlug: categorySlug || meta?.categories[0]?.slug || "home-services",
        city,
        state: stateName,
        address,
        whatsapp,
        phone: phone || whatsapp,
        website: website || undefined,
      },
      {
        onSuccess: ({ id }) => {
          toast.success("Your business is live! Complete your profile to attract more customers.");
          void navigate({ to: "/app" });
        },
      },
    );
  };

  const stepContent = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-4">
            <Badge variant="secondary">Step 1 of 5 — Account</Badge>
            {me ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Signed in as <span className="font-medium text-foreground">{me.name}</span> —
                  continue to your business basics.
                </p>
                <Button onClick={() => setStep(1)}>Continue</Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  First, create your free account (or{" "}
                  <Link to="/auth" className="text-primary">
                    sign in
                  </Link>{" "}
                  if you already have one). Your account email is your workspace login.
                </p>
                <Button asChild>
                  <Link to="/auth" search={{ redirect: "/join" }}>
                    Create your account
                  </Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                  We only use your email for sign-in and account notices — never for spam.
                </p>
              </div>
            )}
          </div>
        );
      case 1:
        return (
          <div className="space-y-4">
            <Badge variant="secondary">Step 2 of 5 — Business basics</Badge>
            <div>
              <Label htmlFor="join-name">Business name</Label>
              <Input
                id="join-name"
                className="mt-2"
                placeholder="SwiftFix Gadgets"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="join-tagline">Tagline</Label>
              <Input
                id="join-tagline"
                className="mt-2"
                placeholder="Phone & laptop repair in 45 minutes"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="join-about">About your business</Label>
              <Textarea
                id="join-about"
                className="mt-2"
                placeholder="What you do, who you serve, and how fast you respond"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              />
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <Badge variant="secondary">Step 3 of 5 — Category & location</Badge>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Category</Label>
                <Select value={categorySlug || undefined} onValueChange={setCategorySlug}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Pick a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {(meta?.categories ?? []).map((c) => (
                      <SelectItem key={c.slug} value={c.slug}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>State / city</Label>
                <Select
                  value={selectedLocation?.slug ?? "lagos"}
                  onValueChange={(slug) => {
                    const loc = meta?.locations.find((l) => l.slug === slug);
                    if (loc) {
                      setStateName(loc.name.replace(" (FCT)", ""));
                      setCity(loc.areas[0] ?? loc.name);
                    }
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(meta?.locations ?? []).map((l) => (
                      <SelectItem key={l.slug} value={l.slug}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>City / area</Label>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedLocation?.areas ?? [stateName]).map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="join-address">Street address</Label>
                <Input
                  id="join-address"
                  className="mt-2"
                  placeholder="12 Adekunle Close"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <Badge variant="secondary">Step 4 of 5 — Contact channels</Badge>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="join-wa">WhatsApp number</Label>
                <Input
                  id="join-wa"
                  required
                  className="mt-2"
                  placeholder="0803 000 0000"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Include country code if possible, e.g. +234…
                </p>
              </div>
              <div>
                <Label htmlFor="join-phone">
                  Phone number <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="join-phone"
                  className="mt-2"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="join-web">
                  Website <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="join-web"
                  className="mt-2"
                  placeholder="www.yourbusiness.ng"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2 rounded-xl border p-4">
              <p className="text-sm font-medium">Lead capture</p>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={qr} onCheckedChange={(v) => setQr(v === true)} /> Generate a
                click-to-WhatsApp link and QR code
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={autoAck} onCheckedChange={(v) => setAutoAck(v === true)} /> Send
                an automatic acknowledgement to new enquiries
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={quoteForm} onCheckedChange={(v) => setQuoteForm(v === true)} />{" "}
                Show a quote request form on my profile
              </label>
            </div>
          </div>
        );
      default:
        return (
          <div className="space-y-4">
            <Badge variant="secondary">Step 5 of 5 — Review & publish</Badge>
            <div className="space-y-2 rounded-xl border p-4 text-sm">
              <p>
                <span className="font-medium">{name || "Your business"}</span> —{" "}
                {tagline || "no tagline yet"}
              </p>
              <p className="text-muted-foreground">
                {meta?.categories.find((c) => c.slug === categorySlug)?.name ?? "No category"} •{" "}
                {city}, {stateName}
              </p>
              <p className="text-muted-foreground">WhatsApp: {whatsapp || "not set"}</p>
              {website ? <p className="text-muted-foreground">Website: {website}</p> : null}
            </div>
            <p className="text-xs text-muted-foreground">
              You can edit everything later from your workspace. Verification (badge) comes after
              you upload documents.
            </p>
          </div>
        );
    }
  };

  const canProceed =
    step === 1
      ? name.trim().length >= 2
      : step === 3
        ? whatsapp.trim().length >= 7
        : step === 2
          ? Boolean(categorySlug)
          : true;

  return (
    <PublicShell>
      <PageHead
        eyebrow="Onboarding"
        title="List your business"
        subtitle="Five short steps. Publish now, polish later — your profile can evolve as you grow."
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 lg:grid-cols-[240px_1fr]">
        <aside className="card-surface h-fit p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Progress</p>
          <Progress value={((step + 1) / STEPS.length) * 100} className="mt-3 h-2" />
          <ol className="mt-4 space-y-2 text-sm">
            {STEPS.map((s, i) => (
              <li
                key={s}
                className={`flex items-center gap-2 ${i <= step ? "text-primary" : "text-muted-foreground"}`}
              >
                {i < step ? (
                  <Check className="size-4" />
                ) : (
                  <span className="grid size-4 place-items-center text-xs">{i + 1}</span>
                )}
                {s}
              </li>
            ))}
          </ol>
        </aside>
        <Card className="card-surface">
          <CardContent className="grid gap-5 p-6">
            {stepContent()}
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={step === 0}
                onClick={() => setStep((s) => Math.max(0, s - 1))}
              >
                <ChevronLeft className="size-4" /> Back
              </Button>
              {step < STEPS.length - 1 ? (
                <Button
                  className="flex-1"
                  disabled={!canProceed}
                  onClick={() => setStep((s) => s + 1)}
                >
                  Save and continue
                </Button>
              ) : (
                <Button
                  className="flex-1"
                  disabled={create.isPending || !name || !whatsapp}
                  onClick={finish}
                >
                  {create.isPending ? "Publishing…" : "Publish my business"}
                </Button>
              )}
            </div>
            {step === STEPS.length - 1 ? (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-primary" /> Publishing is free. Upgrade to
                Growth or Pro later for analytics and promotion.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
