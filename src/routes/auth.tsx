import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { backendMode } from "@/lib/api";
import { useMe, useSignIn, useSignUp } from "@/lib/queries";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search["redirect"] === "string" ? search["redirect"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in or create an account — GainHub NG" },
      {
        name: "description",
        content:
          "Sign in to manage your saved businesses, enquiries and business workspace on GainHub NG.",
      },
      { property: "og:title", content: "Sign in — GainHub NG" },
      {
        property: "og:description",
        content: "Access your account, saved businesses and business workspace.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { data: me } = useMe();
  const signIn = useSignIn();
  const signUp = useSignUp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (me) {
      void navigate({ to: redirect ?? (me.role === "admin" ? "/admin" : "/app"), replace: true });
    }
  }, [me, navigate, redirect]);

  const busy = signIn.isPending || signUp.isPending;

  return (
    <PublicShell>
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16">
        <Card className="card-surface">
          <CardContent className="p-6">
            <Tabs defaultValue="signin">
              <TabsList className="w-full">
                <TabsTrigger value="signin" className="flex-1">
                  Sign in
                </TabsTrigger>
                <TabsTrigger value="signup" className="flex-1">
                  Create account
                </TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-4 pt-6">
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    signIn.mutate(
                      { email, password },
                      {
                        onSuccess: (user) => {
                          toast.success(`Welcome back, ${user.name.split(" ")[0]}!`);
                          void navigate({
                            to: redirect ?? (user.role === "admin" ? "/admin" : "/app"),
                            replace: true,
                          });
                        },
                      },
                    );
                  }}
                >
                  <div>
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      required
                      className="mt-2"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      required
                      className="mt-2"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {signIn.isPending ? "Signing in…" : "Sign in"}
                  </Button>
                </form>
                {backendMode() === "demo" ? (
                  <div className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Demo mode</p>
                    <p>
                      Business owner: <code>chidi@swiftfix.ng</code> / <code>demo1234</code>
                      <br />
                      Admin: <code>admin@gainhub.ng</code> / <code>admin1234</code>
                    </p>
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">
                    Forgot your password?{" "}
                    <a className="text-primary" href="/legal/data-request">
                      Request a reset
                    </a>
                  </p>
                )}
              </TabsContent>
              <TabsContent value="signup" className="space-y-4 pt-6">
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    signUp.mutate(
                      { name, email, password, ...(phone ? { phone } : {}) },
                      {
                        onSuccess: (user) => {
                          toast.success(`Welcome to GainHub, ${user.name.split(" ")[0]}!`);
                          void navigate({ to: redirect ?? "/join", replace: true });
                        },
                      },
                    );
                  }}
                >
                  <div>
                    <Label htmlFor="signup-name">Full name</Label>
                    <Input
                      id="signup-name"
                      required
                      className="mt-2"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      required
                      className="mt-2"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-phone">
                      WhatsApp number <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Input
                      id="signup-phone"
                      className="mt-2"
                      placeholder="0803 000 0000"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="signup-password">
                      Password <span className="text-muted-foreground">(min 8 characters)</span>
                    </Label>
                    <Input
                      id="signup-password"
                      type="password"
                      required
                      minLength={8}
                      className="mt-2"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {signUp.isPending ? "Creating account…" : "Create account"}
                  </Button>
                </form>
                <p className="text-center text-xs text-muted-foreground">
                  Listing a business?{" "}
                  <Link to="/join" className="text-primary">
                    Start onboarding
                  </Link>
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
