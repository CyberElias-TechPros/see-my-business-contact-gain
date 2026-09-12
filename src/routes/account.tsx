import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Bookmark, Building2, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BusinessCard } from "@/components/kit";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useSession } from "@/hooks/use-session";
import { apiRequest } from "@/lib/api";
import type { PublicBusiness } from "@/lib/contracts";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "My GainHub account" },
      {
        name: "description",
        content: "Manage your private GainHub account and saved business shortlist.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: AccountPage,
});

function SignedOut() {
  return (
    <Card className="card-surface mx-auto max-w-2xl border-dashed">
      <CardContent className="grid min-h-80 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-secondary text-primary">
            <UserRound className="size-6" />
          </span>
          <h2 className="mt-5 text-3xl font-bold">This page belongs to you.</h2>
          <p className="mx-auto mt-3 max-w-md leading-7 text-muted-foreground">
            Sign in to see a private shortlist and your account routes. We never substitute demo
            records for personal data.
          </p>
          <Button asChild size="lg" className="mt-7">
            <Link to="/auth" search={{ next: "/account" }}>
              Sign in securely <ArrowRight />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AccountPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const user = session.data?.user ?? null;
  const saved = useQuery({
    queryKey: ["saved-businesses"],
    queryFn: () => apiRequest<{ items: PublicBusiness[] }>("/v1/me/saved-businesses"),
    enabled: Boolean(user),
    retry: false,
  });

  async function signOut() {
    await apiRequest("/v1/auth/logout", { method: "POST" });
    queryClient.clear();
    window.location.assign("/");
  }

  return (
    <PublicShell>
      <PageHead
        eyebrow="Private account"
        title={
          user ? `Welcome, ${user.fullName.split(" ")[0] ?? user.fullName}` : "Your GainHub account"
        }
        subtitle={
          user
            ? "Your saved routes and account controls—without placeholder activity."
            : "Sign in to continue."
        }
        action={
          user ? (
            <Button variant="outline" onClick={() => void signOut()}>
              <LogOut /> Sign out
            </Button>
          ) : undefined
        }
      />
      <div className="mx-auto max-w-7xl px-5 py-12">
        {session.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="card-surface h-64 animate-pulse bg-muted" />
            <div className="card-surface h-64 animate-pulse bg-muted" />
          </div>
        ) : !user ? (
          <SignedOut />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_21rem]">
            <section aria-labelledby="saved-heading">
              <div className="flex items-end justify-between border-b pb-5">
                <div>
                  <p className="eyebrow text-primary">Shortlist</p>
                  <h2 id="saved-heading" className="mt-2 text-3xl font-bold">
                    Saved businesses
                  </h2>
                </div>
                <Bookmark className="size-5 text-primary" />
              </div>
              {saved.isLoading ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <div className="card-surface h-72 animate-pulse bg-muted" />
                  <div className="card-surface h-72 animate-pulse bg-muted" />
                </div>
              ) : saved.data?.items.length ? (
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {saved.data.items.map((business) => (
                    <BusinessCard key={business.id} business={business} />
                  ))}
                </div>
              ) : (
                <div className="mt-6 rounded-2xl border border-dashed p-8 text-center">
                  <h3 className="text-xl font-bold">No saved businesses yet</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Save a live profile to build a private shortlist here.
                  </p>
                  <Button asChild variant="outline" className="mt-5">
                    <Link to="/search" search={{ page: 1 }}>
                      Browse the directory
                    </Link>
                  </Button>
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <Card className="card-surface">
                <CardContent className="space-y-4 p-6 text-sm">
                  <span className="grid size-11 place-items-center rounded-2xl bg-secondary text-primary">
                    <UserRound className="size-5" />
                  </span>
                  <div>
                    <p className="font-bold">{user.fullName}</p>
                    <p className="mt-1 break-all text-muted-foreground">
                      {user.email ?? user.phone}
                    </p>
                  </div>
                  <div className="border-t pt-4">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <ShieldCheck className="size-4 text-primary" /> Secure server session
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="card-surface">
                <CardContent className="space-y-3 p-6">
                  <p className="font-bold">Business owner?</p>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Open your workspace or submit a new listing for review.
                  </p>
                  <Button asChild className="w-full">
                    <Link to="/app">
                      <Building2 /> Business workspace
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full">
                    <Link to="/join">Submit a listing</Link>
                  </Button>
                </CardContent>
              </Card>
              <div className="rounded-2xl border border-dashed p-5 text-sm">
                <p className="font-bold">Your data, your rights</p>
                <p className="mt-2 leading-6 text-muted-foreground">
                  Request access, correction, portability or deletion through the verified account
                  flow.
                </p>
                <Button asChild variant="link" className="mt-3">
                  <Link to="/legal/data-request">
                    Open data requests <ArrowRight />
                  </Link>
                </Button>
              </div>
            </aside>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
