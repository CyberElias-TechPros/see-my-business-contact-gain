import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, KeyRound, LockKeyhole, ShieldCheck, UserPlus } from "lucide-react";
import { type FormEvent } from "react";
import { z } from "zod";
import { FieldError, FormFeedback } from "@/components/forms/FormFeedback";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSubmission } from "@/hooks/use-submission";
import { apiRequest, jsonBody } from "@/lib/api";

const authSearchSchema = z.object({
  next: z
    .string()
    .max(300)
    .refine((value) => value.startsWith("/") && !value.startsWith("//"))
    .optional()
    .catch(undefined),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => authSearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in or create an account — GainHub NG" },
      {
        name: "description",
        content:
          "Securely access saved businesses, listing applications and your GainHub business workspace.",
      },
      { name: "robots", content: "noindex, follow" },
    ],
  }),
  component: AuthPage,
});

function SignInForm({ next }: { next: string }) {
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const success = await submission.submit(
      () =>
        apiRequest("/v1/auth/login", {
          method: "POST",
          body: jsonBody({ identity: data.get("identity"), password: data.get("password") }),
        }),
      "Signed in. Taking you to your account…",
    );
    if (success) window.location.assign(next);
  }

  return (
    <form className="space-y-4 pt-6" onSubmit={(event) => void onSubmit(event)} noValidate>
      <div className="block">
        <Label htmlFor="signin-identity">Email or phone</Label>
        <Input
          id="signin-identity"
          name="identity"
          autoComplete="username"
          className="mt-2"
          aria-invalid={Boolean(submission.fieldError("identity"))}
          aria-describedby={submission.fieldError("identity") ? "signin-identity-error" : undefined}
          required
        />
        <FieldError id="signin-identity-error" message={submission.fieldError("identity")} />
      </div>
      <div className="block">
        <Label htmlFor="signin-password">Password</Label>
        <Input
          id="signin-password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="mt-2"
          aria-invalid={Boolean(submission.fieldError("password"))}
          required
        />
        <FieldError id="signin-password-error" message={submission.fieldError("password")} />
      </div>
      <FormFeedback
        status={submission.state.status}
        message={submission.state.message}
        {...(submission.state.status === "error" && submission.state.requestId
          ? { requestId: submission.state.requestId }
          : {})}
      />
      <Button type="submit" size="lg" className="w-full" disabled={submission.isSubmitting}>
        <KeyRound /> {submission.isSubmitting ? "Checking…" : "Sign in"}
      </Button>
      <p className="text-center text-xs leading-5 text-muted-foreground">
        Password recovery needs identity verification. Visit the{" "}
        <Link to="/help" className="font-bold text-primary hover:underline">
          help centre
        </Link>{" "}
        if you are locked out.
      </p>
    </form>
  );
}

function RegisterForm({ next }: { next: string }) {
  const submission = useSubmission();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const success = await submission.submit(
      () =>
        apiRequest("/v1/auth/register", {
          method: "POST",
          body: jsonBody({
            fullName: data.get("fullName"),
            email: data.get("email"),
            phone: data.get("phone"),
            password: data.get("password"),
            acceptedTerms: data.get("acceptedTerms") === "on",
          }),
        }),
      "Account created. Taking you to your account…",
    );
    if (success) window.location.assign(next);
  }

  return (
    <form className="space-y-4 pt-6" onSubmit={(event) => void onSubmit(event)} noValidate>
      <div className="block">
        <Label htmlFor="register-name">Full name</Label>
        <Input
          id="register-name"
          name="fullName"
          autoComplete="name"
          className="mt-2"
          aria-invalid={Boolean(submission.fieldError("fullName"))}
          required
        />
        <FieldError id="register-name-error" message={submission.fieldError("fullName")} />
      </div>
      <div className="block">
        <Label htmlFor="register-email">Email</Label>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          className="mt-2"
          aria-invalid={Boolean(submission.fieldError("email"))}
        />
        <FieldError id="register-email-error" message={submission.fieldError("email")} />
      </div>
      <div className="block">
        <Label htmlFor="register-phone">Phone / WhatsApp</Label>
        <Input
          id="register-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="mt-2"
          placeholder="+234…"
          aria-invalid={Boolean(submission.fieldError("phone"))}
        />
        <FieldError id="register-phone-error" message={submission.fieldError("phone")} />
        <p className="mt-1.5 text-xs text-muted-foreground">Add at least one: email or phone.</p>
      </div>
      <div className="block">
        <Label htmlFor="register-password">Password</Label>
        <Input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={12}
          maxLength={128}
          className="mt-2"
          aria-invalid={Boolean(submission.fieldError("password"))}
          aria-describedby="password-hint"
          required
        />
        <p id="password-hint" className="mt-1.5 text-xs leading-5 text-muted-foreground">
          At least 12 characters with uppercase, lowercase and a number.
        </p>
        <FieldError id="register-password-error" message={submission.fieldError("password")} />
      </div>
      <label className="flex items-start gap-3 rounded-xl border bg-muted/45 p-3 text-xs leading-5">
        <input
          type="checkbox"
          name="acceptedTerms"
          className="mt-0.5 size-4 shrink-0 accent-primary"
          required
        />
        <span>
          I agree to the{" "}
          <Link to="/legal/terms" className="font-bold text-primary hover:underline">
            terms
          </Link>{" "}
          and{" "}
          <Link to="/legal/privacy" className="font-bold text-primary hover:underline">
            privacy policy
          </Link>
          .
        </span>
      </label>
      <FieldError id="register-terms-error" message={submission.fieldError("acceptedTerms")} />
      <FormFeedback
        status={submission.state.status}
        message={submission.state.message}
        {...(submission.state.status === "error" && submission.state.requestId
          ? { requestId: submission.state.requestId }
          : {})}
      />
      <Button type="submit" size="lg" className="w-full" disabled={submission.isSubmitting}>
        <UserPlus /> {submission.isSubmitting ? "Creating account…" : "Create secure account"}
      </Button>
    </form>
  );
}

function AuthPage() {
  const next = Route.useSearch().next ?? "/account";
  return (
    <PublicShell>
      <div className="paper-grid relative overflow-hidden">
        <div className="mx-auto grid min-h-[42rem] max-w-7xl items-center gap-10 px-5 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:py-20">
          <div className="max-w-lg">
            <p className="eyebrow text-primary">Your private GainHub</p>
            <h1 className="mt-4 text-5xl font-extrabold leading-[0.92] md:text-6xl">
              Keep every useful connection within reach.
            </h1>
            <p className="mt-5 text-lg leading-8 text-muted-foreground">
              Save businesses, follow listing applications and access a workspace protected by
              server-side sessions.
            </p>
            <div className="mt-8 space-y-4 border-t pt-6">
              {[
                { icon: LockKeyhole, text: "Passwords are derived with PBKDF2 and unique salts." },
                {
                  icon: ShieldCheck,
                  text: "Session tokens are hashed at rest and held in secure, HTTP-only cookies.",
                },
                { icon: KeyRound, text: "Sign-in errors do not reveal whether an account exists." },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-start gap-3 text-sm text-muted-foreground"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary text-primary">
                    <item.icon className="size-4" />
                  </span>
                  <p className="pt-2 leading-6">{item.text}</p>
                </div>
              ))}
            </div>
          </div>

          <Card className="card-surface mx-auto w-full max-w-lg overflow-hidden shadow-lift">
            <div className="network-stage p-6 text-ink-foreground">
              <p className="eyebrow text-sidebar-primary">Secure access</p>
              <h2 className="mt-3 text-2xl font-bold">Welcome to your side of the map.</h2>
            </div>
            <CardContent className="p-6 sm:p-8">
              <Tabs defaultValue="signin">
                <TabsList className="grid h-12 w-full grid-cols-2 rounded-xl bg-muted p-1">
                  <TabsTrigger value="signin" className="rounded-lg">
                    Sign in
                  </TabsTrigger>
                  <TabsTrigger value="signup" className="rounded-lg">
                    Create account
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <SignInForm next={next} />
                </TabsContent>
                <TabsContent value="signup">
                  <RegisterForm next={next} />
                </TabsContent>
              </Tabs>
              <div className="mt-6 border-t pt-5 text-center text-xs text-muted-foreground">
                Listing a business?{" "}
                <Link
                  to="/join"
                  className="inline-flex items-center gap-1 font-bold text-primary hover:underline"
                >
                  Start with the free listing form <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </PublicShell>
  );
}
