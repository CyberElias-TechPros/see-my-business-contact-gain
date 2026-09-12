import { Link } from "@tanstack/react-router";
import { ArrowUpRight, MapPin, Menu, Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const nav = [
  { to: "/search", label: "Find a business" },
  { to: "/categories", label: "Categories" },
  { to: "/locations", label: "Cities" },
  { to: "/contact-gain", label: "Contact circles" },
  { to: "/pricing", label: "For business" },
] as const;

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="size-10 overflow-visible">
      <path
        d="M20 2.5c9.67 0 17.5 7.83 17.5 17.5S29.67 37.5 20 37.5 2.5 29.67 2.5 20 10.33 2.5 20 2.5Z"
        className="fill-primary"
      />
      <path
        d="M13.4 12.7h13.9v4.1h-8.8c-1.95 0-3.4 1.48-3.4 3.45 0 2.08 1.52 3.65 3.65 3.65h4.35v-2.35h-4.55v-3.7h8.8v9.25c-2.2 1.28-4.8 1.95-7.35 1.95-5.8 0-10.15-3.52-10.15-8.72 0-4.4 3.02-7.63 7.55-7.63Z"
        className="fill-primary-foreground"
      />
      <circle cx="31.5" cy="8.5" r="4" className="fill-accent stroke-ink" strokeWidth="2" />
    </svg>
  );
}

export function Brand({ tone = "default" }: { tone?: "default" | "invert" }) {
  return (
    <Link
      to="/"
      aria-label="GainHub NG home"
      className="group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none"
    >
      <span className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
        <BrandMark />
      </span>
      <span
        className={`font-display text-[1.08rem] font-extrabold leading-none tracking-[-0.04em] ${
          tone === "invert" ? "text-sidebar-foreground" : "text-foreground"
        }`}
      >
        GainHub
        <span className={tone === "invert" ? "text-sidebar-primary" : "text-primary"}> NG</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-foreground/8 bg-background/88 backdrop-blur-xl">
      <div className="hidden border-b border-foreground/8 bg-ink text-ink-foreground md:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-5 text-[0.68rem] font-semibold tracking-wide">
          <p className="flex items-center gap-1.5 text-ink-foreground/72">
            <MapPin className="size-3 text-sidebar-primary" /> Built around Nigerian cities and real
            buying habits
          </p>
          <Link
            to="/join"
            className="flex items-center gap-1 text-sidebar-primary hover:text-accent"
          >
            Business owner? Get listed <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-5 px-4 sm:px-5">
        <Brand />
        <nav aria-label="Primary navigation" className="ml-3 hidden items-center gap-0.5 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/search" }}
              className="rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
              activeProps={{ className: "bg-secondary text-secondary-foreground" }}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex lg:hidden">
            <Link to="/search" aria-label="Search directory">
              <Search />
            </Link>
          </Button>
          <Button asChild variant="ghost" className="hidden md:inline-flex">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/join">List free</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation menu"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(21rem,88vw)] border-l-0 bg-background p-0">
              <SheetHeader className="border-b p-5 text-left">
                <SheetTitle>
                  <Brand />
                </SheetTitle>
                <SheetDescription>
                  Find a trusted route to your next local provider.
                </SheetDescription>
              </SheetHeader>
              <nav aria-label="Mobile navigation" className="flex flex-col gap-1 p-4">
                {nav.map((item) => (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      className="rounded-xl px-4 py-3 text-base font-semibold hover:bg-secondary"
                      activeProps={{ className: "bg-secondary text-secondary-foreground" }}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                <div className="my-3 border-t" />
                <SheetClose asChild>
                  <Link
                    to="/account"
                    className="rounded-xl px-4 py-3 text-sm font-semibold hover:bg-secondary"
                  >
                    My account
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/app"
                    className="rounded-xl px-4 py-3 text-sm font-semibold hover:bg-secondary"
                  >
                    Business workspace
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild className="mt-3">
                    <Link to="/join">List your business free</Link>
                  </Button>
                </SheetClose>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

const footerColumns = [
  {
    title: "Discover",
    links: [
      { to: "/search", label: "Search businesses" },
      { to: "/categories", label: "Browse categories" },
      { to: "/locations", label: "Browse cities" },
      { to: "/compare", label: "Compare providers" },
      { to: "/contact-gain", label: "Contact circles" },
    ],
  },
  {
    title: "Grow",
    links: [
      { to: "/join", label: "List your business" },
      { to: "/claim", label: "Claim a listing" },
      { to: "/pricing", label: "Business access" },
      { to: "/advertise", label: "Advertising status" },
      { to: "/app", label: "Business workspace" },
    ],
  },
  {
    title: "Support",
    links: [
      { to: "/about", label: "About GainHub" },
      { to: "/help", label: "Help centre" },
      { to: "/trust-safety", label: "Trust & safety" },
      { to: "/suggest-business", label: "Suggest a correction" },
      { to: "/report", label: "Report a concern" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/legal/privacy", label: "Privacy" },
      { to: "/legal/terms", label: "Terms" },
      { to: "/legal/data-request", label: "Data requests" },
      { to: "/legal/cookies", label: "Cookies" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="relative mt-24 overflow-hidden bg-ink text-ink-foreground">
      <div
        className="absolute -right-32 -top-40 size-96 rounded-full border border-white/10"
        aria-hidden="true"
      />
      <div
        className="absolute -right-16 -top-24 size-64 rounded-full border border-sidebar-primary/20"
        aria-hidden="true"
      />
      <div className="mx-auto max-w-7xl px-5 pb-8 pt-14">
        <div className="grid gap-12 border-b border-white/10 pb-12 lg:grid-cols-[1.2fr_2fr]">
          <div>
            <Brand tone="invert" />
            <p className="mt-5 max-w-sm text-sm leading-6 text-ink-foreground/65">
              Better local discovery for customers. Better lead visibility for the businesses doing
              the work.
            </p>
            <Button asChild variant="secondary" className="mt-6">
              <Link to="/join">
                Put your business on the map <ArrowUpRight />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
            {footerColumns.map((column) => (
              <div key={column.title}>
                <h2 className="eyebrow text-sidebar-primary">{column.title}</h2>
                <ul className="mt-4 space-y-3">
                  {column.links.map((link) => (
                    <li key={link.to}>
                      <Link
                        to={link.to}
                        className="text-sm text-ink-foreground/65 transition-colors hover:text-ink-foreground"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-6 text-xs text-ink-foreground/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 GainHub NG. Built for useful local connections.</p>
          <p>Privacy-minded · Accessible by design · Nigeria-focused</p>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main id="main-content">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="paper-grid relative overflow-hidden border-b bg-hero-mesh">
      <div
        className="absolute -right-24 -top-36 size-80 rounded-full border border-primary/15"
        aria-hidden="true"
      />
      <div
        className="absolute -right-10 -top-16 size-52 rounded-full border border-primary/20"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-7 px-5 py-14 md:flex-row md:items-end md:justify-between md:py-16">
        <div className="max-w-3xl reveal-up">
          {eyebrow ? <p className="eyebrow text-primary">{eyebrow}</p> : null}
          <h1 className="mt-3 text-4xl font-extrabold leading-[0.98] md:text-5xl">{title}</h1>
          {subtitle ? (
            <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        {action ? <div className="reveal-up reveal-up-delay-1 shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

export function PreviewNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="border-y border-accent/35 bg-accent/12 px-4 py-2.5 text-center text-xs font-semibold text-accent-foreground">
      {children ??
        "Preview records are clearly marked. Production starts empty and only publishes reviewed submissions."}
    </div>
  );
}
