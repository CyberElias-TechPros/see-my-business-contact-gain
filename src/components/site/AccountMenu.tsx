/**
 * The header's account control: a Sign in link while anonymous, a menu once the session cookie
 * resolves to a user.
 *
 * It renders from `sessionQuery()`, which the root route loader already filled during SSR — so the
 * signed-in state is in the HTML the crawler and the visitor both receive, and the button never
 * swaps from "Sign in" to an avatar a frame after hydration. That is the whole reason the read goes
 * through the server function rather than a `useEffect` fetch.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronDown, LayoutDashboard, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { sessionQuery } from "@/lib/queries.ts";
import { useSignOut } from "@/lib/session-actions.ts";

export function AccountMenu() {
  const { data: session } = useQuery(sessionQuery());
  const signOut = useSignOut();
  const [signingOut, setSigningOut] = useState(false);

  const user = session?.user ?? null;

  if (!user) {
    return (
      <Button asChild variant="ghost" className="hidden sm:inline-flex">
        <Link to="/auth">Sign in</Link>
      </Button>
    );
  }

  const workspace = session?.memberships?.[0];
  // Two letters read better than an emoji initial in a 28px circle, and `Array.from` keeps a
  // composed character intact rather than slicing a surrogate pair in half.
  const initials = user.displayName
    .split(/\s+/u)
    .map((part: string) => Array.from(part)[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 pr-2 sm:pr-3">
          <span
            aria-hidden="true"
            className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
          >
            {initials || "•"}
          </span>
          <span className="hidden max-w-32 truncate sm:inline">{user.displayName}</span>
          <ChevronDown className="size-4 opacity-60" aria-hidden="true" />
          <span className="sr-only">Account menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{user.displayName}</span>
          <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          {user.emailVerified ? null : (
            <span className="text-xs font-normal text-amber-600">
              Email not verified yet — the link in your inbox turns “pending” into a badge buyers
              can see.
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {workspace ? (
          <DropdownMenuItem asChild>
            <Link to="/app">
              <LayoutDashboard className="mr-2 size-4" aria-hidden="true" />
              <span className="truncate">{workspace.businessName}</span>
            </Link>
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem asChild>
            <Link to="/claim">
              <LayoutDashboard className="mr-2 size-4" aria-hidden="true" />
              Claim a listing
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link to="/account">
            <UserRound className="mr-2 size-4" aria-hidden="true" />
            My account
          </Link>
        </DropdownMenuItem>
        {user.role === "admin" ? (
          <DropdownMenuItem asChild>
            <Link to="/admin">
              <ShieldCheck className="mr-2 size-4" aria-hidden="true" />
              Admin console
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => {
            setSigningOut(true);
            void signOut()
              .catch(() => undefined)
              .finally(() => setSigningOut(false));
          }}
        >
          <LogOut className="mr-2 size-4" aria-hidden="true" />
          {signingOut ? "Signing out…" : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
