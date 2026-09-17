import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  Bookmark,
  Building2,
  Check,
  LogOut,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { BusinessCard, EmptyState } from "@/components/kit";
import { FieldError, FormFeedback } from "@/components/forms/FormFeedback";
import { Reveal } from "@/components/motion";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/hooks/use-session";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest, jsonBody } from "@/lib/api";
import type { NotificationList, PublicBusiness } from "@/lib/contracts";
import { publicConfig } from "@/lib/public-config";

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

/* -------------------------------------------------------------------------- */
/* Notifications                                                               */
/* -------------------------------------------------------------------------- */

function NotificationsPanel() {
  const queryClient = useQueryClient();
  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiRequest<NotificationList>("/v1/notifications"),
    retry: false,
  });

  const markRead = useMutation({
    mutationFn: () =>
      apiRequest("/v1/notifications/read", { method: "POST", body: jsonBody({ all: true }) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const items = notifications.data?.items ?? [];
  const unread = notifications.data?.unreadCount ?? 0;

  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <Bell className="size-4 text-primary" aria-hidden="true" /> Notifications
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Updates about your listings, claims and applications.
            </p>
          </div>
          {unread > 0 ? (
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {unread} new
            </Badge>
          ) : null}
        </div>

        {items.length ? (
          <>
            <ul className="mt-5 divide-y border-t border-border/60">
              {items.slice(0, 6).map((notification) => (
                <li key={notification.id} className="py-3.5">
                  <Link
                    to={notification.href}
                    className="group block rounded-lg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
                  >
                    <p className="flex items-start gap-2 text-sm font-semibold">
                      {notification.readAt ? null : (
                        <span
                          className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                      <span className="transition-colors group-hover:text-primary">
                        {notification.title}
                      </span>
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {notification.body}
                    </p>
                    <p className="mt-1 text-[0.68rem] text-muted-foreground/70">
                      {new Date(notification.createdAt).toLocaleString("en-NG", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            {unread > 0 ? (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                disabled={markRead.isPending}
                onClick={() => markRead.mutate()}
              >
                <Check /> Mark all as read
              </Button>
            ) : null}
          </>
        ) : (
          <p className="mt-5 border-t border-border/60 pt-5 text-sm text-muted-foreground">
            Nothing here yet. Updates appear when something changes on your listings or
            applications.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Profile                                                                     */
/* -------------------------------------------------------------------------- */

function ProfileCard() {
  const session = useSession();
  const queryClient = useQueryClient();
  const submission = useSubmission();
  const user = session.data?.user;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await submission.submit(
      () =>
        apiRequest("/v1/me", {
          method: "PATCH",
          body: jsonBody({
            fullName: String(form.get("fullName") ?? ""),
            email: String(form.get("email") ?? ""),
            phone: String(form.get("phone") ?? ""),
          }),
        }),
      "Your account details were updated.",
    );
    if (submission.state.status !== "error") {
      void queryClient.invalidateQueries({ queryKey: ["session"] });
    }
  }

  if (!user) return null;

  return (
    <Card className="rounded-3xl border-border/70">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-secondary text-primary">
            <UserRound className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate font-bold">{user.fullName}</p>
            <p className="mt-0.5 truncate text-sm text-muted-foreground">
              {user.email ?? user.phone}
            </p>
          </div>
        </div>

        <form
          className="mt-6 space-y-4 border-t border-border/60 pt-6"
          onSubmit={onSubmit}
          noValidate
        >
          <div>
            <Label htmlFor="account-name">Full name</Label>
            <Input
              id="account-name"
              name="fullName"
              defaultValue={user.fullName}
              minLength={2}
              maxLength={100}
              required
              className="mt-2"
              aria-describedby="account-name-error"
            />
            <FieldError id="account-name-error" message={submission.fieldError("fullName")} />
          </div>
          <div>
            <Label htmlFor="account-email">Email address</Label>
            <Input
              id="account-email"
              name="email"
              type="email"
              defaultValue={user.email ?? ""}
              className="mt-2"
              aria-describedby="account-email-error"
            />
            <FieldError id="account-email-error" message={submission.fieldError("email")} />
          </div>
          <div>
            <Label htmlFor="account-phone">Phone number</Label>
            <Input
              id="account-phone"
              name="phone"
              type="tel"
              defaultValue={user.phone ?? ""}
              className="mt-2"
              aria-describedby="account-phone-error"
            />
            <FieldError id="account-phone-error" message={submission.fieldError("phone")} />
          </div>

          <FormFeedback
            status={submission.state.status}
            message={submission.state.message}
            {...("requestId" in submission.state ? { requestId: submission.state.requestId } : {})}
          />

          <Button type="submit" size="sm" disabled={submission.isSubmitting}>
            {submission.isSubmitting ? "Saving…" : "Save details"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

function SignedOut() {
  return (
    <EmptyState
      icon={<UserRound className="size-7" />}
      title="This page belongs to you."
      body="Sign in to see your private shortlist, notifications and account routes. We never substitute demo records for personal data."
      action={
        <Button asChild size="lg">
          <Link to="/auth" search={{ next: "/account" }}>
            Sign in securely <ArrowRight />
          </Link>
        </Button>
      }
    />
  );
}

function AccountPage() {
  const session = useSession();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const user = session.data?.user ?? null;

  const saved = useQuery({
    queryKey: ["saved-businesses"],
    queryFn: () => apiRequest<{ items: PublicBusiness[] }>("/v1/me/saved-businesses"),
    enabled: Boolean(user),
    retry: false,
  });

  async function signOut() {
    setSigningOut(true);
    await apiRequest("/v1/auth/logout", { method: "POST" }).catch(() => undefined);
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
            ? "Your saved routes, notifications and account controls—without placeholder activity."
            : "Sign in to continue."
        }
        action={
          user ? (
            <Button variant="outline" onClick={() => void signOut()} disabled={signingOut}>
              <LogOut /> {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-7xl px-5 py-16">
        {session.isLoading ? (
          <div className="grid gap-5 sm:grid-cols-2">
            {Array.from({ length: 2 }).map((_, index) => (
              <div key={index} className="h-64 animate-pulse rounded-3xl bg-muted" />
            ))}
          </div>
        ) : !user ? (
          <SignedOut />
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1fr_21rem]">
            <section aria-labelledby="saved-heading" className="min-w-0">
              <Reveal>
                <div className="flex items-end justify-between gap-4 border-b border-border/60 pb-5">
                  <div>
                    <p className="eyebrow text-primary">Shortlist</p>
                    <h2 id="saved-heading" className="display-md mt-3">
                      Saved businesses
                    </h2>
                  </div>
                  <Bookmark className="size-5 shrink-0 text-primary" aria-hidden="true" />
                </div>
              </Reveal>

              {saved.isLoading ? (
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="h-72 animate-pulse rounded-3xl bg-muted" />
                  ))}
                </div>
              ) : saved.data?.items.length ? (
                <div className="mt-7 grid gap-5 sm:grid-cols-2">
                  {saved.data.items.map((business, index) => (
                    <Reveal key={business.id} delay={index % 2} className="h-full">
                      <BusinessCard business={business} />
                    </Reveal>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={<Bookmark className="size-7" />}
                  title="No saved businesses yet"
                  body="Save a live profile to build a private shortlist here."
                  action={
                    <Button asChild variant="outline">
                      <Link to="/search" search={{ page: 1 }}>
                        Browse the directory
                      </Link>
                    </Button>
                  }
                />
              )}
            </section>

            <aside className="space-y-5">
              <Reveal>
                <ProfileCard />
              </Reveal>

              <Reveal delay={1}>
                <NotificationsPanel />
              </Reveal>

              <Reveal delay={2}>
                <Card className="rounded-3xl border-border/70">
                  <CardContent className="space-y-3 p-6">
                    <p className="font-bold">Business owner?</p>
                    <p className="text-sm leading-6 text-muted-foreground">
                      Open your workspace to edit listings and work enquiries, or submit a new
                      listing for review.
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
              </Reveal>

              <Reveal delay={3}>
                <Card className="rounded-3xl border-dashed border-border/70 bg-muted/25">
                  <CardContent className="p-6">
                    <p className="flex items-center gap-2 font-bold">
                      <ShieldCheck className="size-4 text-primary" aria-hidden="true" /> Your data,
                      your rights
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      Request access, correction, portability or deletion through the verified
                      account flow.
                      {publicConfig.privacyEmail
                        ? ` You can also write to ${publicConfig.privacyEmail}.`
                        : ""}
                    </p>
                    <Button asChild variant="link" className="mt-2 px-0">
                      <Link to="/legal/data-request">
                        Open data requests <ArrowRight />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </Reveal>
            </aside>
          </div>
        )}
      </div>
    </PublicShell>
  );
}
