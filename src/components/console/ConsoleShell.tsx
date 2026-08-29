import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Bell, ChevronLeft, LogOut, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Brand } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { backendMode } from "@/lib/api";
import { useMe, useSignOut, useWs } from "@/lib/queries";
import { qk } from "@/lib/queries";

export type NavItem = { to: string; label: string; icon: LucideIcon; badge?: string };

function NavList({ items }: { items: NavItem[] }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => {
        const active =
          path === item.to ||
          (item.to !== "/app" && item.to !== "/admin" && path.startsWith(item.to));
        return (
          <Link
            key={item.to}
            to={item.to}
            className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
              active
                ? "bg-sidebar-primary/15 font-semibold text-sidebar-primary"
                : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <item.icon className="size-4 shrink-0" />
            <span className="truncate">{item.label}</span>
            {item.badge ? (
              <Badge variant="secondary" className="ml-auto h-5 px-1.5 text-[10px]">
                {item.badge}
              </Badge>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

export function ConsoleShell({
  items,
  title,
  subtitle,
  admin = false,
}: {
  items: NavItem[];
  title: string;
  subtitle?: string;
  admin?: boolean;
}) {
  const { data: me } = useMe();
  const summary = useWs(qk.wsSummary, (b) => b.workspaceSummary());
  const signOut = useSignOut();
  const businessName = summary.data?.business.name;
  const user = me ?? { name: "…", role: "" };
  const resolvedSubtitle =
    subtitle ?? (businessName ? `${businessName} • ${summary.data?.business.plan ?? ""} plan` : "");

  const sidebar = (
    <div className="flex h-full flex-col gap-6 bg-sidebar p-4">
      <div className="px-1">
        <Brand tone="invert" />
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-sidebar-primary">
          {title}
        </p>
        {resolvedSubtitle ? (
          <p className="text-xs text-sidebar-foreground/60">{resolvedSubtitle}</p>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto pr-1">
        <NavList items={items} />
      </div>
      <div className="rounded-xl bg-sidebar-accent p-3">
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            <AvatarFallback className="bg-sidebar-primary text-xs text-sidebar-primary-foreground">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .slice(0, 2)
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-sidebar-accent-foreground">
              {user.name}
            </p>
            <p className="truncate text-xs capitalize text-sidebar-foreground/60">
              {admin
                ? "Platform administrator"
                : user.role === "owner"
                  ? "Business owner"
                  : user.role}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-1 text-xs text-sidebar-foreground/70 hover:text-sidebar-primary"
          >
            <ChevronLeft className="size-3" /> Back to directory
          </Link>
          <button
            className="flex items-center gap-1 text-xs text-sidebar-foreground/70 hover:text-destructive"
            onClick={() =>
              signOut.mutate(undefined, {
                onSuccess: () => {
                  toast.success("Signed out");
                  void window.location.assign("/");
                },
              })
            }
          >
            <LogOut className="size-3" /> Sign out
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur">
          <Sheet>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              {sidebar}
            </SheetContent>
          </Sheet>
          <p className="text-sm font-semibold">{title}</p>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              onClick={() => toast.info("No new notifications")}
            >
              <Bell className="size-4" />
            </Button>
            {backendMode() === "demo" ? (
              <Badge variant="outline" className="hidden sm:inline-flex">
                Demo data
              </Badge>
            ) : (
              <Badge variant="outline" className="hidden bg-primary/10 sm:inline-flex">
                Live
              </Badge>
            )}
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">
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
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}
