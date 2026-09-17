import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, Clock3, MapPin, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Magnetic, Spotlight, Tilt } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PublicBusiness } from "@/lib/contracts";
import { businessIdentity } from "@/lib/identity";
import { cn } from "@/lib/utils";

/* -------------------------------------------------------------------------- */
/* Generative identity                                                        */
/* -------------------------------------------------------------------------- */

export function BusinessMark({
  name,
  id,
  className = "",
}: {
  name: string;
  id: string;
  className?: string;
}) {
  const { hue, initials } = businessIdentity(id);
  const fallback = name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("");

  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-2xl font-display font-extrabold text-white shadow-soft",
        className,
      )}
      style={{
        background: `linear-gradient(140deg, oklch(0.62 0.16 ${hue}), oklch(0.42 0.13 ${hue}))`,
      }}
    >
      {fallback || initials}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Badges                                                                     */
/* -------------------------------------------------------------------------- */

const VERIFICATION_COPY: Record<
  PublicBusiness["verificationLevel"],
  { label: string; className: string }
> = {
  unverified: {
    label: "Unverified",
    className: "border-border/70 bg-muted/60 text-muted-foreground",
  },
  email: {
    label: "Email checked",
    className: "border-primary/25 bg-primary/10 text-primary",
  },
  phone: {
    label: "Phone checked",
    className: "border-primary/30 bg-primary/12 text-primary",
  },
  documents: {
    label: "Documents checked",
    className: "border-primary/40 bg-primary/16 text-primary",
  },
  premium: {
    label: "Premium verified",
    className: "border-accent/45 bg-accent/18 text-accent-foreground",
  },
};

export function VerifiedBadge({
  level,
  compact = false,
}: {
  level: PublicBusiness["verificationLevel"];
  compact?: boolean;
}) {
  const copy = VERIFICATION_COPY[level];
  return (
    <Badge
      variant="outline"
      className={cn("gap-1 font-semibold", copy.className)}
      title="A review of the evidence supplied to GainHub — not a guarantee of service quality."
    >
      {level !== "unverified" ? <BadgeCheck className="size-3" aria-hidden="true" /> : null}
      {compact ? copy.label.split(" ")[0] : copy.label}
    </Badge>
  );
}

export function Stars({
  rating,
  count,
  className = "",
}: {
  rating: number;
  count?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("flex items-center gap-1 text-sm", className)}
      aria-label={`${rating.toFixed(1)} out of 5 stars${count === undefined ? "" : ` from ${count} reviews`}`}
    >
      <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
      <span className="font-bold tabular-nums">{rating.toFixed(1)}</span>
      {count === undefined ? null : (
        <span className="text-xs font-medium text-muted-foreground tabular-nums">({count})</span>
      )}
    </span>
  );
}

export function OpenNowPill({ open, hours }: { open: boolean; hours?: PublicBusiness["hours"] }) {
  const today = new Date().getDay();
  const todayHours = hours?.find((entry) => entry.dayOfWeek === today);
  const detail = !todayHours
    ? "Hours not published"
    : todayHours.isClosed
      ? "Closed today"
      : `${todayHours.opensAt} – ${todayHours.closesAt}`;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold",
        open ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
      )}
      title={detail}
    >
      <span
        className={cn("size-1.5 rounded-full", open ? "bg-primary" : "bg-muted-foreground/50")}
        aria-hidden="true"
      />
      {open ? "Open now" : "Closed now"}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Business card                                                              */
/* -------------------------------------------------------------------------- */

export function BusinessCard({
  business,
  priority = false,
}: {
  business: PublicBusiness;
  priority?: boolean;
}) {
  const { hue, hue2 } = businessIdentity(business.id);

  return (
    <Tilt max={5} className="h-full">
      <Spotlight className="h-full">
        <Card
          className={cn(
            "group relative flex h-full flex-col overflow-hidden rounded-3xl border-border/70",
            "transition-[transform,box-shadow,border-color] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
            "hover:-translate-y-1.5 hover:border-primary/30 hover:shadow-lift",
            "focus-within:border-primary/40",
          )}
        >
          {/* Generative cover */}
          <div
            className="cover-generative relative h-32 shrink-0"
            style={
              {
                "--cover-hue": String(hue),
                "--cover-hue-2": String(hue2),
              } as React.CSSProperties
            }
          >
            <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
            <div className="absolute right-4 top-4 flex gap-1.5">
              {business.priceRange ? (
                <span className="rounded-full border border-white/20 bg-black/35 px-2.5 py-1 text-[0.68rem] font-bold text-white backdrop-blur-sm">
                  {business.priceRange}
                </span>
              ) : null}
            </div>
          </div>

          <CardContent className="relative -mt-8 flex flex-1 flex-col gap-4 p-5 pt-0">
            <BusinessMark
              name={business.name}
              id={business.id}
              className="size-14 border-4 border-card text-lg"
            />

            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold leading-tight">
                  {/* Stretched link: the whole card is the target, but the accessible
                      name stays the business name. */}
                  <Link
                    to="/business/$id"
                    params={{ id: business.slug }}
                    className="after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none"
                  >
                    {business.name}
                  </Link>
                </h3>
                {business.reviewCount > 0 ? (
                  <Stars rating={business.rating} count={business.reviewCount} />
                ) : (
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">New</span>
                )}
              </div>
              <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
                {business.tagline}
              </p>
            </div>

            <div className="mt-auto space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                  {business.city}, {business.state}
                </span>
                <span className="flex items-center gap-1">
                  <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />
                  {business.openNow ? "Open now" : "Closed"}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3.5">
                <VerifiedBadge level={business.verificationLevel} />
                <span
                  className="flex items-center gap-1 text-xs font-bold text-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100"
                  aria-hidden="true"
                >
                  View <ArrowUpRight className="size-3.5" />
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Spotlight>
    </Tilt>
  );
}

/* -------------------------------------------------------------------------- */
/* Layout helpers                                                             */
/* -------------------------------------------------------------------------- */

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("rounded-2xl border-border/70", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-border/60 pb-3.5">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/70 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 font-display text-3xl font-extrabold tabular-nums">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid min-h-80 place-items-center rounded-3xl border border-dashed border-border/70 bg-muted/25 p-10 text-center">
      <div className="max-w-md">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
          {icon}
        </span>
        <h3 className="mt-5 font-display text-2xl font-bold">{title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{body}</p>
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}

export function PrimaryCta({
  children,
  to,
  href,
  ...props
}: { children: ReactNode; to?: string; href?: string } & Record<string, unknown>) {
  const inner = (
    <Button size="lg" className="px-7" asChild={Boolean(to || href)} {...(props as object)}>
      {to ? <Link to={to}>{children}</Link> : href ? <a href={href}>{children}</a> : children}
    </Button>
  );
  return <Magnetic>{inner}</Magnetic>;
}
