import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Bell,
  Building2,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Search,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Magnetic } from "@/components/motion";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api";
import type { NotificationList } from "@/lib/contracts";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/search", label: "Find a business" },
  { to: "/categories", label: "Categories" },
  { to: "/locations", label: "Cities" },
  { to: "/contact-gain", label: "Contact circles" },
  { to: "/pricing", label: "For business" },
] as const;

/* -------------------------------------------------------------------------- */
/* Brand                                                                      */
/* -------------------------------------------------------------------------- */

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true" className="size-10 overflow-visible">
      <defs>
        <linearGradient id="brand-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="oklch(0.56 0.17 150)" />
          <stop offset="100%" stopColor="oklch(0.44 0.15 154)" />
        </linearGradient>
      </defs>
      <path
        d="M20 2.5c9.67 0 17.5 7.83 17.5 17.5S29.67 37.5 20 37.5 2.5 29.67 2.5 20 10.33 2.5 20 2.5Z"
        fill="url(#brand-body)"
      />
      <path
        d="M13.4 12.7h13.9v4.1h-8.8c-1.95 0-3.4 1.48-3.4 3.45 0 2.08 1.52 3.65 3.65 3.65h4.35v-2.35h-4.55v-3.7h8.8v9.25c-2.2 1.28-4.8 1.95-7.35 1.95-5.8 0-10.15-3.52-10.15-8.72 0-4.4 3.02-7.63 7.55-7.63Z"
        className="fill-primary-foreground"
      />
      <circle cx="31.5" cy="8.5" r="4" className="fill-accent stroke-background" strokeWidth="2" />
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
      <span className="transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-12 group-hover:scale-110">
        <BrandMark />
      </span>
      <span
        className={cn(
          "font-display text-[1.08rem] font-extrabold leading-none tracking-[-0.04em]",
          tone === "invert" ? "text-sidebar-foreground" : "text-foreground",
        )}
      >
        GainHub
        <span className={tone === "invert" ? "text-sidebar-primary" : "text-primary"}> NG</span>
      </span>
    </Link>
  );
}

/* -------------------------------------------------------------------------- */
/* Notification bell                                                          */
/* -------------------------------------------------------------------------- */

function NotificationBell({ onNavigate }: { onNavigate: () => void }) {
  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<NotificationList>("/v1/notifications"),
    refetchInterval: 60_000,
    retry: false,
  });
  const unread = data?.unreadCount ?? 0;

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link to="/account" onClick={onNavigate} aria-label={`Notifications (${unread} unread)`}>
        <Bell className="size-[1.15rem]" />
        {unread > 0 ? (
          <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[0.6rem] font-bold leading-4 text-accent-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Header                                                                     */
/* -------------------------------------------------------------------------- */

function useScrolled(threshold = 12): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      setScrolled(window.scrollY > threshold);
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [threshold]);
  return scrolled;
}

function AccountMenu({ onNavigate }: { onNavigate: () => void }) {
  const session = useSession();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const user = session.data?.user ?? null;

  async function signOut() {
    await apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => undefined);
    queryClient.clear();
    void navigate({ to: "/" });
  }

  if (!session.isLoading && !user) {
    return (
      <>
        <Button asChild variant="ghost" className="hidden md:inline-flex">
          <Link to="/auth">Sign in</Link>
        </Button>
        <Button asChild className="hidden sm:inline-flex">
          <Link to="/join">List free</Link>
        </Button>
      </>
    );
  }

  return (
    <>
      <NotificationBell onNavigate={onNavigate} />
      <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
        <Link to="/account" aria-label="My account" onClick={onNavigate}>
          <Avatar className="size-7">
            <AvatarFallback className="bg-primary/12 text-[0.68rem] font-bold text-primary">
              {(user?.fullName ?? "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
      </Button>
      <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
        <Link to="/app" aria-label="Business workspace" onClick={onNavigate}>
          <LayoutDashboard className="size-[1.15rem]" />
        </Link>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="hidden sm:inline-flex"
        onClick={() => void signOut()}
        aria-label="Sign out"
      >
        <LogOut className="size-[1.15rem]" />
      </Button>
    </>
  );
}

export function SiteHeader() {
  const scrolled = useScrolled();
  const [open, setOpen] = useState(false);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b transition-[background-color,border-color,box-shadow,backdrop-filter] duration-500",
        scrolled
          ? "border-border/70 bg-background/85 shadow-[0_10px_40px_-24px_oklch(0.2_0.04_155/0.4)] backdrop-blur-xl"
          : "border-transparent bg-background/55 backdrop-blur-md",
      )}
    >
      <div className="hidden border-b border-border/50 bg-ink text-ink-foreground md:block">
        <div className="mx-auto flex h-8 max-w-7xl items-center justify-between px-5 text-[0.68rem] font-semibold tracking-wide">
          <p className="flex items-center gap-1.5 text-ink-foreground/72">
            <MapPin className="size-3 text-sidebar-primary" />
            Built around Nigerian cities and real buying habits
          </p>
          <Link
            to="/join"
            className="flex items-center gap-1 text-sidebar-primary transition-colors hover:text-accent"
          >
            Business owner? Get listed <ArrowUpRight className="size-3" />
          </Link>
        </div>
      </div>

      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center gap-4 px-4 sm:px-5">
        <Brand />

        <nav aria-label="Primary navigation" className="ml-4 hidden items-center gap-0.5 lg:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="group relative rounded-lg px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
              activeProps={{ className: "text-foreground" }}
            >
              {item.label}
              {/* Underline draws from the centre on hover, and stays for the current route. */}
              <span className="absolute inset-x-3 -bottom-0.5 h-px scale-x-0 bg-primary transition-transform duration-400 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-x-100" />
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button asChild variant="ghost" size="icon" className="lg:hidden">
            <Link to="/search" aria-label="Search directory">
              <Search className="size-[1.15rem]" />
            </Link>
          </Button>
          <AccountMenu onNavigate={() => setOpen(false)} />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-[1.15rem]" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[min(23rem,90vw)] border-l-border/60 p-0">
              <SheetHeader className="flex-row items-center justify-between border-b border-border/60 p-5 text-left">
                <SheetTitle>
                  <Brand />
                </SheetTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="size-[1.15rem]" />
                </Button>
              </SheetHeader>
              <SheetDescription className="px-5 pt-3 text-sm text-muted-foreground">
                Find a trusted route to your next local provider.
              </SheetDescription>
              <nav aria-label="Mobile navigation" className="flex flex-col gap-1 p-4">
                {nav.map((item, index) => (
                  <SheetClose asChild key={item.to}>
                    <Link
                      to={item.to}
                      className="motion-reveal motion-reveal-right is-revealed rounded-xl px-4 py-3 text-base font-semibold transition-colors hover:bg-secondary"
                      style={{ transitionDelay: `${index * 45}ms` }}
                      activeProps={{ className: "bg-secondary" }}
                    >
                      {item.label}
                    </Link>
                  </SheetClose>
                ))}
                <div className="my-3 border-t border-border/60" />
                <SheetClose asChild>
                  <Link
                    to="/account"
                    className="rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
                  >
                    My account
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link
                    to="/app"
                    className="rounded-xl px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary"
                  >
                    Business workspace
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild className="mt-3" size="lg">
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

/* -------------------------------------------------------------------------- */
/* Page head                                                                  */
/* -------------------------------------------------------------------------- */

export function PageHead({
  eyebrow,
  title,
  subtitle,
  action,
  tone = "light",
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  tone?: "light" | "ink";
}) {
  const ink = tone === "ink";
  return (
    <div
      className={cn(
        "relative overflow-hidden border-b",
        ink ? "border-white/10 bg-ink text-ink-foreground" : "bg-hero-mesh",
      )}
    >
      <div className="aurora opacity-60" aria-hidden="true" />
      <div
        className="absolute -right-24 -top-36 size-80 rounded-full border border-primary/15"
        aria-hidden="true"
      />
      <div
        className="absolute -right-10 -top-16 size-52 rounded-full border border-primary/20"
        aria-hidden="true"
      />
      <div className="relative mx-auto flex max-w-7xl flex-col gap-7 px-5 py-14 md:flex-row md:items-end md:justify-between md:py-16">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p
              className={cn("eyebrow", ink ? "text-sidebar-primary" : "text-primary")}
              style={{ animation: "reveal-up 700ms var(--ease-out-expo) both" }}
            >
              {eyebrow}
            </p>
          ) : null}
          <h1
            className="mt-3 display-md"
            style={{ animation: "reveal-up 800ms var(--ease-out-expo) 70ms both" }}
          >
            {title}
          </h1>
          {subtitle ? (
            <p
              className={cn(
                "mt-4 max-w-2xl text-base leading-7",
                ink ? "text-ink-foreground/70" : "text-muted-foreground",
              )}
              style={{ animation: "reveal-up 800ms var(--ease-out-expo) 140ms both" }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? (
          <div
            className="shrink-0"
            style={{ animation: "reveal-up 800ms var(--ease-out-expo) 210ms both" }}
          >
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PreviewNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="border-y border-accent/35 bg-accent/12 px-4 py-2.5 text-center text-xs font-semibold text-accent-foreground">
      {children ??
        "Production starts empty and only publishes reviewed submissions. Nothing here is a paid placement."}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

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
    <footer className="relative mt-28 overflow-hidden bg-ink text-ink-foreground">
      <div className="aurora opacity-40" aria-hidden="true" />
      <div
        className="absolute -right-32 -top-40 size-96 rounded-full border border-white/10"
        aria-hidden="true"
      />
      <div
        className="absolute -right-16 -top-24 size-64 rounded-full border border-sidebar-primary/20"
        aria-hidden="true"
      />

      <div className="relative mx-auto max-w-7xl px-5 pb-8 pt-16">
        <div className="grid gap-12 border-b border-white/10 pb-12 lg:grid-cols-[1.15fr_2fr]">
          <div>
            <Brand tone="invert" />
            <p className="mt-5 max-w-sm text-sm leading-6 text-ink-foreground/65">
              Better local discovery for customers. Better lead visibility for the businesses doing
              the work.
            </p>
            <Magnetic>
              <Button asChild variant="secondary" size="lg" className="mt-6">
                <Link to="/join">
                  Put your business on the map <ArrowUpRight />
                </Link>
              </Button>
            </Magnetic>
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
                        className="link-underline text-sm text-ink-foreground/65 transition-colors hover:text-ink-foreground"
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

        <div className="flex flex-col gap-3 pt-6 text-xs text-ink-foreground/45 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} GainHub NG. Built for useful local connections.</p>
          <p className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-white/15 text-ink-foreground/60">
              <Building2 className="size-3" /> Nigeria-focused
            </Badge>
            <Badge variant="outline" className="border-white/15 text-ink-foreground/60">
              Privacy-minded
            </Badge>
            <Badge variant="outline" className="border-white/15 text-ink-foreground/60">
              Accessible by design
            </Badge>
          </p>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
