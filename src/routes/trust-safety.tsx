import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, CheckCircle2, Eye, FileLock2, Flag, ShieldCheck } from "lucide-react";
import { Reveal } from "@/components/motion";
import { Callout, CtaBand, EditorialSection, FeatureGrid } from "@/components/site/editorial";
import { PageHead, PublicShell } from "@/components/site/PublicShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/trust-safety")({
  head: () => ({
    meta: [
      { title: "Trust and safety — GainHub NG" },
      {
        name: "description",
        content:
          "Understand GainHub NG verification labels, moderation boundaries, private evidence handling and the route for reporting fraud, impersonation or inaccurate listings.",
      },
      { property: "og:title", content: "Trust and safety — GainHub NG" },
      {
        property: "og:description",
        content: "What is checked, what is not guaranteed and how to report a concern privately.",
      },
    ],
  }),
  component: TrustSafetyPage,
});

const labels = [
  {
    label: "Unverified",
    meaning: "No higher verification level is currently recorded for this profile.",
    not: "It does not automatically mean the business is unsafe or illegitimate.",
  },
  {
    label: "Contact verified",
    meaning: "A contact-channel check has been recorded for the business.",
    not: "It does not verify every service, staff member, licence, price or future response.",
  },
  {
    label: "Identity verified",
    meaning:
      "Identity or ownership evidence has been reviewed for the relevant account or listing.",
    not: "It is not a guarantee of workmanship, solvency or a successful transaction.",
  },
  {
    label: "Premium verified",
    meaning:
      "An enhanced verification state is recorded under the operator's documented review process.",
    not: "The current product does not sell this label or let an applicant assign it to themselves.",
  },
];

const controls = [
  {
    icon: Eye,
    title: "Reviewed publication",
    text: "Listing applications begin in a review state. Submission alone does not put a profile into live search.",
  },
  {
    icon: FileLock2,
    title: "Private claim evidence",
    text: "Ownership evidence accepts bounded PDF or image files, requires an account and is stored away from public profile delivery.",
  },
  {
    icon: Flag,
    title: "Structured reports",
    text: "Scam, impersonation, abuse, closure and accuracy concerns enter a moderation queue with a request reference.",
  },
  {
    icon: ShieldCheck,
    title: "Restricted decisions",
    text: "Private workspaces check real sessions; aggregate moderation data is limited to the platform-admin role.",
  },
];

function TrustSafetyPage() {
  return (
    <PublicShell>
      <PageHead
        eyebrow="Trust & safety"
        title="Trust labels should shrink uncertainty—not hide it."
        subtitle="See exactly what a label means, make your own checks and use a private route when something looks wrong."
        action={
          <Button asChild variant="secondary">
            <Link to="/report">
              <Flag aria-hidden="true" /> Report a concern
            </Link>
          </Button>
        }
      />
      <div className="mx-auto max-w-6xl px-5 py-16">
        <EditorialSection
          id="labels"
          eyebrow="Read the badge"
          title="Four states, each with a boundary"
        >
          <div className="overflow-hidden rounded-3xl border border-border/70 bg-card">
            {labels.map((item, index) => (
              <div
                key={item.label}
                className={`grid gap-3 p-5 transition-colors hover:bg-muted/30 md:grid-cols-[0.45fr_1fr_1fr] md:gap-6 ${index ? "border-t border-border/60" : ""}`}
              >
                <p className="font-bold text-foreground">{item.label}</p>
                <p className="text-sm leading-6 text-muted-foreground">
                  <span className="font-semibold text-primary">What it says: </span>
                  {item.meaning}
                </p>
                <p className="text-sm leading-6 text-muted-foreground">
                  <span className="font-semibold text-foreground">What it does not say: </span>
                  {item.not}
                </p>
              </div>
            ))}
          </div>
        </EditorialSection>

        <EditorialSection
          id="controls"
          eyebrow="Controls in the product"
          title="Safety is a set of routes, not a shield icon."
        >
          <FeatureGrid items={controls} />
        </EditorialSection>

        <EditorialSection>
          <div className="grid gap-5 lg:grid-cols-2">
            <Callout icon={CheckCircle2} title="Before you agree or pay">
              <ul className="list-disc space-y-2 pl-5">
                <li>Confirm you are speaking to the contact shown on the profile.</li>
                <li>Ask for scope, price, timing and refund terms in writing.</li>
                <li>Check relevant professional licences with the issuing body.</li>
                <li>Use a traceable payment method and retain receipts.</li>
                <li>Protect passwords, one-time codes and unnecessary identity documents.</li>
              </ul>
            </Callout>
            <Callout icon={AlertTriangle} title="Where our role stops" tone="warning">
              GainHub does not hold payment, inspect every workplace, guarantee provider conduct or
              replace regulators and emergency services. A report helps us assess the platform
              record; it is not a police report or emergency response.
            </Callout>
          </div>
        </EditorialSection>

        <div className="mt-14">
          <CtaBand
            eyebrow="Private reporting"
            title="Give the queue facts it can act on."
            body="Identify the profile, review, room or member; choose the closest reason; and explain what happened without publishing sensitive evidence. A successful submission returns a reference, not an invented resolution deadline."
            primary={{ to: "/report", label: "Open report form" }}
          />
        </div>
      </div>
    </PublicShell>
  );
}
