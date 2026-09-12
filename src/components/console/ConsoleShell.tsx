import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { ArrowLeft, Loader2, LockKeyhole, LogOut, Menu, ShieldX } from "lucide-react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Brand } from "@/components/site/PublicShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api";

export type NavItem = { to: string; label: string; icon: LucideIcon; badge?: string };

function NavList({ items }: { items: NavItem[] }) {
  const path = useRouterState({ select: (state) => state.location.pathname });
  return (
    <nav aria-label="Workspace navigation" className="flex flex-col gap-1">
      {items.map((item) => {
        const active =
          path === item.to ||
          (item.to !== "/app" && item.to !== "/admin" && path.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
              active
                ? "bg-sidebar-primary/15 text-sidebar-primary"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <span className="ml-auto text-[10px] text-sidebar-primary">{item.badge}</span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function AccessState({
  kind,
  next,
}: {
  kind: "loading" | "signed-out" | "forbidden";
  next: string;
}) {
  const content =
    kind === "loading"
      ? {
          icon: Loader2,
          title: "Checking your session",
          body: "Confirming secure access before any private workspace data is requested.",
        }
      : kind === "forbidden"
        ? {
            icon: ShieldX,
            title: "This route is restricted",
            body: "Your account is signed in, but it does not have the platform administrator role required here.",
          }
        : {
            icon: LockKeyhole,
            title: "Sign in to continue",
            body: "Private workspace routes do not render demo records or reveal data before your session is verified.",
          };

  return (
    <main
      id="main-content"
      className="paper-grid grid min-h-screen place-items-center bg-background px-5 py-16"
    >
      <div className="card-surface max-w-lg p-8 text-center sm:p-10">
        <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
          <content.icon className={`size-6 ${kind === "loading" ? "animate-spin" : ""}`} />
        </span>
        <h1 className="mt-5 text-3xl font-bold">{content.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{content.body}</p>
        {kind === "signed-out" ? (
          <Button asChild className="mt-7">
            <Link to="/auth" search={{ next }}>
              Sign in securely
            </Link>
          </Button>
        ) : kind === "forbidden" ? (
          <Button asChild variant="outline" className="mt-7">
            <Link to="/">
              <ArrowLeft /> Back to directory
            </Link>
          </Button>
        ) : null}
      </div>
    </main>
  );
}

export function ConsoleShell({
  items,
  title,
  subtitle,
  requiredRole = "user",
}: {
  items: NavItem[];
  title: string;
  subtitle: string;
  requiredRole?: "user" | "admin";
}) {
  const session = useSession();
  const queryClient = useQueryClient();
  const user = session.data?.user ?? null;
  const path = useRouterState({ select: (state) => state.location.pathname });

  if (session.isLoading) return <AccessState kind="loading" next={path} />;
  if (!user) return <AccessState kind="signed-out" next={path} />;
  if (requiredRole === "admin" && user.role !== "platform_admin") {
    return <AccessState kind="forbidden" next={path} />;
  }

  async function signOut() {
    await apiRequest("/v1/auth/logout", { method: "POST" });
    queryClient.clear();
    window.location.assign("/");
  }

  const initials = user.fullName
    .split(" ")
    .slice(0, 2)
    .map((name) => name[0])
    .join("");

  const sidebar = (
    <div className="flex h-full flex-col gap-6 bg-sidebar p-4">
      <div className="px-1 pt-1">
        <Brand tone="invert" />
        <p className="eyebrow mt-5 text-sidebar-primary">{title}</p>
        <p className="mt-1 text-xs text-sidebar-foreground/55">{subtitle}</p>
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        <NavList items={items} />
      </div>
      <div className="rounded-2xl border border-white/8 bg-sidebar-accent p-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-9">
            <AvatarFallback className="bg-sidebar-primary text-xs font-bold text-sidebar-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">
              {user.fullName}
            </p>
            <p className="truncate text-xs capitalize text-sidebar-foreground/55">
              {user.role.replace("_", " ")}
            </p>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-white/8 pt-3">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-sidebar-foreground/65 hover:text-sidebar-primary"
          >
            <ArrowLeft className="size-3" /> Directory
          </Link>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex cursor-pointer items-center justify-end gap-1 text-xs text-sidebar-foreground/65 hover:text-sidebar-primary"
          >
            Sign out <LogOut className="size-3" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/45">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-xl sm:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Open workspace navigation"
              >
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[min(18rem,88vw)] border-0 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>{title} navigation</SheetTitle>
                <SheetDescription>Navigate private workspace sections.</SheetDescription>
              </SheetHeader>
              {sidebar}
            </SheetContent>
          </Sheet>
          <div>
            <p className="text-sm font-bold">{title}</p>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Verified private session
            </p>
          </div>
          <Avatar className="ml-auto size-9 lg:hidden">
            <AvatarFallback className="bg-secondary text-xs font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
        </header>
        <main id="main-content" className="mx-auto max-w-7xl px-4 py-7 sm:px-6 sm:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export function SectionHead({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {subtitle ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
