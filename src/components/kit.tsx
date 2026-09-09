import { Link } from "@tanstack/react-router";
import { BadgeCheck, MapPin, MessageCircle, Star } from "lucide-react";
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
    <span className="flex items-center gap-1 text-sm">
      <Star className="size-3.5 fill-accent text-accent" />
      <span className="font-semibold">{rating.toFixed(1)}</span>
    </span>
  );
}

export function BusinessCard({ business }: { business: Business }) {
  return (
    <Card className="card-surface group overflow-hidden transition-shadow hover:shadow-lift">
      {business.coverUrl ? (
        <div className="h-24 overflow-hidden bg-secondary">
          {/* The API serves media with immutable caching and a 1x1 placeholder is pointless
              here: covers are small, and a broken image falls back to the monogram below. */}
          <img
            src={business.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        </div>
      ) : (
        <div className={`h-24 ${business.cover}`} aria-hidden="true" />
      )}
      <CardContent className="-mt-8 space-y-3 p-5">
        <div className="grid size-14 place-items-center rounded-2xl border-4 border-card bg-secondary font-display text-lg font-bold">
          {business.name.slice(0, 2)}
        </div>
        <div>
          <div className="flex items-start justify-between gap-2">
            <Link
              to="/business/$id"
              params={{ id: business.id }}
              className="font-semibold hover:text-primary"
            >
              {business.name}
            </Link>
            <Stars rating={business.rating} />
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{business.tagline}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">{business.category}</Badge>
          <span className="flex items-center gap-1">
            <MapPin className="size-3" /> {business.city}, {business.state}
          </span>
          {business.openNow ? <span className="text-primary">Open now</span> : <span>Closed</span>}
        </div>
        <div className="flex items-center justify-between gap-2 pt-1">
          <VerifiedBadge level={business.verified} />
          {business.whatsappUrl ? (
            <Button size="sm" variant="secondary" className="gap-1" asChild>
              <a href={business.whatsappUrl} target="_blank" rel="noopener noreferrer nofollow">
                <MessageCircle className="size-3.5" /> WhatsApp
              </a>
            </Button>
          ) : (
            <Link
              to="/business/$id"
              params={{ id: business.id }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Send an enquiry
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
