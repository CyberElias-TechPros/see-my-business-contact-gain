import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useMe } from "@/lib/queries";

/**
 * Gate for the business workspace and admin console. Renders a friendly
 * sign-in card when the viewer isn't authorised instead of leaking demo data.
 */
export function RequireRole({ role, children }: { role: "owner" | "admin"; children: ReactNode }) {
  const { data: me, isLoading } = useMe();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (isLoading) {
    return (
      <Card className="card-surface mx-auto mt-10 max-w-md">
        <CardContent className="p-8 text-center text-sm text-muted-foreground">
          Checking your session…
        </CardContent>
      </Card>
    );
  }

  const authorised =
    me != null &&
    (role === "admin" ? me.role === "admin" : me.role === "owner" || me.role === "admin");

  if (!authorised) {
    return (
      <Card className="card-surface mx-auto mt-10 max-w-md">
        <CardContent className="space-y-3 p-8 text-center">
          <p className="text-lg font-semibold">
            {role === "admin" ? "Admin access only" : "Business workspace"}
          </p>
          <p className="text-sm text-muted-foreground">
            {me
              ? role === "admin"
                ? "This console is restricted to platform administrators."
                : "Sign in with the account that owns your business listing to manage leads, campaigns and your profile."
              : "Sign in to continue. Your session is protected with a secure cookie."}
          </p>
          <div className="flex justify-center gap-2 pt-2">
            <Button asChild>
              <Link to="/auth" search={{ redirect: pathname }}>
                Sign in
              </Link>
            </Button>
            {role === "owner" ? (
              <Button asChild variant="outline">
                <Link to="/join">List your business</Link>
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
