import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Menu, Search, MessageCircle } from "lucide-react";
import type { ReactNode } from "react";
import { AccountMenu } from "@/components/site/AccountMenu.tsx";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { sessionQuery } from "@/lib/queries.ts";
import { useSignOut } from "@/lib/session-actions.ts";

const nav = [
  { to: "/search", label: "Directory" },
  { to: "/categories", label: "Categories" },
  { to: "/locations", label: "Locations" },
  { to: "/contact-gain", label: "Contact Gain" },
  { to: "/pricing", label: "Pricing" },
  { to: "/help", label: "Help" },
];

export function Brand({ tone = "default" }: { tone?: "default" | "invert" }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <span className="grid size-9 place-items-center rounded-xl bg-primary text-primary-foreground">
        <MessageCircle className="size-5" />
      </span>
      <span
        className={`font-display text-lg font-bold tracking-tight ${tone === "invert" ? "text-sidebar-foreground" : "text-foreground"}`}
      >
        GainHub<span className="text-primary">NG</span>
      </span>
    </Link>
  );
}

export function SiteHeader() {
  // The root loader already resolved the session during SSR, so this is a cache read, not a
  // request: the header ships the right state in the HTML instead of correcting itself after
  // hydration. `AccountMenu` reads the same key.
  const { data: session } = useQuery(sessionQuery());
  const signOut = useSignOut();
  const user = session?.user ?? null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4">
        <Brand />
        <nav className="hidden items-center gap-1 lg:flex">
          {nav.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="lg:hidden">
            <Link to="/search" aria-label="Search directory">
              <Search className="size-4" />
            </Link>
          </Button>
          <AccountMenu />
          <Button asChild className="hidden sm:inline-flex">
            <Link to="/join">List your business</Link>
          </Button>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-6 flex flex-col gap-1">
                {nav.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                  >
                    {n.label}
                  </Link>
                ))}
                <Link
                  to="/account"
                  className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  My account
                </Link>
                <Link to="/app" className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted">
                  Business workspace
                </Link>
                <Link
                  to="/admin"
                  className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  Admin console
                </Link>
                {user ? null : (
                  <Link
                    to="/auth"
                    className="rounded-lg px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
                  >
                    Sign in
                  </Link>
                )}
                <Button asChild className="mt-3">
                  <Link to="/join">List your business</Link>
                </Button>
                {user ? (
                  <Button variant="outline" className="mt-1" onClick={() => void signOut()}>
                    Sign out
                  </Button>
                ) : null}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}

const footerCols = [
  {
    title: "Discover",
    links: [
      { to: "/search", label: "Search businesses" },
      { to: "/categories", label: "Browse categories" },
      { to: "/locations", label: "Browse locations" },
      { to: "/compare", label: "Compare businesses" },
      { to: "/contact-gain", label: "Contact-gain rooms" },
    ],
  },
  {
    title: "For business",
    links: [
      { to: "/join", label: "List your business" },
      { to: "/claim", label: "Claim a listing" },
      { to: "/pricing", label: "Plans & pricing" },
      { to: "/advertise", label: "Advertise" },
      { to: "/app", label: "Business workspace" },
    ],
  },
  {
    title: "Company",
    links: [
      { to: "/about", label: "About us" },
      { to: "/help", label: "Help centre" },
      { to: "/trust-safety", label: "Trust & safety" },
      { to: "/suggest-business", label: "Suggest a business" },
      { to: "/admin", label: "Admin console" },
    ],
  },
  {
    title: "Legal",
    links: [
      { to: "/legal/privacy", label: "Privacy (NDPR)" },
      { to: "/legal/terms", label: "Terms of use" },
      { to: "/legal/data-request", label: "Data requests" },
      { to: "/legal/cookies", label: "Cookies" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <Brand tone="invert" />
          <p className="mt-4 max-w-xs text-sm text-ink-foreground/70">
            Nigeria&apos;s WhatsApp-first business directory and contact-gain network. Get found,
            get saved, get customers.
          </p>
        </div>
        {footerCols.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-semibold">{col.title}</h3>
            <ul className="mt-3 space-y-2">
              {col.links.map((l) => (
                <li key={l.to}>
                  <Link
                    to={l.to}
                    className="text-sm text-ink-foreground/70 transition-colors hover:text-primary"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-ink-foreground/60">
        © 2026 GainHub NG. Built for Nigerian businesses. NDPR-aligned data handling.
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>{children}</main>
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
    <div className="border-b bg-hero-mesh">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-12 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 text-3xl font-bold md:text-4xl">{title}</h1>
          {subtitle ? <p className="mt-3 max-w-2xl text-muted-foreground">{subtitle}</p> : null}
        </div>
        {action}
      </div>
    </div>
  );
}
