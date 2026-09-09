import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
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
                <div>
                  <Label>Phone or email</Label>
                  <Input className="mt-2" placeholder="0803 000 0000" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" className="mt-2" />
                </div>
                <Button className="w-full">Sign in</Button>
                <Button variant="outline" className="w-full">
                  Send WhatsApp OTP instead
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Forgot your password? <span className="text-primary">Reset it</span>
                </p>
              </TabsContent>
              <TabsContent value="signup" className="space-y-4 pt-6">
                <div>
                  <Label>Full name</Label>
                  <Input className="mt-2" />
                </div>
                <div>
                  <Label>WhatsApp number</Label>
                  <Input className="mt-2" placeholder="0803 000 0000" />
                </div>
                <div>
                  <Label>Password</Label>
                  <Input type="password" className="mt-2" />
                </div>
                <Button className="w-full">Create account</Button>
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
