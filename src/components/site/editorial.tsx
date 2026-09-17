import { Link } from "@tanstack/react-router";
import { ArrowRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Magnetic, Reveal } from "@/components/motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Editorial system for long-form and explanatory pages.
 *
 * These pages are how the product explains itself — pricing, trust, safety,
 * legal terms, help. They carry the most reading and the least illustration, so
 * the job here is rhythm: a clear hierarchy, generous measure, and enough
 * restraint that the words stay the most important thing on the screen.
 */

/* -------------------------------------------------------------------------- */
/* Section                                                                     */
/* -------------------------------------------------------------------------- */

export function EditorialSection({
  id,
  eyebrow,
  title,
  lead,
  children,
  aside,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title?: ReactNode;
  lead?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={id ? `${id}-heading` : undefined}
      className={cn("border-t border-border/60 py-14 first:border-t-0 first:pt-0", className)}
    >
      <div className={cn("grid gap-10", aside ? "lg:grid-cols-[1fr_20rem] lg:gap-14" : "")}>
        <div className="min-w-0">
          {eyebrow ? (
            <Reveal>
              <p className="eyebrow text-primary">{eyebrow}</p>
            </Reveal>
          ) : null}
          {title ? (
            <Reveal delay={1}>
              <h2
                id={id ? `${id}-heading` : undefined}
                className="display-md mt-4 max-w-3xl text-balance"
              >
                {title}
              </h2>
            </Reveal>
          ) : null}
          {lead ? (
            <Reveal delay={2}>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">{lead}</p>
            </Reveal>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
        {aside ? <aside className="lg:sticky lg:top-28 lg:h-fit">{aside}</aside> : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Prose                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Long-form reading column. The measure is capped at ~68 characters because
 * legal and policy text is already demanding; the layout should not add to it.
 */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "max-w-none text-[0.975rem] leading-7 text-muted-foreground",
        "[&_h2]:mt-10 [&_h2]:first:mt-0 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-extrabold [&_h2]:tracking-[-0.03em] [&_h2]:text-foreground",
        "[&_h3]:mt-7 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:text-foreground",
        "[&_p]:mt-4 [&_p]:first:mt-0 [&_p]:max-w-[68ch]",
        "[&_ul]:mt-4 [&_ul]:max-w-[68ch] [&_ul]:space-y-2.5 [&_ul]:pl-1",
        "[&_ol]:mt-4 [&_ol]:max-w-[68ch] [&_ol]:space-y-2.5 [&_ol]:pl-5 [&_ol]:list-decimal",
        "[&_li]:relative [&_li]:pl-6",
        "[&_ul>li]:before:absolute [&_ul>li]:before:left-0 [&_ul>li]:before:top-[0.7em]",
        "[&_ul>li]:before:size-1.5 [&_ul>li]:before:rounded-full [&_ul>li]:before:bg-primary/60 [&_ul>li]:before:content-['']",
        "[&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Feature grid                                                                */
/* -------------------------------------------------------------------------- */

export function FeatureGrid({
  items,
  columns = 2,
}: {
  items: Array<{ icon: LucideIcon; title: string; text: string }>;
  columns?: 2 | 3;
}) {
  return (
    <ul
      className={cn(
        "grid gap-4",
        columns === 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2",
      )}
    >
      {items.map((item, index) => (
        <Reveal as="li" key={item.title} delay={index % columns} className="h-full">
          <Card className="group h-full rounded-3xl border-border/70 transition-[border-color,box-shadow] duration-500 hover:border-primary/30 hover:shadow-lift">
            <CardContent className="p-6">
              <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-primary transition-transform duration-500 group-hover:-rotate-6 group-hover:scale-110">
                <item.icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-5 text-lg font-bold leading-snug">{item.title}</h3>
              <p className="mt-2.5 text-sm leading-6 text-muted-foreground">{item.text}</p>
            </CardContent>
          </Card>
        </Reveal>
      ))}
    </ul>
  );
}

/* -------------------------------------------------------------------------- */
/* Numbered steps                                                              */
/* -------------------------------------------------------------------------- */

export function StepList({ steps }: { steps: Array<{ title: string; text: string }> }) {
  return (
    <ol className="grid gap-4">
      {steps.map((step, index) => (
        <Reveal as="li" key={step.title} delay={index % 3}>
          <div className="flex gap-5 rounded-3xl border border-border/70 bg-card p-6">
            <span
              className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary font-display text-sm font-extrabold text-primary-foreground"
              aria-hidden="true"
            >
              {String(index + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.text}</p>
            </div>
          </div>
        </Reveal>
      ))}
    </ol>
  );
}

/* -------------------------------------------------------------------------- */
/* Callout                                                                     */
/* -------------------------------------------------------------------------- */

export function Callout({
  icon: Icon,
  title,
  children,
  tone = "primary",
}: {
  icon?: LucideIcon;
  title: string;
  children: ReactNode;
  tone?: "primary" | "warning" | "neutral";
}) {
  const tones = {
    primary: "border-primary/25 bg-primary/6 text-primary",
    warning: "border-warning/40 bg-warning/8 text-warning-foreground",
    neutral: "border-border/70 bg-muted/40 text-muted-foreground",
  } as const;

  return (
    <Card className={cn("rounded-3xl", tones[tone].split(" ").slice(0, 2).join(" "))}>
      <CardContent className="p-6">
        <h3 className={cn("flex items-center gap-2 text-lg font-bold", tones[tone].split(" ")[2])}>
          {Icon ? <Icon className="size-5" aria-hidden="true" /> : null}
          {title}
        </h3>
        <div className="mt-2.5 text-sm leading-6 text-muted-foreground">{children}</div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* FAQ                                                                         */
/* -------------------------------------------------------------------------- */

export function FaqList({ items }: { items: Array<{ q: string; a: ReactNode }> }) {
  return (
    <div className="divide-y overflow-hidden rounded-3xl border border-border/70">
      {items.map((item, index) => (
        <Reveal key={item.q} delay={index % 3}>
          <details className="group bg-card px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-base font-bold">
              {item.q}
              <span
                className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full border border-border/70 text-muted-foreground transition-transform duration-300 group-open:rotate-45"
                aria-hidden="true"
              >
                +
              </span>
            </summary>
            <div className="mt-3 max-w-[68ch] text-sm leading-7 text-muted-foreground">
              {item.a}
            </div>
          </details>
        </Reveal>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Facts                                                                       */
/* -------------------------------------------------------------------------- */

export function FactList({
  items,
  title = "At a glance",
}: {
  items: Array<{ label: string; value: string }>;
  title?: string;
}) {
  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="p-6">
        <h2 className="eyebrow text-muted-foreground">{title}</h2>
        <dl className="mt-4 divide-y">
          {items.map((item) => (
            <div key={item.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-sm text-muted-foreground">{item.label}</dt>
              <dd className="text-right text-sm font-bold">{item.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Closing band                                                                */
/* -------------------------------------------------------------------------- */

export function CtaBand({
  eyebrow,
  title,
  body,
  primary,
  secondary,
}: {
  eyebrow: string;
  title: string;
  body?: string;
  primary: { to: string; label: string };
  secondary?: { to: string; label: string };
}) {
  return (
    <section className="grain relative overflow-hidden rounded-[2rem] bg-ink text-ink-foreground">
      <div aria-hidden="true" className="aurora opacity-45" />
      <div
        aria-hidden="true"
        className="absolute -right-24 -top-32 size-80 rounded-full border border-white/10"
      />
      <div className="relative flex flex-col gap-8 p-8 md:p-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <p className="eyebrow text-sidebar-primary">{eyebrow}</p>
          <h2 className="display-md mt-4">{title}</h2>
          {body ? (
            <p className="mt-4 max-w-xl text-sm leading-7 text-ink-foreground/62">{body}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Magnetic>
            <Button asChild size="lg" variant="secondary">
              <Link to={primary.to}>
                {primary.label} <ArrowRight />
              </Link>
            </Button>
          </Magnetic>
          {secondary ? (
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-white/20 bg-transparent text-ink-foreground hover:bg-white/10"
            >
              <Link to={secondary.to}>{secondary.label}</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Status pill                                                                 */
/* -------------------------------------------------------------------------- */

export function StatusPill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "active" | "pending" | "blocked";
}) {
  const tones = {
    neutral: "border-border/70 bg-muted text-muted-foreground",
    active: "border-primary/30 bg-primary/10 text-primary",
    pending: "border-warning/40 bg-warning/10 text-warning-foreground",
    blocked: "border-destructive/30 bg-destructive/10 text-destructive",
  } as const;
  return (
    <Badge variant="outline" className={tones[tone]}>
      {children}
    </Badge>
  );
}
