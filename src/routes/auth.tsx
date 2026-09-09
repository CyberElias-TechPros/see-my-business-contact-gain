/**
 * Sign in / create account / password reset, against the real API (`docs/FRONTEND.md`).
 *
 * Three rules shape this page:
 *
 * 1. **A failed sign-in must not say which half was wrong.** The Worker answers 401 with one
 *    generic string for "no such account" and "wrong password" alike (ADR-0003), so the copy here
 *    repeats that string instead of inventing something more specific. The reset form is worded
 *    the same way on purpose.
 * 2. **A session is a cookie the page cannot read.** Success is therefore followed by a *document*
 *    navigation (`window.location.assign`), not a client-side `navigate()`: the destination renders
 *    server-side with the cookie already attached, and every query cache starts clean. An SPA
 *    transition would leave anonymous-page data in that cache — `staleTime` would then serve a
 *    "not saved" toggle on a listing the visitor had saved before signing in, which is the kind of
 *    bug nobody finds until a user reports it.
 * 3. **`?next=` is a redirect we control.** `safeNext` (`src/lib/safe-next.ts`) accepts only a
 *    same-origin path that is not the auth page itself, and everything else collapses to `/app`;
 *    without it, this page turns every "sign in to continue" link into an open redirect.
 */
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";

import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiFailure, apiFetch } from "@/lib/api-client.ts";
import { sessionQuery, type Session } from "@/lib/queries.ts";
import { safeNext } from "@/lib/safe-next.ts";

const authSearch = z.object({
  // `next` stays an unvalidated string on purpose: `safeNext` is the security boundary, and a zod
  // `refine` here would silently drop the whole query object on an unexpected value, so the user
  // would lose the place they were going rather than being told.
  next: z.string().max(500).optional(),
  mode: z.enum(["signin", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (raw: Record<string, unknown>) => authSearch.parse(raw),
  head: () => ({
    meta: [
      { title: "Sign in or create an account — GainHub NG" },
      {
        name: "description",
        content:
          "Sign in to manage your saved businesses, enquiries and business workspace on GainHub NG.",
      },
      // Nothing here is worth indexing, and the URL gets pasted around by every "sign in to
      // continue" link — keep the PageRank on the destination, not on the form.
      { name: "robots", content: "noindex,nofollow" },
      { property: "og:title", content: "Sign in — GainHub NG" },
      {
        property: "og:description",
        content: "Access your account, saved businesses and business workspace.",
      },
    ],
  }),
  component: AuthPage,
});

/** Where a signed-in visitor goes when the page has nothing left to ask them. */
function goTo(target: string) {
  window.location.assign(target);
}

type Failure = { message: string; fields: Record<string, string> };

/**
 * API failures become one sentence plus per-field notes. 5xx and transport errors get the local
 * fallback because "internal_error: Something went wrong on our side" tells a visitor nothing
 * about what to do next; 429 gets the `Retry-After` the Worker sends, since waiting is the only
 * option and saying "try again" without it reads like a bug.
 */
function toFailure(error: unknown, fallback: string): Failure {
  if (!(error instanceof ApiFailure)) return { message: fallback, fields: {} };
  if (error.status >= 500) return { message: fallback, fields: error.formErrors };
  const retry = error.retryAfterSeconds;
  if (error.status === 429) {
    return {
      message: retry
        ? `Too many attempts from this device. Try again in ${retry < 120 ? `${retry} seconds` : "a few minutes"}.`
        : "Too many attempts from this device. Please wait a few minutes and try again.",
      fields: error.formErrors,
    };
  }
  return { message: error.message || fallback, fields: error.formErrors };
}

/** `| undefined` spelled out for `exactOptionalPropertyTypes`: a missing field error is absent. */
function FieldError({ message }: { message?: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

function AuthPage() {
  const search = Route.useSearch();
  // The root route loader already resolved the session on the server, so a visitor who is signed
  // in never sees this form: the cache is warm on first render and the effect below runs once.
  const { data: session } = useQuery(sessionQuery());
  const target = safeNext(search.next);
  const [tab, setTab] = useState<"signin" | "signup" | "forgot">(
    search.mode === "signup" || search.mode === "forgot" ? search.mode : "signin",
  );

  useEffect(() => {
    if (session?.user) goTo(target);
  }, [session?.user, target]);

  return (
    <PublicShell>
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {tab === "signup" ? "Create your account" : "Sign in to GainHub"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {tab === "signup"
              ? "An account keeps your saved businesses, sends enquiry replies to your WhatsApp, and lets you claim a listing as its owner."
              : "One account for your saved businesses, enquiry replies and business workspace."}
          </p>
        </div>

        <Card className="card-surface">
          <CardContent className="p-6">
            <Tabs
              value={tab}
              onValueChange={(value) => setTab(value as "signin" | "signup" | "forgot")}
            >
              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Create account
                </TabsTrigger>
                <TabsTrigger value="forgot" className="flex-1">
                  Reset
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="space-y-4 pt-6">
                <SignInForm onSignedIn={() => goTo(target)} />
                <p className="text-center text-xs text-muted-foreground">
                  Forgot your password?{" "}
                  <button
                    type="button"
                    onClick={() => setTab("forgot")}
                    className="text-primary underline-offset-4 hover:underline"
                  >
                    Send a reset link
                  </button>
                </p>
              </TabsContent>

              <TabsContent value="signup" className="space-y-4 pt-6">
                <SignUpForm onCreated={() => goTo(target)} />
                <p className="text-center text-xs text-muted-foreground">
                  Already the owner of a listing on GainHub?{" "}
                  <Link to="/join" className="text-primary">
                    Start onboarding instead
                  </Link>
                </p>
              </TabsContent>

              <TabsContent value="forgot" className="space-y-4 pt-6">
                <ForgotForm onDone={() => setTab("signin")} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link to="/legal/terms" className="text-primary">
            terms
          </Link>{" "}
          and{" "}
          <Link to="/legal/privacy" className="text-primary">
            privacy policy
          </Link>
          .
        </p>
      </div>
    </PublicShell>
  );
}

type Status = "idle" | "sending" | "done";

function SignInForm({ onSignedIn }: { onSignedIn: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<Failure | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setFailure(null);
    try {
      await apiFetch<Session>("/api/v1/auth/login", {
        method: "POST",
        // Login is what creates a session, so there is no CSRF token to send yet; asking
        // `apiFetch` to go and fetch one would be a wasted round trip before every sign-in.
        csrf: false,
        body: { identifier, password },
      });
      setStatus("done");
      onSignedIn();
    } catch (error) {
      setStatus("idle");
      setFailure(toFailure(error, "We could not sign you in right now. Try again in a moment."));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="identifier">Phone or email</Label>
        <Input
          id="identifier"
          name="identifier"
          className="mt-2"
          autoComplete="username"
          required
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          placeholder="0803 000 0000 or you@example.com"
        />
        <FieldError message={failure?.fields["identifier"]} />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          name="password"
          className="mt-2"
          autoComplete="current-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <FieldError message={failure?.fields["password"]} />
      </div>
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={status !== "idle"}>
        {status === "sending" ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        GainHub never sends a sign-in code over SMS or WhatsApp. If a message says otherwise, it is
        not from us.
      </p>
    </form>
  );
}

function SignUpForm({ onCreated }: { onCreated: () => void }) {
  const [values, setValues] = useState({
    displayName: "",
    email: "",
    phone: "",
    password: "",
    colour: "",
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<Failure | null>(null);

  const set = (key: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setValues((current) => ({ ...current, [key]: event.target.value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setFailure(null);
    try {
      // Register signs the visitor in as well (201 + `Set-Cookie`), so the redirect that follows
      // lands them inside their new account rather than back on the sign-in tab.
      await apiFetch("/api/v1/auth/register", {
        method: "POST",
        csrf: false,
        body: {
          displayName: values.displayName,
          email: values.email,
          phone: values.phone,
          password: values.password,
          role: "consumer",
          acceptedTerms,
          // The Worker's spam trap: any value here is answered with a fake success and no account.
          honeypot: values.colour,
        },
      });
      setStatus("done");
      onCreated();
    } catch (error) {
      setStatus("idle");
      setFailure(
        toFailure(
          error,
          "We could not create that account just now. Please try again in a moment.",
        ),
      );
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="displayName">Full name</Label>
        <Input
          id="displayName"
          name="displayName"
          className="mt-2"
          autoComplete="name"
          required
          minLength={2}
          maxLength={80}
          value={values.displayName}
          onChange={set("displayName")}
          placeholder="Chidi Okonkwo"
        />
        <FieldError message={failure?.fields["displayName"]} />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          name="email"
          className="mt-2"
          autoComplete="email"
          required
          maxLength={254}
          value={values.email}
          onChange={set("email")}
          placeholder="you@example.com"
        />
        <FieldError message={failure?.fields["email"]} />
      </div>
      <div>
        <Label htmlFor="phone">WhatsApp number</Label>
        <Input
          id="phone"
          name="phone"
          className="mt-2"
          autoComplete="tel"
          inputMode="tel"
          required
          value={values.phone}
          onChange={set("phone")}
          placeholder="0803 000 0000"
        />
        <FieldError message={failure?.fields["phone"]} />
        <p className="mt-1 text-xs text-muted-foreground">
          Enquiry replies land here, so use a number you can answer on WhatsApp.
        </p>
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          name="password"
          className="mt-2"
          autoComplete="new-password"
          required
          minLength={10}
          value={values.password}
          onChange={set("password")}
        />
        <FieldError message={failure?.fields["password"]} />
        <p className="mt-1 text-xs text-muted-foreground">
          Ten characters minimum. We store a PBKDF2 hash, never the password itself.
        </p>
      </div>
      {/*
        A spam trap, not a question. Bots fill every named input they find, so this one has a
        plausible name and is `sr-only` rather than `display:none` (some crawlers skip fields they
        can tell are hidden). A person never sees it.
      */}
      <div aria-hidden="true" className="sr-only">
        <Label htmlFor="colour">Favourite colour</Label>
        <Input
          id="colour"
          name="colour"
          tabIndex={-1}
          autoComplete="off"
          value={values.colour}
          onChange={set("colour")}
        />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-primary"
          checked={acceptedTerms}
          onChange={(event) => setAcceptedTerms(event.target.checked)}
        />
        <span>
          I agree to the terms and the community rules, and I will not use GainHub to message people
          who did not ask to be contacted.
        </span>
      </label>
      <FieldError message={failure?.fields["acceptedTerms"]} />
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={status !== "idle"}>
        {status === "sending" ? "Creating account…" : "Create account"}
      </Button>
      {status === "done" ? (
        <p role="status" className="text-center text-sm text-primary">
          Account created — opening your workspace…
        </p>
      ) : null}
    </form>
  );
}

function ForgotForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [failure, setFailure] = useState<Failure | null>(null);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus("sending");
    setFailure(null);
    try {
      await apiFetch("/api/v1/auth/password/forgot", {
        method: "POST",
        csrf: false,
        body: { email },
      });
      setStatus("done");
    } catch (error) {
      setStatus("idle");
      setFailure(toFailure(error, "We could not start a reset right now. Try again in a moment."));
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <Label htmlFor="reset-email">Email on the account</Label>
        <Input
          id="reset-email"
          type="email"
          name="email"
          className="mt-2"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <FieldError message={failure?.fields["email"]} />
      </div>
      {failure ? (
        <p role="alert" className="text-sm text-destructive">
          {failure.message}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={status !== "idle"}>
        {status === "sending" ? "Checking…" : "Send reset link"}
      </Button>
      {status === "done" ? (
        <div className="space-y-3">
          <p role="status" className="text-sm text-primary">
            If that email has a GainHub account, a reset link is on its way. It works once and
            expires in 30 minutes.
          </p>
          <Button type="button" variant="outline" className="w-full" onClick={onDone}>
            Back to sign in
          </Button>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          This always says “if that email has an account”, whether it does or not — so the form
          cannot be used to check which emails are registered.
        </p>
      )}
    </form>
  );
}
