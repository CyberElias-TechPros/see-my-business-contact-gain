import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowUpRight, FileText } from "lucide-react";
import { Children, isValidElement, type ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { publicConfig } from "@/lib/public-config";

export const POLICY_UPDATED = "12 September 2026";

/* -------------------------------------------------------------------------- */
/* Document shell                                                              */
/* -------------------------------------------------------------------------- */

/**
 * Policy pages are long by necessity, so the shell does three things: it keeps
 * the reading measure narrow, it builds a section index from the sections
 * themselves (no duplicated list to drift out of sync), and it keeps that index
 * beside the text on wide screens.
 */
export function PolicyDocument({ children }: { children: ReactNode }) {
  const sections = Children.toArray(children)
    .filter(
      (child): child is React.ReactElement<{ id: string; title: string }> =>
        isValidElement(child) && child.type === PolicySection,
    )
    .map((child) => ({ id: child.props.id, title: child.props.title }));

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 lg:grid-cols-[15rem_1fr] lg:gap-14 lg:py-16">
      {sections.length > 1 ? (
        <nav
          aria-label="On this page"
          className="hidden lg:sticky lg:top-28 lg:block lg:h-fit lg:self-start"
        >
          <p className="eyebrow flex items-center gap-2 text-muted-foreground">
            <FileText className="size-3.5" aria-hidden="true" /> On this page
          </p>
          <ol className="mt-4 space-y-1 border-l border-border/60">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="-ml-px block border-l-2 border-transparent py-1.5 pl-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
      ) : (
        <div className="hidden lg:block" />
      )}

      <div className="min-w-0 space-y-10">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Section                                                                     */
/* -------------------------------------------------------------------------- */

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
    <section
      id={id}
      className="scroll-mt-28 border-t border-border/60 pt-8 first:border-0 first:pt-0"
    >
      <h2 className="font-display text-2xl font-extrabold tracking-[-0.03em] text-foreground">
        {title}
      </h2>
      {/* The prose styles live here rather than on each paragraph so the legal
          copy stays readable in the editor too. */}
      <div className="mt-4 space-y-4 text-[0.975rem] leading-7 text-muted-foreground [&_a]:font-semibold [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_p]:max-w-[68ch] [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:max-w-[68ch]">
        {children}
      </div>
    </section>
  );
}

export function PolicyList({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-2.5 pl-5">{children}</ul>;
}

/* -------------------------------------------------------------------------- */
/* Operator notice                                                             */
/* -------------------------------------------------------------------------- */

export function OperatorNotice() {
  if (publicConfig.legalOperatorName && publicConfig.privacyEmail) {
    return (
      <Card className="rounded-3xl border-primary/25 bg-primary/[0.035]">
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
    <Card className="rounded-3xl border-warning/45 bg-warning/8">
      <CardContent className="flex items-start gap-3 p-5 text-sm leading-6">
        <AlertTriangle
          className="mt-0.5 size-5 shrink-0 text-warning-foreground"
          aria-hidden="true"
        />
        <div>
          <p className="font-semibold text-foreground">Public-launch identity is not configured.</p>
          <p className="mt-1 text-muted-foreground">
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
