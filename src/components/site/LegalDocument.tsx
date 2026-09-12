import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { publicConfig } from "@/lib/public-config";

export const POLICY_UPDATED = "12 September 2026";

export function PolicyDocument({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-4xl space-y-5 px-4 py-12">{children}</div>;
}

export function PolicySection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28 border-t pt-8 first:border-0 first:pt-0">
      <h2 className="font-display text-2xl font-bold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">{children}</div>
    </section>
  );
}

export function PolicyList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

export function OperatorNotice() {
  if (publicConfig.legalOperatorName && publicConfig.privacyEmail) {
    return (
      <Card className="card-surface border-primary/25 bg-primary/[0.035]">
        <CardContent className="p-5 text-sm leading-6">
          <p className="font-semibold text-foreground">Service operator</p>
          <p className="mt-1 text-muted-foreground">
            {publicConfig.legalOperatorName} operates GainHub NG. Privacy correspondence can be sent
            to{" "}
            <a
              className="link-underline font-medium text-primary"
              href={`mailto:${publicConfig.privacyEmail}`}
            >
              {publicConfig.privacyEmail}
            </a>
            .
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-amber-300/70 bg-amber-50/70 text-amber-950">
      <CardContent className="flex items-start gap-3 p-5 text-sm leading-6">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-semibold">Public-launch identity is not configured.</p>
          <p className="mt-1 text-amber-900/80">
            This deployment must publish the operator&apos;s legal name and a monitored privacy
            address before accepting public users. Repository maintainers should set the documented
            production environment variables; these details are intentionally not invented.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function DataRequestLink() {
  return (
    <Link
      className="link-underline inline-flex items-center gap-1 font-semibold text-primary"
      to="/legal/data-request"
    >
      Open the personal-data request form <ArrowUpRight className="size-3.5" aria-hidden="true" />
    </Link>
  );
}
