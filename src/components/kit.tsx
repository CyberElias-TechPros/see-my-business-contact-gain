import { Link } from "@tanstack/react-router";
import { ArrowUpRight, BadgeCheck, MapPin, Star } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Business } from "@/data/mock";
import type { PublicBusiness } from "@/lib/contracts";

export function StatCard({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: string;
  delta?: string;
  hint?: string;
}) {
  return (
    <Card className="card-surface">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-2 font-display text-2xl font-bold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {delta ? <span className="font-semibold text-primary">{delta}</span> : null} {hint}
        </p>
      </CardContent>
    </Card>
  );
}

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
    <Card className={`card-surface ${className ?? ""}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 border-b pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}

export function SimpleTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (ReactNode[] | { cells: ReactNode[] })[];
}) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((c) => (
              <TableHead key={c} className="whitespace-nowrap text-xs uppercase tracking-wide">
                {c}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => {
            const cells = Array.isArray(row) ? row : row.cells;
            return (
              <TableRow key={i}>
                {cells.map((cell, j) => (
                  <TableCell key={j} className="whitespace-nowrap text-sm">
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function BarTrend({ data }: { data: { label: string; contacts: number; leads: number }[] }) {
  const max = Math.max(...data.map((d) => d.contacts));
  return (
    <div className="flex h-40 items-end gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="flex h-32 w-full items-end justify-center gap-1">
            <div
              className="w-1/2 rounded-t bg-primary/80"
              style={{ height: `${(d.contacts / max) * 100}%` }}
              title={`${d.contacts} contacts`}
            />
            <div
              className="w-1/2 rounded-t bg-accent/80"
              style={{ height: `${(d.leads / max) * 100}%` }}
              title={`${d.leads} leads`}
            />
          </div>
          <span className="text-xs text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export function SourceBars({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.label}>
          <div className="flex justify-between text-sm">
            <span>{d.label}</span>
            <span className="font-semibold">{d.value}%</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-muted">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${d.value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function VerifiedBadge({ level }: { level: Business["verified"] }) {
  if (level === "unverified") return <Badge variant="outline">Unverified</Badge>;
  const label =
    level === "premium"
      ? "Premium verified"
      : level === "documents"
        ? "Documents verified"
        : `${level} verified`;
  return (
    <Badge className="gap-1 capitalize">
      <BadgeCheck className="size-3" /> {label}
    </Badge>
  );
}

export function Stars({ rating }: { rating: number }) {
  return (
    <span
      className="flex items-center gap-1 text-sm"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      <Star className="size-3.5 fill-accent text-accent" aria-hidden="true" />
      <span className="font-bold tabular-nums">{rating.toFixed(1)}</span>
    </span>
  );
}

export function BusinessCard({ business }: { business: Business | PublicBusiness }) {
  const isPreview = "isDemo" in business;
  const routeId = isPreview ? business.id : business.slug;
  const category = isPreview ? business.category : business.categoryName;
  const verification = isPreview ? business.verified : business.verificationLevel;
  const cover = isPreview ? business.cover : "bg-ink-mesh";

  return (
    <Card className="card-surface group relative overflow-hidden transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/25 hover:shadow-lift">
      <div className={`paper-grid relative h-28 overflow-hidden ${cover}`}>
        <div className="absolute -right-8 -top-12 size-32 rounded-full border border-white/15 transition-transform duration-500 group-hover:scale-110" />
        <div className="absolute -right-2 -top-7 size-20 rounded-full border border-sidebar-primary/30" />
        {isPreview ? (
          <Badge className="absolute left-4 top-4 border-white/15 bg-ink/70 text-ink-foreground backdrop-blur">
            Product preview
          </Badge>
        ) : null}
      </div>
      <CardContent className="relative -mt-7 space-y-4 p-5 pt-0">
        <div className="grid size-14 place-items-center rounded-2xl border-4 border-card bg-accent font-display text-lg font-extrabold text-accent-foreground shadow-soft">
          {business.name
            .split(" ")
            .slice(0, 2)
            .map((word) => word[0])
            .join("")}
        </div>
        <div>
          <div className="flex items-start justify-between gap-3">
            <Link
              to="/business/$id"
              params={{ id: routeId }}
              className="after:absolute after:inset-0 after:content-[''] hover:text-primary focus-visible:outline-none"
            >
              <h3 className="text-lg font-bold leading-tight">{business.name}</h3>
            </Link>
            {business.rating > 0 ? (
              <Stars rating={business.rating} />
            ) : (
              <span className="text-xs text-muted-foreground">New</span>
            )}
          </div>
          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">
            {business.tagline}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="max-w-full truncate">
            {category}
          </Badge>
          <span className="flex items-center gap-1">
            <MapPin className="size-3" aria-hidden="true" /> {business.city}, {business.state}
          </span>
        </div>
        <div className="relative z-10 flex items-center justify-between gap-2 border-t pt-4">
          <VerifiedBadge level={verification} />
          <Button asChild size="sm" variant="ghost" className="gap-1">
            <Link to="/business/$id" params={{ id: routeId }}>
              View <ArrowUpRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
